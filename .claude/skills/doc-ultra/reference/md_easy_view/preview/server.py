"""HTTP + SSE 预览服务器。

提供 Web 服务，实时可视化 Markdown 文件变更。
- HTTP: Python stdlib http.server
- SSE: Server-Sent Events 推送文件变更
- 前端：单页应用，全部内联在 HTML 中
"""

import io
import json
import os
import socket
import threading
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
try:
    from http.server import ThreadingHTTPServer
except ImportError:
    # Python < 3.7 fallback
    import socketserver
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
        daemon_threads = True


class ReuseAddrThreadingHTTPServer(ThreadingHTTPServer):
    """支持 SO_REUSEADDR 的多线程 HTTP 服务器，
    允许 Ctrl+C 后端口立即重用。"""
    allow_reuse_address = True
from pathlib import Path
from typing import Optional

from .snapshot import SnapshotManager
from .watcher import FileWatcher, FileChangeEvent
from .renderer import (
    render_md_to_html,
    render_overlay_diff_html,
    render_unified_diff_html,
    compute_diff_lines,
    split_sections,
)


# ─── SSE 客户端管理器 ───────────────────────────────────────

class SSEClientManager:
    """SSE 客户端连接管理器。"""

    def __init__(self):
        self._clients: list[io.StringIO] = []
        self._lock = threading.Lock()

    def register(self, buffer: io.StringIO) -> io.StringIO:
        """注册一个新的 SSE 客户端。返回用于写入的 buffer。"""
        with self._lock:
            self._clients.append(buffer)
        return buffer

    def unregister(self, buffer: io.StringIO) -> None:
        """注销一个 SSE 客户端。"""
        with self._lock:
            if buffer in self._clients:
                self._clients.remove(buffer)

    def broadcast(self, event_type: str, data: str) -> None:
        """广播事件到所有客户端。"""
        with self._lock:
            dead: list[io.StringIO] = []
            for buf in self._clients:
                try:
                    payload = (
                        f"event: {event_type}\n"
                        f"data: {data}\n\n"
                    )
                    buf.write(payload)
                    buf.seek(0)
                except Exception:
                    dead.append(buf)
            for buf in dead:
                self._clients.remove(buf)


_sse_manager = SSEClientManager()


# ─── HTTP 请求处理器 ────────────────────────────────────────

PREVIEW_PORT: int = 8765


class PreviewHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器。"""

    # 静态文件根目录（用于自定义资源）
    static_dir: Optional[Path] = None
    # 快照管理器引用
    snapshots: Optional[SnapshotManager] = None
    # 原始文件路径
    original_file: Optional[Path] = None

    def log_message(self, format: str, *args) -> None:
        """静默日志（不输出到控制台）。"""
        pass

    def _send_json(self, data: dict, status: int = 200) -> None:
        """发送 JSON 响应。"""
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _send_text(self, text: str, content_type: str = "text/html; charset=utf-8",
                   status: int = 200) -> None:
        """发送文本响应。"""
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            self.wfile.write(text.encode("utf-8"))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _send_error(self, status: int, message: str) -> None:
        """发送错误响应。"""
        self._send_json({"error": message}, status)

    def _parse_path(self) -> tuple[str, dict[str, str]]:
        """解析路径和查询参数。"""
        path = self.path
        query: dict[str, str] = {}
        if "?" in path:
            path, qs = path.split("?", 1)
            for pair in qs.split("&"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    from urllib.parse import unquote_plus
                    query[k] = unquote_plus(v)
        return path, query

    def do_GET(self) -> None:
        sm = self.__class__.snapshots
        if sm is None:
            self._send_error(500, "SnapshotManager not initialized")
            return

        path, query = self._parse_path()

        # ── 主页面 ──
        if path == "/":
            html = self._render_index_page(sm)
            self._send_text(html)
            return

        # ── SSE 推送端点 ──
        if path == "/events":
            self._handle_sse()
            return

        # ── API: 版本列表 ──
        if path == "/api/versions":
            versions = [v.to_dict() for v in sm.get_all_versions()]
            self._send_json({"versions": versions})
            return

        # ── API: 版本详情 ──
        if path.startswith("/api/versions/"):
            vid = path.split("/")[-1]
            if not vid:
                self._send_error(400, "Missing version ID")
                return
            content = sm.get_version_content(vid)
            if content is None:
                self._send_error(404, f"Version {vid} not found")
                return

            # 获取 diff 信息（如果指定了 from 参数）
            from_id = query.get("from", "")
            extra_css = ""
            extra_js = ""

            if from_id:
                from_content = sm.get_version_content(from_id)
                if from_content is not None:
                    overlay_mode = query.get("mode", "overlay")
                    if overlay_mode == "unified":
                        html = render_unified_diff_html(
                            title=f"{from_id} → {vid}",
                            text_a=from_content,
                            text_b=content,
                        )
                        self._send_text(html)
                        return
                    elif overlay_mode == "overlay":
                        html = render_overlay_diff_html(
                            title=f"{from_id} → {vid}",
                            text_a=from_content,
                            text_b=content,
                        )
                        self._send_text(html)
                        return
                    else:
                        # side-by-side 模式：返回纯渲染
                        html = render_md_to_html(
                            md_text=content,
                            title=f"Version {vid}",
                        )
                        self._send_text(html)
                        return

            # 无 diff：纯渲染
            html = render_md_to_html(
                md_text=content,
                title=f"Version {vid}",
            )
            self._send_text(html)
            return

        # ── API: Diff JSON ──
        if path == "/api/diff":
            from_id = query.get("from", "")
            to_id = query.get("to", "")
            if not from_id or not to_id:
                self._send_error(400, "Need 'from' and 'to' params")
                return

            content_a = sm.get_version_content(from_id)
            content_b = sm.get_version_content(to_id)
            if content_a is None or content_b is None:
                self._send_error(404, "Version not found")
                return

            line_states, line_old_texts = compute_diff_lines(content_a, content_b)

            # 构建 diff 数据
            lines_b = content_b.split("\n")
            diff_lines = []
            for i, line in enumerate(lines_b):
                state = line_states.get(i, "unchanged")
                old = line_old_texts.get(i, "")
                diff_lines.append({
                    "line": i,
                    "state": state,
                    "old": old,
                    "text": line,
                })

            self._send_json({
                "from": from_id,
                "to": to_id,
                "totalLines": len(lines_b),
                "added": sum(1 for d in diff_lines if d["state"] == "added"),
                "removed": sum(1 for d in diff_lines if d["state"] == "removed"),
                "changed": sum(1 for d in diff_lines if d["state"] == "changed"),
                "lines": diff_lines,
            })
            return

        # ── API: 章节数据 ──
        if path == "/api/sections":
            vid = query.get("version", "")
            if not vid:
                self._send_error(400, "Need 'version' param")
                return
            content = sm.get_version_content(vid)
            if content is None:
                self._send_error(404, f"Version {vid} not found")
                return
            sections = split_sections(content)
            self._send_json({
                "version": vid,
                "sections": [
                    {
                        "index": i + 1,
                        "level": s["level"],
                        "title": s["title"],
                        "startLine": s["start_line"],
                        "endLine": s["end_line"],
                        "lineCount": len(s["content_lines"]),
                    }
                    for i, s in enumerate(sections)
                ],
            })
            return

        # ── 404 ──
        self._send_error(404, "Not found")

    def _handle_sse(self) -> None:
        """处理 SSE 连接。"""
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            buffer = io.StringIO()
            _sse_manager.register(buffer)

            try:
                # 发送初始连接事件
                self.wfile.write(b"event: connected\ndata: {}\n\n")
                self.wfile.flush()

                while True:
                    time.sleep(0.5)
                    data = buffer.getvalue()
                    if data:
                        self.wfile.write(data.encode("utf-8"))
                        self.wfile.flush()
                        buffer.truncate(0)
                        buffer.seek(0)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                _sse_manager.unregister(buffer)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _render_index_page(self, sm: SnapshotManager) -> str:
        """渲染主页面（单页应用）。"""
        versions = sm.get_all_versions()
        versions_json = json.dumps(
            [v.to_dict() for v in versions],
            ensure_ascii=False,
        )
        _build_time = int(time.time())

        # 找到默认的 from 和 to
        default_from = versions[0].version_id if versions else ""
        default_to = versions[-1].version_id if versions else ""

        return f"""\
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>doc-ultra Preview - 实时文档可视化</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
}}
body {{
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    background: #f0f2f5;
    color: #1a1a2e;
    display: flex;
    flex-direction: column;
    height: 100%;
}}
@media (prefers-color-scheme: dark) {{
    body {{ background: #121216; color: #e2e2e8; }}
    .app-header {{ background: #1a1a20; border-color: #2e2e38; }}
    .app-header .port-badge {{ background: #2e2e38; color: #888; }}
    .timeline {{ background: #1a1a20; border-color: #2e2e38; }}
    .timeline-node {{ background: #2a2a34; color: #888; border-radius: 10px; }}
    .timeline-node:hover {{ background: #333340; }}
    .timeline-node.active {{ background: rgba(59,130,246,0.2); color: #fff; }}
    .timeline-node.active.selected {{ background: rgba(34,197,94,0.2); color: #fff; }}
    .timeline-line {{ background: #33333d; }}
    .controls {{ background: #1a1a20; border-color: #2e2e38; }}
    .controls select {{ background: #2e2e38; color: #e2e2e8; border-color: #3e3e48; }}
    .preview-frame {{ background: #fff; }}
    .view-toggle button {{ color: #888; }}
    .view-toggle button.active {{ background: #3b82f6; color: #fff; }}
    .stat-box {{ background: #2e2e38; }}
    .stat-box .stat-value {{ color: #e2e2e8; }}
    .outline-sidebar {{ background: #1a1a20; border-color: #2e2e38; box-shadow: 2px 0 16px rgba(0,0,0,0.3); }}
    .outline-sidebar-header {{ color: #e2e2e8; border-color: #2e2e38; }}
    .outline-item {{ color: #999; }}
    .outline-item:hover {{ background: #1e1e24; color: #60a5fa; }}
    .outline-item.level-2 {{ color: #ccc; }}
    .outline-toggle {{ background: #1a1a20; border-color: #3e3e48; color: #888; }}
    .outline-toggle:hover {{ background: #1e1e24; border-color: #60a5fa; color: #60a5fa; }}
}}

.app-header {{
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
}}
.app-header .logo {{
    font-size: 1.1rem;
    font-weight: 700;
    color: #3b82f6;
}}
.app-header .logo span {{ color: #1a1a2e; }}
.app-header .port-badge {{
    font-size: 0.8rem;
    color: #666;
    background: #f1f5f9;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
}}

.timeline {{
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
    overflow-x: auto;
    white-space: nowrap;
}}
.timeline-track {{
    display: flex;
    align-items: center;
    gap: 0;
}}
.timeline-node {{
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    font-size: 0.8rem;
    color: #666;
    transition: all 0.15s;
    min-width: 60px;
    border: none;
    background: none;
    position: relative;
}}
.timeline-node:hover {{ background: #f1f5f9; transform: translateY(-2px); }}
.timeline-node .dot {{
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.7rem;
    color: #666;
    transition: all 0.15s;
}}
.timeline-node.active .dot {{
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: #fff;
    box-shadow: 0 3px 10px rgba(59,130,246,0.35);
}}
.timeline-node.active.selected .dot {{
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    box-shadow: 0 3px 10px rgba(34,197,94,0.35);
}}
.timeline-node .label {{
    font-size: 0.7rem;
    white-space: nowrap;
}}
.timeline-line {{
    width: 24px;
    height: 2px;
    background: #d0d5dd;
    flex-shrink: 0;
}}

.controls {{
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}}
.controls label {{
    font-size: 0.85rem;
    color: #666;
    font-weight: 500;
}}
.controls select {{
    padding: 0.35rem 0.6rem;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    font-size: 0.85rem;
    background: #fff;
    color: #1a1a2e;
    cursor: pointer;
}}
.controls .divider {{
    width: 1px;
    height: 24px;
    background: #e2e8f0;
}}
.view-toggle {{
    display: flex;
    gap: 0.25rem;
    background: #f1f5f9;
    border-radius: 6px;
    padding: 2px;
}}
.view-toggle button {{
    padding: 0.3rem 0.75rem;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    background: transparent;
    color: #666;
    transition: all 0.15s;
}}
.view-toggle button.active {{
    background: #fff;
    color: #1a1a2e;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}}
.view-toggle button:hover:not(.active) {{ color: #3b82f6; }}

.stats-bar {{
    flex-shrink: 0;
    display: flex;
    gap: 1rem;
    padding: 0.5rem 1.5rem;
    background: #f8f9fc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.8rem;
}}
@media (prefers-color-scheme: dark) {{
    .stats-bar {{ background: #16161a; border-color: #2e2e38; }}
}}
.stat-box {{
    background: #fff;
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}}
.stat-box .stat-label {{ color: #888; }}
.stat-box .stat-value {{ font-weight: 600; }}
.stat-box .stat-value.added {{ color: #22c55e; }}
.stat-box .stat-value.removed {{ color: #ef4444; }}
.stat-box .stat-value.changed {{ color: #eab308; }}

.preview-wrapper {{
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
}}
.preview-container {{
    flex: 1;
    min-height: 0;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    position: relative;
    height: 100%;
}}
.preview-container.side-by-side {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
    gap: 1rem;
}}

/* ─── 大纲侧边栏 ─── */
.outline-sidebar {{
    position: absolute;
    left: -320px;
    top: 0;
    bottom: 0;
    width: 300px;
    background: #fff;
    border-right: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 2px 0 16px rgba(0,0,0,0.06);
    z-index: 50;
    transition: left 0.3s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}}
.outline-sidebar.visible {{
    left: 0;
}}
.outline-sidebar-header {{
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 600;
    font-size: 0.85rem;
    color: #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}}
.outline-sidebar-body {{
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
}}
.outline-item {{
    display: block;
    padding: 0.35rem 1rem 0.35rem 1.5rem;
    font-size: 0.8rem;
    color: #555;
    cursor: pointer;
    transition: all 0.12s;
    border-left: 2px solid transparent;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}}
.outline-item:hover {{
    background: #f1f5f9;
    color: #3b82f6;
    border-left-color: #3b82f6;
}}
.outline-item.level-2 {{ padding-left: 1.5rem; font-weight: 500; color: #333; }}
.outline-item.level-3 {{ padding-left: 2.5rem; font-size: 0.78rem; }}
.outline-item.level-4 {{ padding-left: 3.5rem; font-size: 0.76rem; color: #777; }}
.outline-toggle {{
    position: absolute;
    left: 1.5rem;
    top: 1rem;
    z-index: 55;
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-size: 0.78rem;
    color: #555;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}}
.outline-toggle:hover {{
    background: #f8fafc;
    border-color: #3b82f6;
    color: #3b82f6;
}}
.outline-toggle .toggle-icon {{
    font-size: 0.7rem;
    transition: transform 0.2s;
}}
.outline-toggle.shifted {{
    left: 320px;
}}
/* 大纲为空时的占位 */
.outline-empty {{
    padding: 2rem 1rem;
    text-align: center;
    color: #aaa;
    font-size: 0.8rem;
}}
.preview-frame {{
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}}
.preview-container.side-by-side .preview-frame {{
    min-height: 0;
}}
.preview-frame .frame-header {{
    padding: 0.5rem 1rem;
    background: #f8f9fc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.8rem;
    font-weight: 600;
    color: #666;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}}
.frame-badge {{
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.3px;
}}
.frame-badge-left {{ background: #e0e7ff; color: #3730a3; }}
.frame-badge-right {{ background: #fef3c7; color: #92400e; }}
.sync-scroll-btn {{
    margin-left: auto;
    padding: 0.2rem 0.55rem;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    background: #fff;
    font-size: 0.72rem;
    color: #555;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}}
.sync-scroll-btn:hover {{ background: #f1f5f9; border-color: #3b82f6; color: #3b82f6; }}
.sync-scroll-btn.locked {{ background: #3b82f6; color: #fff; border-color: #3b82f6; }}

/* ─── 并排视图浮动 Diff 面板 ─── */
#side-diff-panel {{
    position: fixed;
    bottom: 1.2rem;
    right: 1.2rem;
    width: 320px;
    max-width: 42vw;
    max-height: 55vh;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    z-index: 1000;
    display: none;
    flex-direction: column;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.2s;
}}
#side-diff-panel.visible {{
    display: flex;
    animation: diff-panel-in 0.2s ease-out;
}}
@keyframes diff-panel-in {{
    from {{ opacity: 0; transform: translateY(12px) scale(0.95); }}
    to {{ opacity: 1; transform: translateY(0) scale(1); }}
}}
.side-diff-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.85rem;
    background: #f8f9fc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
    color: #333;
    flex-shrink: 0;
}}
.side-diff-header-close {{
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: #888;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
}}
.side-diff-header-close:hover {{ background: #e2e8f0; color: #333; }}
.side-diff-stats {{
    display: flex;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.72rem;
    color: #666;
    flex-shrink: 0;
}}
.side-diff-stats .ss {{ font-weight: 600; }}
.side-diff-stats .ss.a {{ color: #16a34a; }}
.side-diff-stats .ss.r {{ color: #dc2626; }}
.side-diff-stats .ss.c {{ color: #ca8a04; }}
.side-diff-body {{
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}}
.side-diff-body::-webkit-scrollbar {{ width: 5px; }}
.side-diff-body::-webkit-scrollbar-thumb {{ background: #cbd5e1; border-radius: 3px; }}
.diff-mini-item {{
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.25rem 0.8rem;
    border-bottom: 1px solid #f8fafc;
    cursor: pointer;
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    line-height: 1.4;
    transition: background 0.1s;
}}
.diff-mini-item:hover {{ background: #f1f5f9; }}
.diff-mini-item.added {{ border-left: 3px solid #22c55e; }}
.diff-mini-item.removed {{ border-left: 3px solid #ef4444; }}
.diff-mini-item.changed {{ border-left: 3px solid #eab308; }}
.diff-mini-marker {{
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    font-weight: 700;
    font-size: 0.68rem;
    margin-top: 1px;
}}
.diff-mini-marker.added {{ color: #16a34a; }}
.diff-mini-marker.removed {{ color: #dc2626; }}
.diff-mini-marker.changed {{ color: #ca8a04; }}
.diff-mini-ln {{
    flex-shrink: 0;
    color: #94a3b8;
    min-width: 28px;
    text-align: right;
    user-select: none;
}}
.diff-mini-text {{
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #333;
}}
.diff-mini-text.old {{
    color: #999;
    text-decoration: line-through;
    text-decoration-color: rgba(0,0,0,0.2);
}}
#side-diff-toggle-btn {{
    padding: 0.2rem 0.55rem;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    background: #fff;
    font-size: 0.72rem;
    color: #555;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}}
#side-diff-toggle-btn:hover {{ background: #f1f5f9; border-color: #f59e0b; color: #d97706; }}
#side-diff-toggle-btn.active {{ background: #fef3c7; color: #92400e; border-color: #f59e0b; }}
@media (prefers-color-scheme: dark) {{
    .preview-frame .frame-header {{ background: #1e1e24; border-color: #2e2e38; color: #888; }}
}}
.preview-frame .frame-content {{
    padding: 0;
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
}}
.preview-frame .frame-content iframe {{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
}}

.loading {{
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #888;
    font-size: 0.9rem;
}}
.loading::after {{
    content: "";
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-left: 0.5rem;
}}
@keyframes spin {{ to {{ transform: rotate(360deg); }} }}

.sse-status {{
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: #888;
}}
.sse-status .dot {{
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse 2s ease-in-out infinite;
}}
.sse-status .dot.disconnected {{ background: #ef4444; animation: none; }}
@keyframes pulse {{
    0%, 100% {{ opacity: 1; }}
    50% {{ opacity: 0.4; }}
}}

.empty-state {{
    text-align: center;
    padding: 3rem;
    color: #888;
}}
.empty-state h3 {{ margin-bottom: 0.5rem; color: #666; }}

@media (max-width: 768px) {{
    .preview-container.side-by-side {{
        grid-template-columns: 1fr;
    }}
    .controls {{ flex-direction: column; align-items: flex-start; }}
}}
</style>
</head>
<body>

<div class="app-header">
    <div class="logo">doc-ultra <span>Preview</span></div>
    <div style="display:flex;align-items:center;gap:1rem;">
        <span class="sse-status" id="sse-status">
            <span class="dot" id="sse-dot"></span>
            <span id="sse-label">实时</span>
        </span>
        <span class="port-badge">:8765</span>
    </div>
</div>

<div class="timeline" id="timeline">
    <div class="timeline-track" id="timeline-track"></div>
</div>

<div class="controls" id="controls">
    <label>基准版本</label>
    <select id="select-from"></select>
    <span style="color:#888;font-size:0.85rem;">→</span>
    <label>目标版本</label>
    <select id="select-to"></select>
    <div class="divider"></div>
    <div class="view-toggle">
        <button class="active" data-mode="overlay" onclick="switchView('overlay')">修订视图</button>
        <button data-mode="side-by-side" onclick="switchView('side-by-side')">并排视图</button>
        <button data-mode="unified" onclick="switchView('unified')">统一视图</button>
        <button data-mode="single" onclick="switchView('single')">仅目标</button>
    </div>
    <div class="divider"></div>
    <button onclick="refreshPreview()" style="padding:0.3rem 0.75rem;border:1px solid #d0d5dd;border-radius:6px;background:transparent;cursor:pointer;font-size:0.8rem;color:#666;">刷新</button>
</div>

<div class="stats-bar" id="stats-bar">
    <span style="color:#888;">Diff 统计:</span>
</div>

<div class="preview-wrapper" id="preview-wrapper">
    <button class="outline-toggle" id="outline-toggle" onclick="toggleOutline()" title="显示/隐藏文档大纲" style="display:none;">
        <span class="toggle-icon">☰</span> 大纲
    </button>
    <div class="outline-sidebar" id="outline-sidebar">
        <div class="outline-sidebar-header">
            <span>📑 文档大纲</span>
            <span onclick="toggleOutline()" style="cursor:pointer;font-size:1rem;color:#888;">✕</span>
        </div>
        <div class="outline-sidebar-body" id="outline-body">
            <div class="outline-empty">选择版本来加载大纲</div>
        </div>
    </div>
    <div class="preview-container" id="preview-container">
        <div class="loading">加载中...</div>
    </div>
</div>

<script>
// ─── 全局状态 ───
var VERSIONS = {versions_json};
var currentMode = 'overlay';
var currentFrom = '{default_from}';
var currentTo = '{default_to}';
var sseConnected = false;
var PAGE_VER = {_build_time};

// ─── 初始化 ───
document.addEventListener('DOMContentLoaded', function() {{
    initTimeline();
    initSelects();
    connectSSE();
    refreshPreview();
}});

// ─── 版本时间线 ───
function initTimeline() {{
    var track = document.getElementById('timeline-track');
    track.innerHTML = '';
    for (var i = 0; i < VERSIONS.length; i++) {{
        var v = VERSIONS[i];
        if (i > 0) {{
            var line = document.createElement('div');
            line.className = 'timeline-line';
            track.appendChild(line);
        }}
        var node = document.createElement('button');
        node.className = 'timeline-node';
        if (v.id === currentFrom) node.classList.add('active');
        if (v.id === currentTo) node.classList.add('active', 'selected');
        node.dataset.vid = v.id;
        node.innerHTML = '<span class="dot">' + v.id + '</span><span class="label">' + v.name + '</span>';
        node.addEventListener('click', function() {{ onTimelineClick(this.dataset.vid); }});
        track.appendChild(node);
    }}
}}

function onTimelineClick(vid) {{
    if (vid === currentFrom) {{
        // 点击同一个节点：切换为 from
        return;
    }}
    if (vid === currentTo) {{
        // 交换 from 和 to
        var tmp = currentFrom;
        currentFrom = currentTo;
        currentTo = tmp;
    }} else {{
        // 把点击的节点设为 to，旧的 to 变成 from（如果 from 是 to 的话）
        currentFrom = currentTo;
        currentTo = vid;
    }}
    updateSelects();
    updateTimelineNodes();
    refreshPreview();
}}

function updateTimelineNodes() {{
    var nodes = document.querySelectorAll('.timeline-node');
    nodes.forEach(function(n) {{
        n.classList.remove('active', 'selected');
        if (n.dataset.vid === currentFrom) n.classList.add('active');
        if (n.dataset.vid === currentTo) n.classList.add('active', 'selected');
    }});
}}

// ─── 下拉选择 ───
function initSelects() {{
    var selFrom = document.getElementById('select-from');
    var selTo = document.getElementById('select-to');
    selFrom.innerHTML = '';
    selTo.innerHTML = '';
    VERSIONS.forEach(function(v) {{
        var opt1 = document.createElement('option');
        opt1.value = v.id;
        opt1.textContent = v.id + ' - ' + v.name;
        if (v.id === currentFrom) opt1.selected = true;
        selFrom.appendChild(opt1);

        var opt2 = document.createElement('option');
        opt2.value = v.id;
        opt2.textContent = v.id + ' - ' + v.name;
        if (v.id === currentTo) opt2.selected = true;
        selTo.appendChild(opt2);
    }});
    selFrom.addEventListener('change', function() {{
        currentFrom = this.value;
        updateTimelineNodes();
        refreshPreview();
    }});
    selTo.addEventListener('change', function() {{
        currentTo = this.value;
        updateTimelineNodes();
        refreshPreview();
    }});
}}

function updateSelects() {{
    document.getElementById('select-from').value = currentFrom;
    document.getElementById('select-to').value = currentTo;
}}

// ─── 视图切换 ───
function switchView(mode) {{
    currentMode = mode;
    document.querySelectorAll('.view-toggle button').forEach(function(b) {{
        b.classList.toggle('active', b.dataset.mode === mode);
    }});
    // 更新大纲按钮可见性
    var toggleBtn = document.getElementById('outline-toggle');
    if (mode === 'side-by-side') {{
        toggleBtn.style.display = 'none';
        document.getElementById('outline-sidebar').classList.remove('visible');
    }} else if (mode === 'unified') {{
        toggleBtn.style.display = 'none';
        document.getElementById('outline-sidebar').classList.remove('visible');
    }} else {{
        toggleBtn.style.display = 'flex';
        // 自动加载大纲
        fetchOutline();
    }}
    refreshPreview();
}}

// ─── 大纲面板 ───
var _outlineVisible = false;
function toggleOutline() {{
    _outlineVisible = !_outlineVisible;
    var sidebar = document.getElementById('outline-sidebar');
    var toggleBtn = document.getElementById('outline-toggle');
    var icon = toggleBtn.querySelector('.toggle-icon');
    if (_outlineVisible) {{
        sidebar.classList.add('visible');
        toggleBtn.classList.add('shifted');
        icon.textContent = '◁';
        fetchOutline();
    }} else {{
        sidebar.classList.remove('visible');
        toggleBtn.classList.remove('shifted');
        icon.textContent = '☰';
    }}
}}

function fetchOutline() {{
    fetch('/api/sections?version=' + encodeURIComponent(currentTo) + '&_t=' + Date.now())
        .then(function(r) {{ return r.json(); }})
        .then(function(data) {{
            buildOutline(data.sections || []);
        }})
        .catch(function() {{
            document.getElementById('outline-body').innerHTML = '<div class="outline-empty">大纲加载失败</div>';
        }});
}}

function buildOutline(sections) {{
    var body = document.getElementById('outline-body');
    if (!sections || sections.length === 0) {{
        body.innerHTML = '<div class="outline-empty">此文档无可解析的章节</div>';
        return;
    }}
    var html = '';
    sections.forEach(function(s) {{
        var indentClass = 'level-' + Math.min(s.level, 4);
        var prefix = s.level === 2 ? '' : (s.level === 3 ? '└ ' : '  └ ');
        html += '<a class="outline-item ' + indentClass + '" ' +
            'onclick="scrollToSection(' + s.index + ')" ' +
            'title="' + s.title.replace(/"/g, '&quot;') + '">' +
            prefix + s.title +
            '</a>';
    }});
    body.innerHTML = html;
}}

function scrollToSection(index) {{
    // 查找当前可见的 iframe 中的 section-card
    var iframe = document.getElementById('frame-single') || document.getElementById('frame-overlay') || document.getElementById('frame-to') || document.getElementById('frame-from');
    if (!iframe || !iframe.contentDocument) return;
    var cards = iframe.contentDocument.querySelectorAll('.section-card');
    if (cards[index - 1]) {{
        cards[index - 1].scrollIntoView({{ behavior: 'smooth', block: 'start' }});
        // 高亮闪烁
        cards[index - 1].style.boxShadow = '0 0 0 2px #3b82f6';
        setTimeout(function() {{ cards[index - 1].style.boxShadow = ''; }}, 1500);
    }}
}}

// ─── 刷新预览 ───
function refreshPreview() {{
    var container = document.getElementById('preview-container');
    var statsBar = document.getElementById('stats-bar');
    var toggleBtn = document.getElementById('outline-toggle');

    // 先关闭大纲侧边栏
    _outlineVisible = false;
    document.getElementById('outline-sidebar').classList.remove('visible');
    if (toggleBtn) {{ toggleBtn.classList.remove('shifted'); toggleBtn.querySelector('.toggle-icon').textContent = '☰'; }}

    if (currentMode === 'side-by-side') {{
        // 并排视图：隐藏大纲按钮
        if (toggleBtn) toggleBtn.style.display = 'none';
        container.className = 'preview-container side-by-side';
        container.innerHTML =
            '<div class="preview-frame" id="frame-left-wrapper">' +
            '    <div class="frame-header">' +
            '        <span class="frame-badge frame-badge-left">基准</span>' +
            '        <span>' + currentFrom + ' - ' + getVersionName(currentFrom) + '</span>' +
            '    </div>' +
            '    <div class="frame-content"><iframe srcdoc="<div class=loading>加载中...</div>" id="frame-from"></iframe></div>' +
            '</div>' +
            '<div class="preview-frame" id="frame-right-wrapper">' +
            '    <div class="frame-header">' +
            '        <span class="frame-badge frame-badge-right">修订</span>' +
            '        <span>' + currentTo + ' - ' + getVersionName(currentTo) + '</span>' +
            '        <button id="side-diff-toggle-btn" onclick="toggleSideDiffPanel()" title="显示/隐藏变更清单">📋 变更</button>' +
            '        <button id="sync-scroll-btn" onclick="toggleSyncScroll()" class="sync-scroll-btn" title="锁定/解锁同步滚动">🔗 同步</button>' +
            '    </div>' +
            '    <div class="frame-content"><iframe srcdoc="<div class=loading>加载中...</div>" id="frame-to"></iframe></div>' +
            '</div>' +
            // 浮动 Diff 面板
            '<div id="side-diff-panel">' +
            '    <div class="side-diff-header">' +
            '        <span>📋 变更清单</span>' +
            '        <button class="side-diff-header-close" onclick="toggleSideDiffPanel()">✕</button>' +
            '    </div>' +
            '    <div class="side-diff-stats" id="side-diff-stats"></div>' +
            '    <div class="side-diff-body" id="side-diff-body">' +
            '        <div style="padding:1rem;text-align:center;color:#94a3b8;font-size:0.8rem;">加载中...</div>' +
            '    </div>' +
            '</div>';
        // 左侧加载原始版本，右侧加载修订模式（带 diff 颜色标记）
        loadIframe('frame-from', '/api/versions/' + currentFrom);
        loadIframe('frame-to', '/api/versions/' + currentTo + '?from=' + encodeURIComponent(currentFrom) + '&mode=overlay');
        // 加载 diff 统计
        fetch('/api/diff?from=' + encodeURIComponent(currentFrom) + '&to=' + encodeURIComponent(currentTo) + '&_t=' + Date.now())
            .then(function(r) {{ return r.json(); }})
            .then(function(data) {{
                statsBar.innerHTML =
                    '<span style="color:#888;">Diff:</span>' +
                    '<span class="stat-box"><span class="stat-label">+新增</span> <span class="stat-value added">' + data.added + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">-删除</span> <span class="stat-value removed">' + data.removed + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">~修改</span> <span class="stat-value changed">' + data.changed + '</span></span>' +
                    '<span style="color:#888;margin-left:0.5rem;">| 并排视图：左侧基准/右侧修订</span>';
                // 构建浮动变更清单
                buildSideDiffPanel(data);
            }})
            .catch(function() {{
                statsBar.innerHTML = '<span style="color:#888;">并排视图 — 左侧基准 / 右侧目标</span>';
            }});
        // 等待 iframe 加载完成后绑定滚动联动
        setTimeout(initSideBySideSync, 800);
    }} else if (currentMode === 'unified') {{
        // 统一视图：git diff --unified 风格单列显示
        if (toggleBtn) toggleBtn.style.display = 'none';
        container.className = 'preview-container';
        container.innerHTML = '<div class="loading">加载统一 diff 中...</div>';
        statsBar.innerHTML = '<span style="color:#888;">统一视图 — git diff 风格单列显示</span>';

        fetch('/api/diff?from=' + encodeURIComponent(currentFrom) + '&to=' + encodeURIComponent(currentTo) + '&_t=' + Date.now())
            .then(function(r) {{ return r.json(); }})
            .then(function(data) {{
                statsBar.innerHTML =
                    '<span style="color:#888;">Diff:</span>' +
                    '<span class="stat-box"><span class="stat-label">+新增</span> <span class="stat-value added">' + data.added + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">-删除</span> <span class="stat-value removed">' + data.removed + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">~修改</span> <span class="stat-value changed">' + data.changed + '</span></span>' +
                    '<span style="color:#888;margin-left:0.5rem;">| 单列: -旧行 +新行</span>';

                container.innerHTML =
                    '<div class="preview-frame">' +
                    '    <div class="frame-header">' + currentFrom + ' → ' + currentTo + ' (统一视图)</div>' +
                    '    <div class="frame-content"><iframe srcdoc="<div class=loading>加载中...</div>" id="frame-unified"></iframe></div>' +
                    '</div>';
                loadIframe('frame-unified', '/api/versions/' + currentTo + '?from=' + encodeURIComponent(currentFrom) + '&mode=unified');
            }})
            .catch(function(err) {{
                container.innerHTML = '<div class="empty-state"><h3>加载失败</h3><p>' + err + '</p></div>';
            }});
    }} else if (currentMode === 'single') {{
        // 仅目标：显示大纲按钮
        if (toggleBtn) toggleBtn.style.display = 'flex';
        container.className = 'preview-container';
        container.innerHTML =
            '<div class="preview-frame">' +
            '    <div class="frame-header">' + currentTo + ' - ' + getVersionName(currentTo) + '</div>' +
            '    <div class="frame-content"><iframe srcdoc="<div class=loading>加载中...</div>" id="frame-single"></iframe></div>' +
            '</div>';
        loadIframe('frame-single', '/api/versions/' + currentTo);
        statsBar.innerHTML = '<span style="color:#888;">仅查看目标版本</span>';
        setTimeout(fetchOutline, 800);
    }} else {{
        // overlay mode：显示大纲按钮
        if (toggleBtn) toggleBtn.style.display = 'flex';
        container.className = 'preview-container';
        container.innerHTML = '<div class="loading">加载 diff 中...</div>';
        statsBar.innerHTML = '<span style="color:#888;">修订视图 — 修订模式 (绿色=新增, 红色=删除, 黄色=修改，悬浮查看详情)</span>';

        fetch('/api/diff?from=' + encodeURIComponent(currentFrom) + '&to=' + encodeURIComponent(currentTo) + '&_t=' + Date.now())
            .then(function(r) {{ return r.json(); }})
            .then(function(data) {{
                // 更新统计
                statsBar.innerHTML =
                    '<span style="color:#888;">Diff 统计:</span>' +
                    '<span class="stat-box"><span class="stat-label">新增</span> <span class="stat-value added">+' + data.added + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">删除</span> <span class="stat-value removed">-' + data.removed + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">修改</span> <span class="stat-value changed">~' + data.changed + '</span></span>' +
                    '<span class="stat-box"><span class="stat-label">总计</span> <span class="stat-value" style="color:#666;">' + data.totalLines + '</span></span>';

                // 加载 overlay 渲染
                container.innerHTML =
                    '<div class="preview-frame">' +
                    '    <div class="frame-header">' + currentFrom + ' → ' + currentTo + ' (修订模式·悬浮查看详情)</div>' +
                    '    <div class="frame-content"><iframe srcdoc="<div class=loading>加载中...</div>" id="frame-overlay"></iframe></div>' +
                    '</div>';
                loadIframe('frame-overlay', '/api/versions/' + currentTo + '?from=' + encodeURIComponent(currentFrom) + '&mode=overlay');
                setTimeout(fetchOutline, 1200);
            }})
            .catch(function(err) {{
                container.innerHTML = '<div class="empty-state"><h3>加载失败</h3><p>' + err + '</p></div>';
            }});
    }}
}}

function loadIframe(frameId, url) {{
    var cacheBuster = (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
    fetch(url + cacheBuster)
        .then(function(r) {{ if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }})
        .then(function(html) {{
            var iframe = document.getElementById(frameId);
            if (iframe) {{
                iframe.srcdoc = html;
            }}
        }})
        .catch(function(err) {{
            var iframe = document.getElementById(frameId);
            if (iframe) {{
                iframe.srcdoc = '<div class="empty-state"><h3>加载失败</h3><p>' + err + '</p></div>';
            }}
        }});
}}

function getVersionName(vid) {{
    for (var i = 0; i < VERSIONS.length; i++) {{
        if (VERSIONS[i].id === vid) return VERSIONS[i].name;
    }}
    return vid;
}}

// ─── 并排视图滚动联动 ───
var _syncingScroll = false;
var _syncScrollEnabled = true;
function toggleSyncScroll() {{
    _syncScrollEnabled = !_syncScrollEnabled;
    var btn = document.getElementById('sync-scroll-btn');
    if (btn) {{
        if (_syncScrollEnabled) {{
            btn.classList.add('locked');
            btn.innerHTML = '🔗 同步';
        }} else {{
            btn.classList.remove('locked');
            btn.innerHTML = '🔓 独立';
        }}
    }}
}}
function initSideBySideSync() {{
    var leftIframe = document.getElementById('frame-from');
    var rightIframe = document.getElementById('frame-to');
    if (!leftIframe || !rightIframe) return;

    _syncScrollEnabled = true;
    var btn = document.getElementById('sync-scroll-btn');
    if (btn) btn.classList.add('locked');

    function trySetup() {{
        var lw = leftIframe.contentWindow;
        var rw = rightIframe.contentWindow;
        if (!lw || !rw || !lw.document || !rw.document) {{
            setTimeout(trySetup, 200);
            return;
        }}

        function syncScroll(srcWin, tgtWin) {{
            if (!_syncScrollEnabled || _syncingScroll) return;
            _syncingScroll = true;
            var d = srcWin.document.documentElement;
            var ratio = d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight);
            var td = tgtWin.document.documentElement;
            td.scrollTop = ratio * Math.max(0, td.scrollHeight - td.clientHeight);
            requestAnimationFrame(function() {{ _syncingScroll = false; }});
        }}

        lw.addEventListener('scroll', function() {{ syncScroll(lw, rw); }});
        rw.addEventListener('scroll', function() {{ syncScroll(rw, lw); }});
    }}

    trySetup();
}}

// ─── 浮动 Diff 面板 ───
var _sideDiffPanelBuilt = false;
var _sideDiffPanelVisible = false;
var _sideDiffData = null;

function toggleSideDiffPanel() {{
    var panel = document.getElementById('side-diff-panel');
    var btn = document.getElementById('side-diff-toggle-btn');
    if (!panel) return;
    _sideDiffPanelVisible = !_sideDiffPanelVisible;
    if (_sideDiffPanelVisible) {{
        panel.classList.add('visible');
        if (btn) btn.classList.add('active');
    }} else {{
        panel.classList.remove('visible');
        if (btn) btn.classList.remove('active');
    }}
}}

function buildSideDiffPanel(data) {{
    var statsEl = document.getElementById('side-diff-stats');
    var bodyEl = document.getElementById('side-diff-body');
    if (!statsEl || !bodyEl) return;

    // 统计行
    statsEl.innerHTML =
        '<span>+<span class="ss a">' + data.added + '</span></span>' +
        '<span>-<span class="ss r">' + data.removed + '</span></span>' +
        '<span>~<span class="ss c">' + data.changed + '</span></span>' +
        '<span style="margin-left:auto;">共 ' + data.totalLines + ' 行</span>';

    // 只显示有变更的行
    var changedLines = (data.lines || []).filter(function(l) {{
        return l.state !== 'unchanged';
    }});

    if (changedLines.length === 0) {{
        bodyEl.innerHTML = '<div style="padding:0.8rem;text-align:center;color:#94a3b8;font-size:0.78rem;">无变更</div>';
        return;
    }}

    var html = '';
    changedLines.forEach(function(l) {{
        var marker = l.state === 'added' ? '+' : l.state === 'removed' ? '-' : '~';
        var text = l.text || '';
        // 截断过长文本
        if (text.length > 60) text = text.substring(0, 60) + '...';
        var textEscaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        html += '<div class="diff-mini-item ' + l.state + '" ' +
            'onclick="scrollToDiffLine(' + l.line + ')" ' +
            'title="行 ' + (l.line + 1) + ': ' + textEscaped + '">' +
            '<span class="diff-mini-marker ' + l.state + '">' + marker + '</span>' +
            '<span class="diff-mini-ln">' + (l.line + 1) + '</span>' +
            '<span class="diff-mini-text">' + textEscaped + '</span>' +
            '</div>';

        // 如果有旧文本，追加一行显示
        if (l.old && l.state === 'changed') {{
            var oldText = l.old;
            if (oldText.length > 60) oldText = oldText.substring(0, 60) + '...';
            var oldEscaped = oldText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            html += '<div class="diff-mini-item removed" style="opacity:0.65;" onclick="scrollToDiffLine(' + l.line + ')">' +
                '<span class="diff-mini-marker removed">-</span>' +
                '<span class="diff-mini-ln">---</span>' +
                '<span class="diff-mini-text old">' + oldEscaped + '</span>' +
                '</div>';
        }}
    }});

    bodyEl.innerHTML = html;
    _sideDiffData = data;
    _sideDiffPanelBuilt = true;

    // 自动显示面板
    if (!_sideDiffPanelVisible) {{
        toggleSideDiffPanel();
    }}
}}

function scrollToDiffLine(lineNumber) {{
    var leftIframe = document.getElementById('frame-from');
    var rightIframe = document.getElementById('frame-to');

    function scrollIframe(iframe) {{
        if (!iframe || !iframe.contentDocument) return;
        // 查找 data-line-id 匹配的元素
        var target = iframe.contentDocument.querySelector('[data-line-id="' + lineNumber + '"]');
        if (target) {{
            target.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
            // 高亮闪烁
            target.style.boxShadow = '0 0 0 3px #f59e0b';
            setTimeout(function() {{ target.style.boxShadow = ''; }}, 1800);
        }}
    }}

    scrollIframe(rightIframe);
    scrollIframe(leftIframe);

    // 高亮对应的 diff-mini-item
    var body = document.getElementById('side-diff-body');
    if (body) {{
        var items = body.querySelectorAll('.diff-mini-item');
        items.forEach(function(item) {{
            item.style.background = '';
        }});
        var activeItem = body.querySelector('.diff-mini-item[onclick*="scrollToDiffLine(' + lineNumber + ')"]');
        if (activeItem) {{
            activeItem.style.background = '#fef3c7';
            activeItem.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
        }}
    }}
}}

// ─── SSE 连接 ───
function connectSSE() {{
    var evtSource = new EventSource('/events');
    var dot = document.getElementById('sse-dot');
    var label = document.getElementById('sse-label');

    evtSource.onopen = function() {{
        sseConnected = true;
        dot.className = 'dot';
        label.textContent = '实时';
    }};

    evtSource.addEventListener('connected', function() {{
        sseConnected = true;
        dot.className = 'dot';
        label.textContent = '实时';
    }});

    evtSource.addEventListener('file_changed', function(e) {{
        dot.className = 'dot';
        dot.style.animation = 'none';
        dot.style.opacity = '1';

        // 闪烁提示
        dot.style.background = '#f59e0b';
        setTimeout(function() {{
            dot.style.background = '';
            dot.style.animation = '';
        }}, 1000);

        label.textContent = '已更新';

        // 解析事件数据，获取完整版本列表
        try {{
            var payload = JSON.parse(e.data);
            if (payload.versions && payload.versions.length > 0) {{
                VERSIONS = payload.versions;
                initTimeline();
                initSelects();
                // 自动切换到最新版本对比
                if (payload.new_version) {{
                    var prevIdx = VERSIONS.length - 2;
                    if (prevIdx >= 0) {{
                        currentFrom = VERSIONS[prevIdx].id;
                    }}
                    currentTo = payload.new_version;
                    updateSelects();
                    updateTimelineNodes();
                }}
            }}
        }} catch(_) {{}}

        refreshPreview();
        label.textContent = '实时';
    }});

    evtSource.onerror = function() {{
        sseConnected = false;
        dot.className = 'dot disconnected';
        label.textContent = '断开';
        // 自动重连（SSE 内置机制）
    }};
}}
</script>
</body>
</html>"""


# ─── 预览服务器 ──────────────────────────────────────────────

class PreviewServer:
    """doc-ultra 预览服务器。

    启动 HTTP 服务 + 文件监听，提供 Markdown 文件实时可视化。

    两种模式：
    - pipeline 模式：关联流水线产物（默认）
    - file 模式：独立预览任意 .md 文件，每次保存=新快照
    """

    def __init__(
        self,
        work_dir: Path,
        port: int = 8765,
        original_file: Optional[Path] = None,
        open_browser: bool = True,
        mode: str = "pipeline",
    ):
        """初始化预览服务器。

        Args:
            work_dir: 工作目录（.doc-ultra/ 或文件所在目录）
            port: HTTP 端口
            original_file: 原始输入文件路径（可选）
            open_browser: 是否自动打开浏览器
            mode: 'pipeline' 关联流水线 | 'file' 独立文件预览
        """
        self.work_dir = work_dir
        self.port = port
        self.original_file = original_file
        self.open_browser = open_browser
        self.mode = mode
        self.snapshots = SnapshotManager(work_dir)
        self.watcher: Optional[FileWatcher] = None
        self._httpd: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """启动服务器 + 文件监听。"""
        # 0. 检查端口是否可用，自动清理旧进程
        _check_sock = socket.socket()
        try:
            _check_sock.bind(("127.0.0.1", self.port))
            _check_sock.close()
        except OSError:
            _check_sock.close()
            # 尝试自动清理占用端口的进程
            import subprocess
            print(f"端口 {self.port} 被占用，尝试自动清理...")
            try:
                result = subprocess.run(
                    ["netstat", "-ano"], capture_output=True, text=True, timeout=5
                )
                pids = set()
                for line in result.stdout.splitlines():
                    if f"127.0.0.1:{self.port}" in line and "LISTENING" in line:
                        parts = line.strip().split()
                        if parts:
                            try:
                                pids.add(int(parts[-1]))
                            except ValueError:
                                pass
                if pids:
                    for pid in pids:
                        subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                                       capture_output=True, timeout=3)
                    time.sleep(0.5)
                    print(f"已清理占用进程 (PID: {', '.join(map(str,pids))})")
                else:
                    print("未找到占用进程，等待端口释放...")
                    time.sleep(2)
            except Exception:
                time.sleep(2)
        finally:
            try: _check_sock.close()
            except Exception: pass
        # 1. 根据模式初始化快照
        if self.mode == "file" and self.original_file:
            self.snapshots.init_file_history(self.original_file)
        elif self.original_file and self.original_file.exists():
            content = self.original_file.read_text(encoding="utf-8")
            self.snapshots.set_original(content)
            # 也将原始文件添加到工作目录快照中
            self.snapshots.add_file("ORIG", "原始文件", self.original_file)
            # 2. 扫描现有中间产物
            self.snapshots.scan()

        # 2.5 流水线模式扫描中间产物（如果没有 original_file 或 file 模式）
        if self.mode == "pipeline" and not self.original_file:
            self.snapshots.scan()

        # 3. 设置 HTTP 处理器
        PreviewHandler.snapshots = self.snapshots
        global PREVIEW_PORT
        PREVIEW_PORT = self.port

        # 4. 启动 HTTP 服务器（多线程 + SO_REUSEADDR，防止端口阻塞）
        self._httpd = ReuseAddrThreadingHTTPServer(("127.0.0.1", self.port), PreviewHandler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()

        # 5. 启动文件监听
        self._start_watcher()

        # 6. 自动打开浏览器
        if self.open_browser:
            url = f"http://127.0.0.1:{self.port}/"
            threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()

    def _start_watcher(self) -> None:
        """启动文件监听。"""
        if self.mode == "file" and self.original_file:
            # 单文件模式：仅监听目标文件所在目录
            watch_dir = self.original_file.parent
            _target_resolved = self.original_file.resolve()
            def on_file_change(event: FileChangeEvent) -> None:
                file_path = event.file_path
                # 使用路径比较（而非 inode/samefile），
                # 因为编辑器原子保存（rename over）会改变 inode
                if file_path.resolve() != _target_resolved:
                    return
                # 短暂延迟，等待文件写入完成
                import time as _time
                _time.sleep(0.5)
                changed = self.snapshots.record_file_snapshot(file_path)
                if changed:
                    # 重新读取版本列表，广播完整快照信息
                    versions_data = [v.to_dict() for v in self.snapshots.get_all_versions()]
                    new_version = f"V{len(self.snapshots._file_history) - 1}"
                    _sse_manager.broadcast(
                        "file_changed",
                        json.dumps({
                            "file": str(file_path),
                            "event": event.event_type,
                            "new_version": new_version,
                            "versions": versions_data,
                        }, ensure_ascii=False),
                    )
        else:
            # 流水线模式：监听整个工作目录
            watch_dir = self.work_dir
            def on_file_change(event: FileChangeEvent) -> None:
                changed = self.snapshots.on_file_changed(event.file_path)
                if changed:
                    _sse_manager.broadcast(
                        "file_changed",
                        json.dumps({
                            "file": str(event.file_path),
                            "event": event.event_type,
                        }, ensure_ascii=False),
                    )

        self.watcher = FileWatcher(watch_dir, on_file_change)
        self.watcher.start()

    def stop(self) -> None:
        """停止服务器（释放端口、停止文件监听）。"""
        if self.watcher:
            self.watcher.stop()
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)

    def wait(self) -> None:
        """等待服务器停止。按 Ctrl+C 可安全退出。"""
        if self._thread:
            try:
                # 使用 while 轮询代替 join，确保 KeyboardInterrupt 能及时响应
                while self._thread.is_alive():
                    self._thread.join(timeout=0.5)
            except KeyboardInterrupt:
                self.stop()

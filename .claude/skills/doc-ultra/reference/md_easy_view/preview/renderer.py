"""MD → HTML 渲染器。

将 Markdown 渲染为精美的语义化 HTML，贯彻 Karpathy 视觉优先理念。
功能：
- 按标题分割章节并卡片化
- 注入 data-line-id 行号锚点供 Diff 层定位
- 响应式布局 + 深色模式
"""

import re
from typing import Optional


# ─── 内联 CSS 主题 ───────────────────────────────────────────

INLINE_CSS = """\
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #1a1a2e;
    background: #f8f9fc;
    padding: 0;
    margin: 0;
}
@media (prefers-color-scheme: dark) {
    body {
        color: #e2e2e8;
        background: #0f0f14;
    }
    .section-card {
        background: #1a1a22;
        border-color: #2a2a35;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .section-card:hover {
        border-color: #4a4a8a;
        box-shadow: 0 4px 16px rgba(99,102,241,0.12);
    }
    .card-header h2, .card-header h3, .card-header h4 {
        color: #e8e8f0;
    }
    .card-header {
        background: linear-gradient(135deg, #1e1e28 0%, #181820 100%);
    }
    .card-header:hover {
        background: linear-gradient(135deg, #252535 0%, #1e1e2e 100%);
    }
    .card-header .section-index {
        box-shadow: 0 2px 6px rgba(99,102,241,0.3);
    }
    .card-body table { color: #d0d0d8; }
    .card-body th { background: #252530; }
    .card-body td { border-color: #2e2e3a; }
    .card-body tr:nth-child(even) td { background: #1c1c24; }
    .card-body tr:hover td { background: #252535; }
    .card-body code { background: #2a2a32; color: #e8b4b4; }
    .card-body pre { background: #12121a; border-color: #2e2e38; }
    .card-body blockquote { border-left-color: #4a4a60; color: #a0a0b0; }
    .diff-added { background: rgba(34, 197, 94, 0.22) !important; }
    .diff-removed { background: rgba(239, 68, 68, 0.22) !important; }
    .diff-changed { background: rgba(234, 179, 8, 0.25) !important; }
    .diff-tooltip { background: #2a2a32; border-color: #3e3e48; }
}

/* ─── 布局 ─── */
.doc-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.5rem;
}

/* ─── 标题 ─── */
.doc-title {
    font-size: 1.85rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 0.75rem;
    padding-bottom: 0.6rem;
    border-bottom: 3px solid transparent;
    border-image: linear-gradient(90deg, #3b82f6, #6366f1, #a855f7) 1;
    background: linear-gradient(90deg, #1e293b, #334155);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.doc-subtitle {
    font-size: 0.9rem;
    color: #888;
    margin-bottom: 1.5rem;
}
@media (prefers-color-scheme: dark) {
    .doc-title { background: linear-gradient(90deg, #e2e2e8, #c0c0d0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .doc-subtitle { color: #888; }
}

/* ─── 卡片章节 ─── */
.section-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-bottom: 1.25rem;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    content-visibility: auto;
    contain-intrinsic-size: auto 300px;
}
.section-card:hover {
    border-color: #93b4f5;
    box-shadow: 0 4px 16px rgba(59,130,246,0.08);
    transform: translateY(-1px);
}
.card-header {
    display: flex;
    align-items: center;
    padding: 0.85rem 1.25rem;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #fafbfc 0%, #f1f5f9 100%);
    transition: background 0.2s;
}
.card-header:hover {
    background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
}
.card-header .collapse-icon {
    margin-right: 0.6rem;
    font-size: 0.75rem;
    color: #94a3b8;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s;
    flex-shrink: 0;
}
.card-header:hover .collapse-icon {
    color: #3b82f6;
}
.card-header.collapsed .collapse-icon {
    transform: rotate(-90deg);
}
.card-header h2,
.card-header h3,
.card-header h4 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    flex: 1;
}
.card-header .section-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    margin-right: 0.7rem;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(59,130,246,0.25);
}
.card-body {
    padding: 1rem 1.25rem;
    overflow-x: auto;
    max-height: 8000px;
    opacity: 1;
    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.25s ease,
                padding 0.3s ease;
}
.card-body.collapsed {
    max-height: 0;
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
    overflow: hidden;
}

/* ─── 内联元素 ─── */
.card-body p {
    margin-bottom: 0.75rem;
}
.card-body p:last-child {
    margin-bottom: 0;
}
.card-body ul, .card-body ol {
    margin: 0.5rem 0 0.75rem 1.5rem;
}
.card-body li {
    margin-bottom: 0.25rem;
}
.card-body a {
    color: #3b82f6;
    text-decoration: none;
}
.card-body a:hover {
    text-decoration: underline;
}
.card-body strong { font-weight: 600; }

/* ─── 表格 ─── */
.card-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.9rem;
}
.card-body th {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 2px solid #e2e8f0;
}
.card-body td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
}
.card-body tr:nth-child(even) td {
    background: #fafbfc;
}
.card-body tr:hover td {
    background: #eef2ff;
}
.card-body .diff-marker-cell {
    width: 1.8rem;
    min-width: 1.8rem;
    text-align: center;
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.5rem 0.2rem !important;
    vertical-align: middle;
    border-bottom: none;
}
.card-body tr[data-diff="added"] {
    background: rgba(34, 197, 94, 0.08) !important;
}
.card-body tr[data-diff="removed"] {
    background: rgba(239, 68, 68, 0.08) !important;
}
.card-body tr[data-diff="changed"] {
    background: rgba(234, 179, 8, 0.08) !important;
}
.card-body .diff-tooltip {
    display: none;
    position: absolute;
    left: 0;
    bottom: 100%;
    z-index: 100;
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    padding: 0.5rem;
    min-width: 280px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    font-size: 0.8rem;
}
.card-body tr[data-diff]:hover .diff-tooltip {
    display: block;
}

/* ─── 代码 ─── */
.card-body code {
    font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
    font-size: 0.85em;
    background: #f1f5f9;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    color: #c7254e;
}
.card-body pre {
    background: #f8f9fc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    margin: 0.75rem 0;
}
.card-body pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: 0.85rem;
    line-height: 1.6;
}

/* ─── 引用 ─── */
.card-body blockquote {
    border-left: 3px solid #3b82f6;
    padding: 0.5rem 1rem;
    margin: 0.75rem 0;
    color: #555;
    background: rgba(59, 130, 246, 0.04);
    border-radius: 0 6px 6px 0;
}

/* ─── 水平线 ─── */
.card-body hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1rem 0;
}

/* ─── Diff 样式 ─── */
.diff-added {
    background: rgba(34, 197, 94, 0.18) !important;
    border-left: 4px solid #22c55e !important;
}
.diff-removed {
    background: rgba(239, 68, 68, 0.18) !important;
    border-left: 4px solid #ef4444 !important;
    text-decoration: line-through;
    text-decoration-color: rgba(239, 68, 68, 0.4);
}
.diff-changed {
    background: rgba(234, 179, 8, 0.20) !important;
    border-left: 4px solid #eab308 !important;
}
.diff-line-marker {
    display: inline-block;
    min-width: 1.4rem;
    font-weight: 700;
    font-size: 0.75rem;
    margin-right: 0.4rem;
    text-align: center;
    border-radius: 3px;
    padding: 0.05rem 0.2rem;
}
.diff-line-marker.added { color: #fff; background: #22c55e; }
.diff-line-marker.removed { color: #fff; background: #ef4444; }
.diff-line-marker.changed { color: #fff; background: #eab308; }
.diff-line-marker.unchanged { color: transparent; background: transparent; }
.diff-line-marker:empty { display: none; }

.line-with-diff {
    position: relative;
    cursor: pointer;
    border-radius: 3px;
    padding: 0.1rem 0.3rem;
    margin: 0 -0.3rem;
    transition: background 0.15s, transform 0.15s;
}
.line-with-diff.added:hover,
.line-with-diff.removed:hover,
.line-with-diff.changed:hover {
    transform: scale(1.01);
    z-index: 10;
}
.line-with-diff:hover .diff-tooltip {
    display: block;
}

.diff-tooltip {
    display: none;
    position: absolute;
    left: 0;
    top: 100%;
    z-index: 9999;
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    min-width: 320px;
    max-width: 600px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.15);
    font-size: 0.85rem;
    line-height: 1.5;
    margin-top: 6px;
}
.diff-tooltip::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 12px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid #fff;
}
.diff-tooltip-header {
    font-weight: 700;
    margin-bottom: 0.4rem;
    color: #555;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.diff-tooltip-old {
    background: #fef2f2;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    margin-bottom: 0.3rem;
    border-left: 3px solid #ef4444;
    font-size: 0.82rem;
}
.diff-tooltip-old::before {
    content: "旧: ";
    font-weight: 600;
    color: #ef4444;
    font-size: 0.7rem;
}
.diff-tooltip-new {
    background: #f0fdf4;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    border-left: 3px solid #22c55e;
    font-size: 0.82rem;
}
.diff-tooltip-new::before {
    content: "新: ";
    font-weight: 600;
    color: #22c55e;
    font-size: 0.7rem;
}
@media (prefers-color-scheme: dark) {
    .diff-tooltip { background: #2a2a32; border-color: #3e3e48; }
    .diff-tooltip::before { border-bottom-color: #2a2a32; }
    .diff-tooltip-old { background: rgba(239,68,68,0.15); }
    .diff-tooltip-new { background: rgba(34,197,94,0.15); }
    .diff-tooltip { box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
}

/* ─── 文本行支架 ─── */
.text-line {
    display: block;
    padding: 0.1rem 0.3rem;
    margin: 0 -0.3rem;
    border-left: 3px solid transparent;
    border-radius: 2px;
}

/* ─── Mermaid 图表 ─── */
.mermaid-container {
    margin: 1rem 0;
    padding: 1rem;
    background: #fafbfc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow-x: auto;
    text-align: center;
}
.mermaid-container .mermaid {
    display: flex;
    justify-content: center;
    min-height: 40px;
}
.mermaid-container .mermaid svg {
    max-width: 100%;
    height: auto;
}
.mermaid-container .mermaid-fallback {
    text-align: left;
}
.mermaid-container .mermaid-fallback pre {
    margin: 0;
    border: 2px dashed #fbbf24;
    background: #fffbeb;
}
.mermaid-error-icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    background: #ef4444;
    border-radius: 50%;
    color: #fff;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    margin-right: 0.35rem;
    vertical-align: middle;
}
@media (prefers-color-scheme: dark) {
    .mermaid-container {
        background: #1e1e24;
        border-color: #2e2e38;
    }
    .mermaid-container .mermaid-fallback pre {
        border-color: #eab308;
        background: rgba(234,179,8,0.08);
    }
}
"""

# ─── 内联 JS ─────────────────────────────────────────────────

INLINE_JS = """\
// 卡片折叠/展开
document.querySelectorAll('.card-header').forEach(function(header) {
    header.addEventListener('click', function() {
        var body = this.nextElementSibling;
        var isCollapsed = body.classList.toggle('collapsed');
        this.classList.toggle('collapsed');
    });
});
"""


# ─── MD 解析器 ───────────────────────────────────────────────

def _escape_html(text: str) -> str:
    """转义 HTML 特殊字符。"""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    return text


def _render_inline(text: str) -> str:
    """渲染行内 Markdown 语法。"""
    # 代码 `code`
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # 加粗 **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # 斜体 *text*
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    # 链接 [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    return text


def _render_table_line(line: str, abs_line: int = 0,
                       line_state: str = "", old_text: str = "") -> str:
    """渲染表格行。"""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    tag = "th" if re.match(r'^[:\- ]+$', line.strip().strip("|").split("|")[0].strip()) else "td"
    # 检查是否为分隔行
    if all(re.match(r'^[:\- ]+$', c.strip()) for c in cells):
        return ""
    cells_html = "".join(f"<{tag}>{_render_inline(c)}</{tag}>" for c in cells)
    mark = {"added": "+", "removed": "-", "changed": "~"}.get(line_state, "")
    diff_marker = f'<{tag} class="diff-marker-cell">{mark}</{tag}>'
    tooltip_html = _diff_tooltip(line_state, old_text, line.strip())
    line_attr = f' data-line-id="{abs_line}"'
    if line_state:
        line_attr += f' data-diff="{line_state}"'
    return f'<tr{line_attr}>{diff_marker}{cells_html}<{tag}>{tooltip_html}</{tag}></tr>'


def split_sections(md_text: str) -> list[dict]:
    """将 Markdown 按标题分割为章节块。

    返回:
        [{level, title, content_lines, start_line, end_line}]
    """
    lines = md_text.split("\n")
    sections: list[dict] = []
    current: Optional[dict] = None

    # 第一个 h1 作为文档标题
    doc_title_line = None
    # 跟踪代码块状态，忽略代码块内的 ## 标题
    in_code_block = False

    for i, line in enumerate(lines):
        # 检测代码块围栏
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if header_match and not in_code_block:
            if current:
                current["content_lines"] = lines[current["start_line"]:i]
                current["end_line"] = i
                sections.append(current)

            level = len(header_match.group(1))
            title = header_match.group(2).strip()
            current = {
                "level": level,
                "title": title,
                "start_line": i,
                "end_line": i,
                "content_lines": [],
            }

            if level == 1 and doc_title_line is None:
                doc_title_line = title
                current = None
                continue

            # 只对 h2+ 做卡片
            if level < 2:
                current = None
                continue

    # 最后一个章节
    if current:
        current["content_lines"] = lines[current["start_line"]:]
        current["end_line"] = len(lines)
        sections.append(current)

    # 如果没有任何 h2，则整篇做一个章节
    if not sections:
        # 查找 h1
        h1_match = re.search(r'^#\s+(.+)$', md_text, re.MULTILINE)
        title = h1_match.group(1) if h1_match else "文档内容"
        sections.append({
            "level": 2,
            "title": title,
            "start_line": 0,
            "end_line": len(lines),
            "content_lines": lines[:],
        })

    return sections


def render_section_html(section: dict, section_index: int,
                         line_states: Optional[dict[int, str]] = None,
                         line_old_texts: Optional[dict[int, str]] = None) -> str:
    """将单个章节渲染为 HTML 卡片。

    Args:
        section: split_sections 返回的章节块
        section_index: 章节序号（用于显示）
        line_states: {line_number: 'added'|'removed'|'changed'|'unchanged'}
        line_old_texts: {line_number: '旧文本'} 用于 tooltip
    """
    if line_states is None:
        line_states = {}
    if line_old_texts is None:
        line_old_texts = {}

    tag = f"h{section['level']}"
    title_html = _render_inline(section["title"])

    lines = section["content_lines"]

    # 第一行是标题本身，跳过
    body_lines = []
    in_table = False
    in_code_block = False
    code_lines: list[str] = []
    in_ul = False
    in_ol = False

    for li, raw_line in enumerate(lines):
        abs_line = section["start_line"] + li

        # 跳过标题行
        if li == 0 and re.match(r'^#{2,6}\s+', raw_line):
            continue

        line_state = line_states.get(abs_line, "")
        old_text = line_old_texts.get(abs_line, "")

        # 代码块
        if raw_line.strip().startswith("```"):
            if in_code_block:
                code_lines.append(raw_line)
                html = _render_code_block(code_lines, abs_line, line_state, old_text)
                body_lines.append(html)
                code_lines = []
                in_code_block = False
            else:
                code_lines = [raw_line]
                in_code_block = True
            continue

        if in_code_block:
            code_lines.append(raw_line)
            continue

        # 表格
        if raw_line.strip().startswith("|") and raw_line.strip().endswith("|"):
            if not in_table:
                body_lines.append(f'<div class="table-wrap" data-line-id="{abs_line}">')
                body_lines.append('<table>')
                in_table = True
            tr_html = _render_table_line(raw_line, abs_line, line_state, old_text)
            if tr_html:
                body_lines.append(tr_html)
            continue
        else:
            if in_table:
                body_lines.append('</table>')
                body_lines.append('</div>')
                in_table = False

        # 空行
        if not raw_line.strip():
            body_lines.append("")
            continue

        # 段落
        line_attr = f' data-line-id="{abs_line}"'
        if line_state:
            line_attr += f' data-diff="{line_state}"'

        # 无序列表
        if re.match(r'^[\*\-\+]\s+', raw_line):
            if in_ol:
                body_lines.append('</ol>')
                in_ol = False
            if not in_ul:
                body_lines.append('<ul>')
                in_ul = True
            content = re.sub(r'^[\*\-\+]\s+', '', raw_line)
            body_lines.append(
                f'<li{line_attr}>'
                f'<span class="line-with-diff {line_state}">'
                f'<span class="diff-line-marker {line_state}">'
                f'{"+" if line_state=="added" else "-" if line_state=="removed" else "~" if line_state=="changed" else ""}'
                f'</span>{_render_inline(content)}'
                f'{_diff_tooltip(line_state, old_text, _render_inline(content))}'
                f'</span></li>'
            )
            continue
        else:
            if in_ul:
                body_lines.append('</ul>')
                in_ul = False

        # 有序列表
        if re.match(r'^\d+\.\s+', raw_line):
            if in_ul:
                body_lines.append('</ul>')
                in_ul = False
            if not in_ol:
                body_lines.append('<ol>')
                in_ol = True
            content = re.sub(r'^\d+\.\s+', '', raw_line)
            body_lines.append(
                f'<li{line_attr}>'
                f'<span class="line-with-diff {line_state}">'
                f'<span class="diff-line-marker {line_state}">'
                f'{"+" if line_state=="added" else "-" if line_state=="removed" else "~" if line_state=="changed" else ""}'
                f'</span>{_render_inline(content)}'
                f'{_diff_tooltip(line_state, old_text, _render_inline(content))}'
                f'</span></li>'
            )
            continue
        else:
            if in_ol:
                body_lines.append('</ol>')
                in_ol = False

        # 引用
        if raw_line.strip().startswith(">"):
            content = re.sub(r'^>\s?', '', raw_line)
            body_lines.append(
                f'<blockquote{line_attr}>'
                f'<span class="line-with-diff {line_state}">'
                f'{_diff_tooltip(line_state, old_text, _render_inline(content))}'
                f'{_render_inline(content)}'
                f'</span></blockquote>'
            )
            continue

        # 分隔线
        if re.match(r'^---+\s*$', raw_line):
            body_lines.append(f'<hr{line_attr}>')
            continue

        # 普通段落
        body_lines.append(
            f'<p{line_attr}>'
            f'<span class="line-with-diff {line_state}">'
            f'<span class="diff-line-marker {line_state}">'
            f'{"+" if line_state=="added" else "-" if line_state=="removed" else "~" if line_state=="changed" else ""}'
            f'</span>{_render_inline(raw_line.strip())}'
            f'{_diff_tooltip(line_state, old_text, _render_inline(raw_line.strip()))}'
            f'</span></p>'
        )

    # 关闭未闭合的标签
    if in_table:
        body_lines.append('</table>')
        body_lines.append('</div>')
    if in_code_block and code_lines:
        body_lines.append(_render_code_block(code_lines, abs_line if 'abs_line' in dir() else 0, "", ""))
    if in_ul:
        body_lines.append('</ul>')
    if in_ol:
        body_lines.append('</ol>')

    header_html = (
        f'<div class="card-header" data-section-index="{section_index}">'
        f'<span class="collapse-icon">&#9660;</span>'
        f'<span class="section-index">{section_index}</span>'
        f'<{tag}>{title_html}</{tag}>'
        f'</div>'
    )
    body_html = (
        f'<div class="card-body">'
        f'{"".join(body_lines)}'
        f'</div>'
    )

    return f'<div class="section-card">{header_html}{body_html}</div>'


def _render_code_block(lines: list[str], start_line: int,
                       line_state: str, old_text: str) -> str:
    """渲染代码块。"""
    if not lines:
        return ""
    # 第一行是 ```lang
    lang = lines[0].strip().lstrip("`").strip() if lines else ""
    code_content = "\n".join(lines[1:-1]) if len(lines) > 1 else ""

    line_attr = f' data-line-id="{start_line}"'
    if line_state:
        line_attr += f' data-diff="{line_state}"'

    # Mermaid / 图形语法支持 — 渲染为 mermaid 容器以便 Mermaid.js 自动处理
    _MERMAID_LANGS = {"mermaid", "graphviz", "dot", "mmd"}
    if lang and lang.lower() in _MERMAID_LANGS:
        escaped_content = _escape_html(code_content)
        return (
            f'<div class="line-with-diff {line_state}"{line_attr}>'
            f'<div class="mermaid-container">'
            f'<div class="mermaid">'
            f'{code_content}'
            f'</div>'
            f'<div class="mermaid-fallback" style="display:none;">'
            f'<pre><code class="language-{_escape_html(lang)}">'
            f'{escaped_content}'
            f'</code></pre>'
            f'</div>'
            f'</div>'
            f'{_diff_tooltip(line_state, old_text, escaped_content)}'
            f'</div>'
        )

    return (
        f'<div class="line-with-diff {line_state}"{line_attr}>'
        f'<pre><code class="language-{_escape_html(lang)}">'
        f'{_escape_html(code_content)}'
        f'</code></pre>'
        f'{_diff_tooltip(line_state, old_text, _escape_html(code_content))}'
        f'</div>'
    )


def _diff_tooltip(line_state: str, old_text: str, new_text: str) -> str:
    """生成悬浮提示的 tooltip HTML。"""
    if not line_state or line_state == "unchanged":
        return ""
    tooltip = '<div class="diff-tooltip">'
    tooltip += '<div class="diff-tooltip-header">修订详情</div>'
    if old_text:
        tooltip += f'<div class="diff-tooltip-old">{old_text}</div>'
    if new_text:
        tooltip += f'<div class="diff-tooltip-new">{new_text}</div>'
    tooltip += '</div>'
    return tooltip


def compute_diff_lines(text_a: str, text_b: str) -> tuple[dict[int, str], dict[int, str]]:
    """计算两个文本之间的行级差异。

    以 text_b 为基准，标记 text_b 中每一行的 diff 状态：
    - 'added': 在 text_b 中新增（text_a 中没有）
    - 'removed': 在 text_b 中被删除（实际标记在 text_b 的上下文中）
    - 'changed': 内容变化
    - 'unchanged': 未变化

    同时返回旧文本映射 {line_number_in_b: old_text}

    返回:
        (line_states, line_old_texts)
    """
    import difflib

    lines_a = text_a.split("\n")
    lines_b = text_b.split("\n")

    matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
    line_states: dict[int, str] = {}
    line_old_texts: dict[int, str] = {}

    # 存储被删除行的索引和内容，用于相邻行的 removed 标记
    removed_lines: list[tuple[int, str]] = []

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for j in range(j1, j2):
                line_states[j] = "unchanged"
        elif op == "insert":
            for j in range(j1, j2):
                line_states[j] = "added"
                if removed_lines:
                    old_texts = "\n".join(t[1] for t in removed_lines)
                    line_old_texts[j] = old_texts
                    removed_lines = []
        elif op == "delete":
            for i in range(i1, i2):
                removed_lines.append((i, lines_a[i]))
                # 将删除映射到 text_b 中最近的上下文行
                ctx_line = min(j1, len(lines_b) - 1) if j1 < len(lines_b) else len(lines_b) - 1
                if ctx_line >= 0:
                    line_states[ctx_line] = "removed"
                    if ctx_line not in line_old_texts:
                        line_old_texts[ctx_line] = ""
                    line_old_texts[ctx_line] = lines_a[i]
        elif op == "replace":
            for j in range(j1, j2):
                line_states[j] = "changed"
                if i1 < i2:
                    idx = min(i1 + (j - j1), i2 - 1)
                    old = lines_a[idx] if idx < len(lines_a) else ""
                    if j in line_old_texts:
                        line_old_texts[j] += "\n" + old
                    else:
                        line_old_texts[j] = old

    return line_states, line_old_texts


def render_full_html(
    title: str,
    sections_html: list[str],
    extra_css: str = "",
    extra_js: str = "",
) -> str:
    """生成完整 HTML 文档。"""
    sections_body = "\n".join(sections_html)

    return f"""\
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_escape_html(title)} - doc-ultra Preview</title>
<style>
{INLINE_CSS}
{extra_css}
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
(function() {{
    var _MERMAID_SELECTOR = '.mermaid';
    var _initCalled = false;

    function initMermaid() {{
        if (_initCalled) return;
        _initCalled = true;
        try {{
            mermaid.initialize({{
                startOnLoad: true,
                theme: 'default',
                securityLevel: 'sandbox',
                logLevel: 'error',
            }});
            // 手动触发渲染（某些情况下 startOnLoad 可能不触发）
            setTimeout(function() {{
                var els = document.querySelectorAll(_MERMAID_SELECTOR);
                if (els.length > 0 && typeof mermaid.run === 'function') {{
                    mermaid.run({{ nodes: els }}).catch(function() {{}});
                }}
            }}, 200);
        }} catch(e) {{
            console.warn('Mermaid init failed:', e);
            showMermaidFallbacks();
        }}
    }}

    function showMermaidFallbacks() {{
        var containers = document.querySelectorAll('.mermaid-container');
        containers.forEach(function(c) {{
            var svg = c.querySelector('.mermaid svg');
            var fallback = c.querySelector('.mermaid-fallback');
            if (fallback && (!svg || svg.clientWidth === 0)) {{
                c.querySelector('.mermaid').style.display = 'none';
                fallback.style.display = 'block';
            }}
        }});
    }}

    // 如果 CDN 加载失败，显示 fallback
    if (typeof mermaid === 'undefined') {{
        // mermaid CDN 加载失败，延迟检查
        setTimeout(function() {{
            if (typeof mermaid === 'undefined') {{
                showMermaidFallbacks();
            }} else {{
                initMermaid();
            }}
        }}, 3000);
    }} else {{
        initMermaid();
    }}

    // 渲染完成后检查是否有失败的图表
    window.addEventListener('load', function() {{
        setTimeout(showMermaidFallbacks, 1000);
    }});
}})();
</script>
</head>
<body>
<div class="doc-container">
<h1 class="doc-title">{_escape_html(title)}</h1>
{sections_body}
</div>
<script>
{INLINE_JS}
{extra_js}
</script>
</body>
</html>"""


def render_md_to_html(md_text: str, title: str = "文档预览",
                       line_states: Optional[dict[int, str]] = None,
                       line_old_texts: Optional[dict[int, str]] = None) -> str:
    """将 Markdown 文本渲染为完整 HTML。

    Args:
        md_text: Markdown 文本
        title: 页面标题
        line_states: Diff 行状态标记
        line_old_texts: Diff 旧文本映射

    Returns:
        完整 HTML 字符串
    """
    if line_states is None:
        line_states = {}
    if line_old_texts is None:
        line_old_texts = {}

    sections = split_sections(md_text)
    sections_html: list[str] = []

    for i, section in enumerate(sections, 1):
        html = render_section_html(section, i, line_states, line_old_texts)
        sections_html.append(html)

    return render_full_html(title, sections_html)


def render_overlay_diff_html(
    title: str,
    text_a: str,
    text_b: str,
) -> str:
    """渲染覆盖视图（修订模式）的 HTML。

    基于 text_b，标记新增/删除/修改行，悬浮时显示原文 tooltip。
    """
    sections = split_sections(text_b)
    line_states, line_old_texts = compute_diff_lines(text_a, text_b)

    sections_html: list[str] = []
    for i, section in enumerate(sections, 1):
        html = render_section_html(section, i, line_states, line_old_texts)
        sections_html.append(html)

    return render_full_html(title, sections_html)

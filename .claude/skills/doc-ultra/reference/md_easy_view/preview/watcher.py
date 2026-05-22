"""文件变更监听器。

支持两种模式：
1. watchdog 模式（推荐）：使用 watchdog 库监听文件系统事件
2. 轮询模式（fallback）：每 1s 检查文件 mtime
"""

import os
import time
import threading
from pathlib import Path
from typing import Callable, Optional

# 尝试导入 watchdog
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False
    # 创建空桩类，确保类定义不会因 NameError 失败
    FileSystemEventHandler = object


class FileChangeEvent:
    """文件变更事件。"""

    def __init__(self, file_path: Path, event_type: str):
        self.file_path = file_path  # 变更的文件路径
        self.event_type = event_type  # 'modified', 'created', 'deleted'


class _WatchdogHandler(FileSystemEventHandler):
    """watchdog 事件处理器。"""

    def __init__(self, callback: Callable[[FileChangeEvent], None],
                 extensions: set[str]):
        self.callback = callback
        self.extensions = extensions

    def _should_handle(self, path: str) -> bool:
        _, ext = os.path.splitext(path)
        return ext.lower() in self.extensions

    def on_modified(self, event):
        if not event.is_directory and self._should_handle(event.src_path):
            self.callback(FileChangeEvent(
                file_path=Path(event.src_path),
                event_type="modified",
            ))

    def on_created(self, event):
        if not event.is_directory and self._should_handle(event.src_path):
            self.callback(FileChangeEvent(
                file_path=Path(event.src_path),
                event_type="created",
            ))


class _PollingWatcher:
    """轮询模式的文件监听器。"""

    def __init__(self, watch_dir: Path, callback: Callable[[FileChangeEvent], None],
                 extensions: set[str], interval: float = 1.0):
        self.watch_dir = watch_dir
        self.callback = callback
        self.extensions = extensions
        self.interval = interval
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._file_mtimes: dict[str, float] = {}

    def start(self) -> None:
        """启动轮询线程。"""
        self._running = True
        self._scan_initial()
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """停止轮询。"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def _scan_initial(self) -> None:
        """初始扫描，记录所有文件的 mtime。"""
        if not self.watch_dir.exists():
            return
        for f in self.watch_dir.iterdir():
            if f.is_file() and f.suffix.lower() in self.extensions:
                self._file_mtimes[str(f)] = f.stat().st_mtime

    def _poll_loop(self) -> None:
        """轮询循环。"""
        while self._running:
            try:
                self._poll_once()
            except Exception:
                pass
            time.sleep(self.interval)

    def _poll_once(self) -> None:
        """执行一次轮询检查。"""
        if not self.watch_dir.exists():
            return

        current_files: set[str] = set()
        for f in self.watch_dir.iterdir():
            if not f.is_file():
                continue
            if f.suffix.lower() not in self.extensions:
                continue

            fpath = str(f)
            current_files.add(fpath)
            current_mtime = f.stat().st_mtime
            prev_mtime = self._file_mtimes.get(fpath)

            if prev_mtime is None:
                # 新文件
                self._file_mtimes[fpath] = current_mtime
                self.callback(FileChangeEvent(
                    file_path=f,
                    event_type="created",
                ))
            elif abs(current_mtime - prev_mtime) > 0.1:
                # 文件被修改
                # 避免重复触发：同一文件的修改事件在 interval 内只触发一次
                # 通过只处理大于 prev_mtime 的 mtime 来避免
                if current_mtime > prev_mtime:
                    self._file_mtimes[fpath] = current_mtime
                    self.callback(FileChangeEvent(
                        file_path=f,
                        event_type="modified",
                    ))

        # 检测被删除的文件
        deleted = set(self._file_mtimes.keys()) - current_files
        for fpath in deleted:
            del self._file_mtimes[fpath]


class FileWatcher:
    """文件变更监听器。

    自动选择可用模式：watchdog > 轮询。

    用法:
        def on_change(event: FileChangeEvent):
            print(f"{event.event_type}: {event.file_path}")

        watcher = FileWatcher(Path(".doc-ultra"), on_change)
        watcher.start()
        # ...
        watcher.stop()
    """

    def __init__(
        self,
        watch_dir: Path,
        callback: Callable[[FileChangeEvent], None],
        extensions: Optional[set[str]] = None,
        poll_interval: float = 1.0,
    ):
        """初始化文件监听器。

        Args:
            watch_dir: 监听的目录
            callback: 文件变更回调
            extensions: 监听的扩展名集合，默认为 {'.md', '.txt'}
            poll_interval: 轮询间隔（秒），仅在轮询模式下生效
        """
        self.watch_dir = watch_dir
        self.callback = callback
        self.extensions = extensions or {".md", ".txt"}
        self.poll_interval = poll_interval
        self._impl: Optional[_PollingWatcher] = None
        self._watchdog_observer: Optional[object] = None

    def start(self) -> None:
        """启动文件监听。"""
        if not self.watch_dir.exists():
            self.watch_dir.mkdir(parents=True, exist_ok=True)

        if HAS_WATCHDOG:
            self._start_watchdog()
        else:
            self._start_polling()

    def _start_watchdog(self) -> None:
        """启动 watchdog 监听。"""
        handler = _WatchdogHandler(self._on_event, self.extensions)
        self._watchdog_observer = Observer()
        self._watchdog_observer.schedule(handler, str(self.watch_dir), recursive=False)
        self._watchdog_observer.start()

    def _start_polling(self) -> None:
        """启动轮询监听。"""
        self._impl = _PollingWatcher(
            watch_dir=self.watch_dir,
            callback=self._on_event,
            extensions=self.extensions,
            interval=self.poll_interval,
        )
        self._impl.start()

    def stop(self) -> None:
        """停止文件监听。"""
        if self._watchdog_observer:
            self._watchdog_observer.stop()
            self._watchdog_observer.join(timeout=3)
        if self._impl:
            self._impl.stop()

    def _on_event(self, event: FileChangeEvent) -> None:
        """内部事件回调，传给外部 callback。"""
        try:
            self.callback(event)
        except Exception:
            pass

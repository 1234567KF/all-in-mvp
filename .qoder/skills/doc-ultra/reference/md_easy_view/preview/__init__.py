"""md-easy-view 预览服务包。

提供 Web 服务，实时可视化 Markdown 文件变更，支持行级 Diff 对比。
"""

from .server import PreviewServer

__all__ = ["PreviewServer"]

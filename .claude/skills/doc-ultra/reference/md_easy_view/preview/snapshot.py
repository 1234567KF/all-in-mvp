"""版本快照管理。

管理 .doc-ultra/ 目录中的中间产物版本，支持按流水线阶段排序、
文件 hash 校验、通用模式（任意 MD 文件）、单文件变更历史追踪。
"""

import hashlib
import time
from pathlib import Path
from typing import Optional

# 流水线阶段文件名前缀 → 排序键、显示名称
PIPELINE_STAGES: list[tuple[str, str, str]] = [
    ("stage0", "V1", "需求解析"),
    ("stage1-draft-radical", "V2", "激进优化"),
    ("stage1-draft-conservative", "V3", "保守优化"),
    ("stage1-draft-balanced", "V4", "均衡优化"),
    ("stage2-draft-fused", "V5", "融合合成"),
    ("stage3-draft-checked", "V6", "检查完成"),
    ("stage4-draft-expanded", "V7", "扩写完成"),
    ("stage5-output", "V8", "终稿抛光"),
]


class VersionInfo:
    """单个版本快照信息。"""

    def __init__(
        self,
        version_id: str,
        display_name: str,
        file_path: Path,
        file_hash: str,
        content: Optional[str] = None,
    ):
        self.version_id = version_id  # V0, V1, ..., V8
        self.display_name = display_name  # 原始文件, 需求解析, ...
        self.file_path = file_path
        self.file_hash = file_hash
        self._content = content  # 内存快照（用于单文件模式）

    @property
    def content(self) -> str:
        """读取文件内容。"""
        if self._content is not None:
            return self._content
        if not self.file_path or not self.file_path.exists():
            return ""
        return self.file_path.read_text(encoding="utf-8")

    def to_dict(self) -> dict:
        return {
            "id": self.version_id,
            "name": self.display_name,
            "path": str(self.file_path),
            "hash": self.file_hash,
        }


class SnapshotManager:
    """版本快照管理器。

    职责：
    1. 扫描 .doc-ultra/ 目录，识别所有 .md 中间产物
    2. 按流水线阶段排序
    3. 支持跨阶段对比
    4. 管理用户指定的任意文件快照
    """

    def __init__(self, work_dir: Optional[Path] = None):
        self.work_dir = work_dir or Path(".doc-ultra")  # .doc-ultra/
        self._snapshots: dict[str, VersionInfo] = {}  # version_id → info
        self._original_content: Optional[str] = None  # 原始输入文件内容
        self._file_history: list["VersionInfo"] = []  # 单文件变更历史
        self._tracked_file: Optional[Path] = None  # 正在追踪的文件

    def set_original(self, content: str) -> None:
        """设置原始输入文件（V0）。"""
        self._original_content = content
        h = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
        # V0 作为虚拟快照，无实际文件
        self._snapshots["V0"] = VersionInfo(
            version_id="V0",
            display_name="原始文件",
            file_path=Path(""),
            file_hash=h,
        )

    def get_original_content(self) -> Optional[str]:
        """获取原始输入文件内容。"""
        return self._original_content

    def scan(self) -> None:
        """扫描 .doc-ultra/ 目录，发现所有 .md 文件。"""
        if not self.work_dir.exists():
            return

        # 用已发现的文件更新快照
        found_files: dict[str, Path] = {}
        for f in self.work_dir.glob("*.md"):
            if f.is_file():
                found_files[f.stem] = f

        # 匹配流水线阶段
        for prefix, vid, display_name in PIPELINE_STAGES:
            for stem, path in found_files.items():
                if stem.startswith(prefix):
                    h = self._hash_file(path)
                    self._snapshots[vid] = VersionInfo(
                        version_id=vid,
                        display_name=display_name,
                        file_path=path,
                        file_hash=h,
                    )
                    break

        # 通用模式：未匹配流水线的 .md 文件也收录
        used_prefixes = {p[0] for p in PIPELINE_STAGES}
        other_idx = 100
        for stem, path in found_files.items():
            if not any(stem.startswith(p) for p in used_prefixes):
                vid = f"V{other_idx}"
                self._snapshots[vid] = VersionInfo(
                    version_id=vid,
                    display_name=stem,
                    file_path=path,
                    file_hash=self._hash_file(path),
                )
                other_idx += 1

    def get_version(self, version_id: str) -> Optional[VersionInfo]:
        """获取指定版本的快照信息。"""
        return self._snapshots.get(version_id)

    def get_all_versions(self) -> list[VersionInfo]:
        """获取所有版本，按版本号排序。"""
        def sort_key(v: VersionInfo) -> int:
            try:
                return int(v.version_id[1:])
            except ValueError:
                return 999
        return sorted(self._snapshots.values(), key=sort_key)

    # ─── 单文件变更历史模式 ──────────────────

    def init_file_history(self, file_path: Path) -> None:
        """初始化单文件变更历史追踪。
        
        每次文件保存都会自动产生一个新快照。
        """
        self._tracked_file = file_path
        self._snapshots.clear()
        self._file_history.clear()
        content = file_path.read_text(encoding="utf-8") if file_path.exists() else ""
        h = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
        label = file_path.stem if file_path.stem else "文档"
        ts = time.strftime("%H:%M:%S", time.localtime())
        vi = VersionInfo(
            version_id="V0",
            display_name=f"{label} ({ts})",
            file_path=file_path,
            file_hash=h,
            content=content,
        )
        self._file_history.append(vi)
        self._snapshots["V0"] = vi

    def record_file_snapshot(self, file_path: Path) -> bool:
        """记录文件变更快照。返回 True 表示内容真的有变化。
        
        和 on_file_changed 不同，此方法为每次变更产生一个新版本索引。
        """
        if not file_path.exists():
            return False
        content = file_path.read_text(encoding="utf-8")
        h = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]

        # 去重：和最近一次快照相同则跳过
        if self._file_history:
            last = self._file_history[-1]
            if last.file_hash == h:
                return False

        next_id = f"V{len(self._file_history)}"
        label = file_path.stem if file_path.stem else "文档"
        ts = time.strftime("%H:%M:%S", time.localtime())
        vi = VersionInfo(
            version_id=next_id,
            display_name=f"{label} ({ts})",
            file_path=file_path,
            file_hash=h,
            content=content,
        )
        self._file_history.append(vi)
        self._snapshots[next_id] = vi
        return True

    def get_version_content(self, version_id: str) -> Optional[str]:
        """获取指定版本的渲染内容。"""
        if version_id == "V0" and self._original_content is not None:
            return self._original_content
        v = self.get_version(version_id)
        if v:
            if v._content is not None:
                return v._content
            if v.file_path and v.file_path.exists():
                return v.content
        return None

    def on_file_changed(self, file_path: Path) -> bool:
        """文件变更回调。返回 True 表示有实际变更（hash 不同）。"""
        if not file_path.exists():
            return False
        stem = file_path.stem
        new_hash = self._hash_file(file_path)

        for prefix, vid, _display_name in PIPELINE_STAGES:
            if stem.startswith(prefix):
                existing = self._snapshots.get(vid)
                if existing and existing.file_hash == new_hash:
                    return False  # 内容未变
                # 更新或新增
                self._snapshots[vid] = VersionInfo(
                    version_id=vid,
                    display_name=_display_name,
                    file_path=file_path,
                    file_hash=new_hash,
                )
                return True

        # 通用模式文件
        existing = next(
            (v for v in self._snapshots.values() if v.file_path == file_path),
            None,
        )
        if existing and existing.file_hash == new_hash:
            return False
        if existing:
            self._snapshots[existing.version_id] = VersionInfo(
                version_id=existing.version_id,
                display_name=existing.display_name,
                file_path=file_path,
                file_hash=new_hash,
            )
            return True
        return False

    def add_file(self, version_id: str, display_name: str, file_path: Path) -> None:
        """手动添加一个版本。"""
        if file_path.exists():
            h = self._hash_file(file_path)
            self._snapshots[version_id] = VersionInfo(
                version_id=version_id,
                display_name=display_name,
                file_path=file_path,
                file_hash=h,
            )

    @staticmethod
    def _hash_file(path: Path) -> str:
        """计算文件 SHA256 哈希的前 12 位。"""
        h = hashlib.sha256()
        h.update(path.read_bytes())
        return h.hexdigest()[:12]

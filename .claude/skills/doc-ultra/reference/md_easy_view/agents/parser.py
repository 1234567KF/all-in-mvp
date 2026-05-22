"""Stage0: 需求解析 Agent.

解析原始需求描述和附件，产出结构化的需求规格书。
"""

from pathlib import Path
from typing import Optional

from ..providers.base import BaseProvider
from ..providers.base import create_provider as _create_provider
from ..providers.base import ProviderConfig

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    """加载 prompt 模板文件."""
    path = _PROMPT_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


class ParserAgent:
    """需求解析 Agent。

    读取原始需求描述和附件，产出结构化的需求规格书。
    """

    def __init__(self, config: ProviderConfig):
        self._provider: BaseProvider = _create_provider(config)
        self._system_prompt = _load_prompt("parser")

    def parse(
        self,
        raw_requirements: str,
        attachments: Optional[list[str]] = None,
    ) -> str:
        """解析需求。

        Args:
            raw_requirements: 原始需求描述文本
            attachments: 附件内容列表（每个元素是一个附件的文本内容）

        Returns:
            结构化的需求规格书 (Markdown)
        """
        user_message = f"## 原始需求描述\n\n{raw_requirements}"

        if attachments:
            user_message += "\n\n## 附件内容\n\n"
            for i, attachment in enumerate(attachments, 1):
                user_message += f"### 附件 {i}\n\n{attachment}\n\n"

        return self._provider.chat(
            system_prompt=self._system_prompt,
            user_message=user_message,
        )

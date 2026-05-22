"""Stage4: 扩写 Agent。

在不改变实质内容的前提下扩充文档篇幅。
"""

from pathlib import Path

from ..providers.base import BaseProvider
from ..providers.base import create_provider as _create_provider
from ..providers.base import ProviderConfig

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    path = _PROMPT_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


class ExpanderAgent:
    """扩写 Agent。

    在保持内容实质不变的前提下，扩充文档字数。
    """

    def __init__(self, config: ProviderConfig):
        self._provider: BaseProvider = _create_provider(config)
        self._system_prompt = _load_prompt("expander")

    def expand(
        self,
        document: str,
        target_words: int,
    ) -> str:
        """扩写文档。

        Args:
            document: 待扩写的文档
            target_words: 目标字数

        Returns:
            扩写后的文档 (Markdown)
        """
        current_words = len(document)
        expand_ratio = target_words / max(current_words, 1)

        user_message = (
            f"## 待扩写文档\n\n{document}\n\n"
            f"## 扩写要求\n\n"
            f"- 当前字数：约 {current_words} 字\n"
            f"- 目标字数：{target_words} 字\n"
            f"- 需扩充比例：约 {expand_ratio:.0%}\n"
        )

        if expand_ratio < 1.0:
            user_message += (
                "\n注意：当前字数已超过目标字数，请不要缩减内容。"
                "如果确实需要缩减，请保留所有实质信息，仅精简冗余表述。\n"
            )

        return self._provider.chat(
            system_prompt=self._system_prompt,
            user_message=user_message,
        )

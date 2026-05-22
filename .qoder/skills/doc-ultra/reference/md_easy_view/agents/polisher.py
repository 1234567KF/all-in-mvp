"""Stage5: 终审抛光 Agent。

对已完成全部检查和优化的文档做最后的抛光处理。
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


class PolisherAgent:
    """终审抛光 Agent。

    执行 AI 痕迹消除、MD 转 doc 兼容性处理、格式统一和最终扫读。
    """

    def __init__(self, config: ProviderConfig):
        self._provider: BaseProvider = _create_provider(config)
        self._system_prompt = _load_prompt("polisher")

    def polish(self, document: str) -> str:
        """抛光文档。

        Args:
            document: 抛光前的文档

        Returns:
            抛光后的文档 (Markdown)
        """
        user_message = f"## 待抛光文档\n\n{document}"

        return self._provider.chat(
            system_prompt=self._system_prompt,
            user_message=user_message,
        )

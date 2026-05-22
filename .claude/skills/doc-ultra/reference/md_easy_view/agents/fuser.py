"""Stage2: 融合合成 Agent。

将多份来自不同视角的优化稿融合为一份最佳文档。
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


class FuserAgent:
    """融合合成 Agent。

    综合多个优化视角的产出，生成融合稿。
    """

    def __init__(self, config: ProviderConfig):
        self._provider: BaseProvider = _create_provider(config)
        self._system_prompt = _load_prompt("fuser")

    def fuse(
        self,
        requirement_spec: str,
        drafts: dict[str, str],
    ) -> str:
        """融合多份优化稿。

        Args:
            requirement_spec: 需求规格书
            drafts: 视角ID → 优化稿 的映射

        Returns:
            融合后的文档 (Markdown)
        """
        user_message = f"## 需求规格书\n\n{requirement_spec}\n\n"

        user_message += "## 各视角优化稿\n\n"
        for perspective_id, draft in drafts.items():
            user_message += f"### {perspective_id} 视角\n\n{draft}\n\n---\n\n"

        return self._provider.chat(
            system_prompt=self._system_prompt,
            user_message=user_message,
        )

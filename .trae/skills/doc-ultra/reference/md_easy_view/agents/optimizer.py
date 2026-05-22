"""Stage1: 多视角并行优化 Agent。

同时运行多个不同价值主张的优化器，产出 N 份独立的优化稿。
"""

import concurrent.futures
from pathlib import Path
from typing import Optional

from ..config import OptimizerConfig
from ..providers.base import ProviderConfig
from ..providers.openai import OpenAIProvider
from ..providers.anthropic import AnthropicProvider
from ..providers.deepseek import DeepSeekProvider
from ..providers.base import BaseProvider

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    path = _PROMPT_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _create_provider_from_opt(config: OptimizerConfig) -> BaseProvider:
    """从 OptimizerConfig 创建 Provider."""
    pc = ProviderConfig(
        provider=config.provider,
        model=config.model,
        temperature=config.temperature,
    )
    provider_type = config.provider.lower()
    if provider_type == "openai":
        return OpenAIProvider(pc)
    elif provider_type == "anthropic":
        return AnthropicProvider(pc)
    elif provider_type == "deepseek":
        return DeepSeekProvider(pc)
    else:
        return OpenAIProvider(pc)


class OptimizerAgent:
    """多视角并行优化 Agent。

    管理多个优化器视角，并行执行优化任务。
    """

    # 视角与 prompt 文件的映射
    PERSPECTIVE_PROMPTS = {
        "radical": "optimizer_radical",
        "conservative": "optimizer_conservative",
        "balanced": "optimizer_balanced",
        "cost-effective": "optimizer_cost_effective",
    }

    def __init__(self, optimizer_configs: list[OptimizerConfig]):
        """初始化优化器。

        Args:
            optimizer_configs: 优化器配置列表（每个元素对应一个视角）
        """
        self._optimizers: list[tuple[str, BaseProvider, str]] = []
        for cfg in optimizer_configs:
            provider = _create_provider_from_opt(cfg)
            prompt_name = self.PERSPECTIVE_PROMPTS.get(cfg.id, "optimizer_balanced")
            system_prompt = _load_prompt(prompt_name)
            self._optimizers.append((cfg.id, provider, system_prompt))

    def optimize(
        self,
        requirement_spec: str,
        original_document: str,
        max_workers: Optional[int] = None,
    ) -> dict[str, str]:
        """并行运行所有优化器。

        Args:
            requirement_spec: 需求规格书
            original_document: 待优化的原始文档
            max_workers: 最大并行数（默认为优化器数量）

        Returns:
            dict[视角ID, 优化稿]
        """
        user_message = (
            f"## 需求规格书\n\n{requirement_spec}\n\n"
            f"## 待优化文档\n\n{original_document}"
        )

        results: dict[str, str] = {}
        max_workers = max_workers or len(self._optimizers)

        def _run(opt_id: str, provider: BaseProvider, prompt: str) -> tuple[str, str]:
            result = provider.chat(
                system_prompt=prompt,
                user_message=user_message,
            )
            return opt_id, result

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(_run, opt_id, provider, prompt)
                for opt_id, provider, prompt in self._optimizers
            ]
            for future in concurrent.futures.as_completed(futures):
                opt_id, result = future.result()
                results[opt_id] = result

        return results

    @property
    def perspective_ids(self) -> list[str]:
        """返回所有视角 ID 列表."""
        return [opt_id for opt_id, _, _ in self._optimizers]

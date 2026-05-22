"""LLM Provider 抽象基类。

定义统一的 LLM 调用接口，各提供商实现各自的适配逻辑。
"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProviderConfig:
    """Provider 配置."""

    provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = 0.3
    api_key: str = ""
    base_url: Optional[str] = None
    extra: dict = field(default_factory=dict)


class BaseProvider(ABC):
    """LLM Provider 抽象基类。

    所有模型提供商必须实现此接口。
    """

    def __init__(self, config: ProviderConfig):
        self.config = config
        self._resolve_api_key()

    def _resolve_api_key(self) -> None:
        """解析 API Key，配置文件优先，其次环境变量."""
        if self.config.api_key:
            return
        env_key = f"{self.config.provider.upper()}_API_KEY"
        self.config.api_key = os.environ.get(env_key, "")

    @abstractmethod
    def chat(
        self,
        system_prompt: str,
        user_message: str,
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """发送对话请求并返回文本响应。

        Args:
            system_prompt: 系统提示词
            user_message: 用户消息
            temperature: 覆盖配置中的 temperature
            max_tokens: 最大输出 token 数

        Returns:
            模型的文本响应
        """
        ...

    def supports_streaming(self) -> bool:
        """是否支持流式输出."""
        return False


def create_provider(config: ProviderConfig) -> BaseProvider:
    """工厂函数：根据配置创建对应的 Provider 实例。

    Args:
        config: Provider 配置

    Returns:
        Provider 实例

    Raises:
        ValueError: 不支持的 provider 类型
    """
    provider_type = config.provider.lower()

    if provider_type == "openai":
        from .openai import OpenAIProvider

        return OpenAIProvider(config)
    elif provider_type == "anthropic":
        from .anthropic import AnthropicProvider

        return AnthropicProvider(config)
    elif provider_type == "deepseek":
        from .deepseek import DeepSeekProvider

        return DeepSeekProvider(config)
    else:
        raise ValueError(
            f"不支持的 provider 类型: {provider_type}。"
            f"支持的类型: openai, anthropic, deepseek"
        )

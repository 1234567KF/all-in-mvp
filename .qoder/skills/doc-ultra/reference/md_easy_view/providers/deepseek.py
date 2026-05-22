"""DeepSeek Provider 适配器。

DeepSeek API 兼容 OpenAI 接口格式。
"""

from .openai import OpenAIProvider
from .base import ProviderConfig


class DeepSeekProvider(OpenAIProvider):
    """DeepSeek API 适配器.

    DeepSeek 使用 OpenAI 兼容接口，默认 base_url 为 DeepSeek 官方地址。
    """

    def __init__(self, config: ProviderConfig):
        if not config.base_url:
            config.base_url = "https://api.deepseek.com"
        super().__init__(config)

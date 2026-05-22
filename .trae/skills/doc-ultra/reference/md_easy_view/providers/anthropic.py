"""Anthropic Provider 适配器。"""

from typing import Optional

from anthropic import Anthropic

from .base import BaseProvider, ProviderConfig


class AnthropicProvider(BaseProvider):
    """Anthropic Claude API 适配器."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        kwargs = {"api_key": self.config.api_key}
        if self.config.base_url:
            kwargs["base_url"] = self.config.base_url
        self._client = Anthropic(**kwargs)

    def chat(
        self,
        system_prompt: str,
        user_message: str,
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        response = self._client.messages.create(
            model=self.config.model,
            max_tokens=max_tokens or 8192,
            temperature=temperature if temperature is not None else self.config.temperature,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_message},
            ],
        )
        # Anthropic 返回 content 列表，取第一个文本块
        for block in response.content:
            if block.type == "text":
                return block.text
        return ""

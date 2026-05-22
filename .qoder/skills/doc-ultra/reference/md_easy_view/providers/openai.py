"""OpenAI Provider 适配器。

支持所有 OpenAI 兼容接口（含 DeepSeek、Moonshot 等）。
"""

from typing import Optional

from openai import OpenAI

from .base import BaseProvider, ProviderConfig


class OpenAIProvider(BaseProvider):
    """OpenAI API 适配器.

    同时兼容任何 OpenAI 接口风格的第三方 API（DeepSeek、Moonshot 等）。
    """

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        kwargs = {"api_key": self.config.api_key}
        if self.config.base_url:
            kwargs["base_url"] = self.config.base_url
        self._client = OpenAI(**kwargs)

    def chat(
        self,
        system_prompt: str,
        user_message: str,
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        response = self._client.chat.completions.create(
            model=self.config.model,
            temperature=temperature if temperature is not None else self.config.temperature,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""

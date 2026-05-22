"""Stage3: 拷问检查循环 Agent。

对照需求规格书严格检查文档质量，支持多轮循环修复。
"""

import re
from pathlib import Path
from typing import Optional

from ..providers.base import BaseProvider
from ..providers.base import create_provider as _create_provider
from ..providers.base import ProviderConfig

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    path = _PROMPT_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _parse_check_result(report: str) -> Optional[bool]:
    """解析检查报告中的通过/不通过结果。

    Returns:
        True=通过, False=不通过, None=无法解析
    """
    # 查找明确的通过标记
    if "检查通过，文档已达到交付标准" in report:
        return True
    if "**「检查通过，文档已达到交付标准」**" in report:
        return True

    # 查找明确的判定行
    match = re.search(r"检查结果[：:]\s*\[?(通过|不通过)\]?", report)
    if match:
        return match.group(1) == "通过"

    # 查找总体判定区域
    match = re.search(r"总体判定.*?通过[：:]\s*(.+?)(?:\n|$)", report, re.DOTALL)
    if match:
        return "所有维度通过" in match.group(1)

    return None


class CheckerAgent:
    """拷问检查 Agent。

    支持多轮检查循环，每轮检查不通过则交给修复 Agent 修正后重检。
    """

    def __init__(self, config: ProviderConfig):
        self._provider: BaseProvider = _create_provider(config)
        self._system_prompt = _load_prompt("checker")

    def check(
        self,
        requirement_spec: str,
        document: str,
        round_number: int = 1,
    ) -> str:
        """执行一轮检查。

        Args:
            requirement_spec: 需求规格书
            document: 待检查的文档
            round_number: 当前轮次

        Returns:
            检查报告 (Markdown)
        """
        user_message = (
            f"## 需求规格书\n\n{requirement_spec}\n\n"
            f"## 待检查文档\n\n{document}\n\n"
            f"## 检查说明\n\n这是第 {round_number} 轮检查。"
        )

        return self._provider.chat(
            system_prompt=self._system_prompt,
            user_message=user_message,
        )

    def check_passed(self, report: str) -> bool:
        """判断检查是否通过。

        Args:
            report: 检查报告

        Returns:
            True 表示通过
        """
        result = _parse_check_result(report)
        if result is not None:
            return result
        # 默认: 如果找不到问题列表，认为通过
        return "发现的问题" not in report or "|------|" not in report

    def run_grill_loop(
        self,
        requirement_spec: str,
        document: str,
        max_rounds: int = 3,
        fixer_provider: Optional[BaseProvider] = None,
    ) -> tuple[str, list[str]]:
        """运行拷问检查循环。

        Args:
            requirement_spec: 需求规格书
            document: 待检查的文档
            max_rounds: 最大循环轮次
            fixer_provider: 修复 Agent 的 Provider（如果提供，会自动修复）

        Returns:
            (最终文档, 检查报告列表)
        """
        current_doc = document
        reports: list[str] = []

        for round_num in range(1, max_rounds + 1):
            report = self.check(requirement_spec, current_doc, round_num)
            reports.append(report)

            if self.check_passed(report):
                return current_doc, reports

            # 未通过且有修复 Provider，尝试修复
            if fixer_provider and round_num < max_rounds:
                current_doc = self._auto_fix(
                    fixer_provider, requirement_spec, current_doc, report
                )

        return current_doc, reports

    def _auto_fix(
        self,
        fixer: BaseProvider,
        requirement_spec: str,
        document: str,
        check_report: str,
    ) -> str:
        """自动修复文档中的问题。

        Args:
            fixer: 修复用的 Provider
            requirement_spec: 需求规格书
            document: 当前文档
            check_report: 检查报告

        Returns:
            修复后的文档
        """
        fix_prompt = (
            "你是文档修复专家。请根据检查报告中列出的问题来修正文档。\n\n"
            "## 修复原则\n"
            "1. 只修复报告中明确指出的问题\n"
            "2. 不要改变未被指出问题的部分\n"
            "3. 直接输出修复后的完整文档，不要解释修改了什么\n"
        )
        user_message = (
            f"## 需求规格书\n\n{requirement_spec}\n\n"
            f"## 当前文档\n\n{document}\n\n"
            f"## 检查报告\n\n{check_report}\n\n"
            f"请输出修复后的完整文档。"
        )

        return fixer.chat(
            system_prompt=fix_prompt,
            user_message=user_message,
        )

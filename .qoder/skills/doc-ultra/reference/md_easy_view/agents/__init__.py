"""Pipeline Agents - 流水线各阶段的 Agent 实现。

Stage0: Parser       - 需求解析
Stage1: Optimizer    - 多视角并行优化
Stage2: Fuser        - 融合合成
Stage3: Checker      - 拷问检查循环
Stage4: Expander     - 扩写
Stage5: Polisher     - 终审抛光
"""

from .parser import ParserAgent
from .optimizer import OptimizerAgent
from .fuser import FuserAgent
from .checker import CheckerAgent
from .expander import ExpanderAgent
from .polisher import PolisherAgent

__all__ = [
    "ParserAgent",
    "OptimizerAgent",
    "FuserAgent",
    "CheckerAgent",
    "ExpanderAgent",
    "PolisherAgent",
]

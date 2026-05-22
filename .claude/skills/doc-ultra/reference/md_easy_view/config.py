"""配置加载与校验模块 v2。

支持：
- 多 Provider 注册表（带能力标签和 API Key）
- 文档类型预设（标书/专利/软著/团标/项目申报/知识库/通用）
- 自动预设检测
- 向后兼容 v1 配置格式
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

from .providers.base import ProviderConfig


# ═══════════════════════════════════════════════════════════
# Provider 能力标签常量
# ═══════════════════════════════════════════════════════════

CAPABILITY_LABELS = {
    "high_quality": "高",
    "economical": "省",
    "fast": "快",
    "long_context": "长",
    "creative": "创",
    "reasoning": "推",
    "precise": "准",
    "structured": "构",
}


# ═══════════════════════════════════════════════════════════
# 配置数据类
# ═══════════════════════════════════════════════════════════

@dataclass
class NamedProviderConfig:
    """已注册的 Provider 配置（从 providers 节解析）."""

    name: str = ""
    type: str = "openai"
    model: str = "gpt-4o"
    api_key: str = ""
    base_url: str = ""
    capabilities: list[str] = field(default_factory=list)
    temperature: float = 0.5  # 默认温度

    def to_provider_config(self) -> ProviderConfig:
        """转换为 ProviderConfig."""
        return ProviderConfig(
            provider=self.type,
            model=self.model,
            api_key=self.api_key,
            base_url=self.base_url or None,
            temperature=self.temperature,
        )


@dataclass
class OptimizerConfig:
    """单个优化器配置."""

    id: str = "balanced"
    provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = 0.5


@dataclass
class PresetStageAssignment:
    """预设中的单个阶段配置。

    支持两种引用方式:
    1. 字符串: "pro" → 引用注册的 Provider
    2. 字典: {provider: "openai", model: "gpt-4o"} → 内联配置
    """

    provider_ref: str = ""          # 引用名称
    inline_provider: Optional[ProviderConfig] = None  # 内联配置


@dataclass
class PresetConfig:
    """文档类型预设."""

    name: str = ""
    description: str = ""
    # 各阶段 Provider 引用
    parser_ref: str = ""
    fuser_ref: str = ""
    checker_ref: str = ""
    expander_ref: str = ""
    polisher_ref: str = ""
    # 优化器列表（保留 id + 引用或内联）
    optimizer_assignments: list[dict] = field(default_factory=list)


@dataclass
class PipelineConfig:
    """流水线全局配置."""

    max_grill_rounds: int = 3
    grill_timeout_minutes: int = 15


@dataclass
class AttachmentConfig:
    """附件处理配置."""

    max_files: int = 20
    max_total_size_mb: int = 50


@dataclass
class OutputConfig:
    """输出配置."""

    clean_ai_traces: bool = True
    remove_metadata: bool = True


@dataclass
class DocUltraConfig:
    """doc-ultra 全局配置 v2。

    聚合 Provider 注册表、文档预设、阶段模型配置和流水线参数。
    """

    # Provider 注册表 (name → NamedProviderConfig)
    providers: dict[str, NamedProviderConfig] = field(default_factory=dict)

    # 文档类型预设 (preset_name → PresetConfig)
    presets: dict[str, PresetConfig] = field(default_factory=dict)

    # 活跃预设（如已应用）
    active_preset: str = ""

    # 各阶段模型配置（默认值，预设会覆盖）
    parser: ProviderConfig = field(default_factory=ProviderConfig)
    optimizers: list[OptimizerConfig] = field(default_factory=list)
    fuser: ProviderConfig = field(default_factory=lambda: ProviderConfig(temperature=0.4))
    checker: ProviderConfig = field(default_factory=lambda: ProviderConfig(temperature=0.1))
    expander: ProviderConfig = field(default_factory=lambda: ProviderConfig(temperature=0.5))
    polisher: ProviderConfig = field(default_factory=lambda: ProviderConfig(temperature=0.2))

    # 流水线参数
    pipeline: PipelineConfig = field(default_factory=PipelineConfig)
    attachments: AttachmentConfig = field(default_factory=AttachmentConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    # API Keys（向后兼容）
    api_keys: dict = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════
# Provider 解析工具
# ═══════════════════════════════════════════════════════════

def _resolve_api_key(raw: dict, provider_name: str, api_keys: dict) -> str:
    """解析 API Key: 配置值 > 环境变量 > 全局 api_keys."""
    if raw.get("api_key"):
        return raw["api_key"]
    # 尝试环境变量 {NAME}_API_KEY
    env_key = f"{provider_name.upper()}_API_KEY"
    import os
    env_val = os.environ.get(env_key, "")
    if env_val:
        return env_val
    # 尝试 provider type 的全局 api_keys
    return api_keys.get(raw.get("type", ""), api_keys.get(provider_name, ""))


def _parse_named_provider(name: str, raw: dict, api_keys: dict) -> NamedProviderConfig:
    """解析单个命名 Provider."""
    return NamedProviderConfig(
        name=name,
        type=raw.get("type", "openai"),
        model=raw.get("model", "gpt-4o"),
        api_key=_resolve_api_key(raw, name, api_keys),
        base_url=raw.get("base_url", ""),
        capabilities=raw.get("capabilities", []),
        temperature=float(raw.get("temperature", 0.5)),
    )


def _parse_provider_config(raw: dict, api_keys: dict) -> ProviderConfig:
    """解析内联 Provider 配置."""
    provider_name = raw.get("provider", "openai")
    api_key = raw.get("api_key", "") or api_keys.get(provider_name, "")
    return ProviderConfig(
        provider=provider_name,
        model=raw.get("model", "gpt-4o"),
        temperature=float(raw.get("temperature", 0.3)),
        api_key=api_key,
        base_url=raw.get("base_url"),
    )


def _resolve_provider_ref(
    ref: str,
    providers: dict[str, NamedProviderConfig],
) -> ProviderConfig:
    """解析 Provider 引用为 ProviderConfig。

    Args:
        ref: Provider 名称（如 "pro", "claude"）
        providers: 注册的 Provider 字典

    Returns:
        ProviderConfig 实例

    Raises:
        KeyError: 引用的 Provider 未注册
    """
    if ref in providers:
        return providers[ref].to_provider_config()
    raise KeyError(
        f"Provider '{ref}' 未在 providers 节中注册。"
        f"可用: {list(providers.keys())}"
    )


# ═══════════════════════════════════════════════════════════
# 文档类型自动检测
# ═══════════════════════════════════════════════════════════

# 文档类型关键词特征
_DOC_TYPE_PATTERNS: dict[str, list[str]] = {
    "bid": [
        "投标", "招标", "标书", "投标人", "招标文件",
        "商务条款", "技术方案", "报价", "资格预审",
        "评标", "中标", "履约", "投标保证金",
    ],
    "patent": [
        "专利", "权利要求", "说明书", "发明人", "申请人",
        "专利局", "实用新型", "外观设计", "PCT",
        "优先权", "公开号", "申请号",
    ],
    "software_copyright": [
        "软件著作权", "软著", "源代码", "软件名称",
        "著作权人", "开发完成日期", "首次发表",
    ],
    "standard": [
        "团体标准", "行业标准", "国家标准", "技术规范",
        "标准号", "归口", "起草单位", "规范性引用",
    ],
    "project_application": [
        "项目申报", "申报书", "可行性研究", "立项",
        "专项资金", "课题", "项目负责人", "经费预算",
    ],
    "knowledge_base": [
        "知识库", "FAQ", "操作手册", "技术文档",
        "用户指南", "配置说明", "接口文档", "使用说明",
    ],
}


def detect_document_type(text: str) -> str:
    """根据文档内容自动检测文档类型。

    Args:
        text: 文档内容

    Returns:
        预设名称（"general" 如果无法确定）
    """
    scores: dict[str, int] = {}
    for preset_name, keywords in _DOC_TYPE_PATTERNS.items():
        score = 0
        for kw in keywords:
            if kw in text:
                score += 1
        if score > 0:
            scores[preset_name] = score

    if not scores:
        return "general"

    # 返回得分最高的
    return max(scores, key=scores.get)


# ═══════════════════════════════════════════════════════════
# 预设应用
# ═══════════════════════════════════════════════════════════

def apply_preset(config: DocUltraConfig, preset_name: str) -> DocUltraConfig:
    """将预设应用到配置上。

    预设会覆盖各阶段的 Provider 分配，其余参数保持不变。

    Args:
        config: 当前配置
        preset_name: 预设名称

    Returns:
        应用预设后的配置（修改原对象）

    Raises:
        KeyError: 预设不存在
    """
    preset = config.presets.get(preset_name)
    if not preset:
        available = list(config.presets.keys())
        raise KeyError(
            f"预设 '{preset_name}' 不存在。可用预设: {available}"
        )

    providers = config.providers
    config.active_preset = preset_name

    # 解析各阶段
    if preset.parser_ref:
        config.parser = _resolve_provider_ref(preset.parser_ref, providers)

    if preset.fuser_ref:
        config.fuser = _resolve_provider_ref(preset.fuser_ref, providers)

    if preset.checker_ref:
        config.checker = _resolve_provider_ref(preset.checker_ref, providers)

    if preset.expander_ref:
        config.expander = _resolve_provider_ref(preset.expander_ref, providers)

    if preset.polisher_ref:
        config.polisher = _resolve_provider_ref(preset.polisher_ref, providers)

    # 解析优化器
    if preset.optimizer_assignments:
        config.optimizers = []
        for assignment in preset.optimizer_assignments:
            opt_id = assignment.get("id", "balanced")
            provider_ref = assignment.get("provider", "")
            if provider_ref and provider_ref in providers:
                p = providers[provider_ref]
                config.optimizers.append(
                    OptimizerConfig(
                        id=opt_id,
                        provider=p.type,
                        model=p.model,
                        temperature=p.temperature,
                    )
                )
            else:
                # 内联配置
                config.optimizers.append(
                    OptimizerConfig(
                        id=opt_id,
                        provider=assignment.get("provider", "openai"),
                        model=assignment.get("model", "gpt-4o"),
                        temperature=float(assignment.get("temperature", 0.5)),
                    )
                )

    return config


def list_presets(config: DocUltraConfig) -> list[dict]:
    """列出所有可用预设。

    Returns:
        [{"name": "bid", "description": "..."}, ...]
    """
    return [
        {"name": name, "description": preset.description}
        for name, preset in config.presets.items()
    ]


# ═══════════════════════════════════════════════════════════
# 配置加载主函数
# ═══════════════════════════════════════════════════════════

def load_config(
    config_path: Optional[str] = None,
    preset: str = "",
    auto_preset: bool = False,
) -> DocUltraConfig:
    """加载配置（可选应用预设）。

    Args:
        config_path: 配置文件路径
        preset: 预设名称
        auto_preset: 是否自动检测文档类型（需要后续传入文档内容）

    Returns:
        DocUltraConfig 实例
    """
    if config_path:
        path = Path(config_path)
    else:
        candidates = [
            Path.cwd() / "doc-ultra.config.yaml",
            Path.home() / ".doc-ultra.config.yaml",
        ]
        path = None
        for candidate in candidates:
            if candidate.exists():
                path = candidate
                break
        if path is None:
            config = _default_config()
            if preset:
                return apply_preset(config, preset)
            return config

    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    config = _parse_config(raw)

    if preset:
        config = apply_preset(config, preset)

    return config


def _default_config() -> DocUltraConfig:
    """返回默认配置."""
    config = DocUltraConfig()
    config.optimizers = [
        OptimizerConfig(id="radical", provider="openai", model="gpt-4o", temperature=0.8),
        OptimizerConfig(id="conservative", provider="openai", model="gpt-4o", temperature=0.2),
        OptimizerConfig(id="balanced", provider="deepseek", model="deepseek-chat", temperature=0.5),
    ]
    return config


def _parse_config(raw: dict) -> DocUltraConfig:
    """解析完整 YAML 配置."""
    api_keys = raw.get("api_keys", {})
    config = DocUltraConfig()

    # ── 解析 Provider 注册表 ──
    providers_raw = raw.get("providers", {})
    for name, prov_raw in providers_raw.items():
        config.providers[name] = _parse_named_provider(name, prov_raw, api_keys)

    # ── 解析预设 ──
    presets_raw = raw.get("presets", {})
    for preset_name, preset_raw in presets_raw.items():
        stages = preset_raw.get("stages", {})
        config.presets[preset_name] = PresetConfig(
            name=preset_name,
            description=preset_raw.get("description", ""),
            parser_ref=stages.get("parser", ""),
            fuser_ref=stages.get("fuser", ""),
            checker_ref=stages.get("checker", ""),
            expander_ref=stages.get("expander", ""),
            polisher_ref=stages.get("polisher", ""),
            optimizer_assignments=stages.get("optimizers", []),
        )

    # ── 解析默认模型配置（向后兼容）──
    models = raw.get("models", {})

    if "parser" in models:
        config.parser = _parse_provider_config(models["parser"], api_keys)

    if "optimizers" in models:
        config.optimizers = []
        for opt_raw in models["optimizers"]:
            config.optimizers.append(
                OptimizerConfig(
                    id=opt_raw.get("id", "balanced"),
                    provider=opt_raw.get("provider", "openai"),
                    model=opt_raw.get("model", "gpt-4o"),
                    temperature=float(opt_raw.get("temperature", 0.5)),
                )
            )

    if "fuser" in models:
        config.fuser = _parse_provider_config(models["fuser"], api_keys)

    if "checker" in models:
        config.checker = _parse_provider_config(models["checker"], api_keys)

    if "expander" in models:
        config.expander = _parse_provider_config(models["expander"], api_keys)

    if "polisher" in models:
        config.polisher = _parse_provider_config(models["polisher"], api_keys)

    # ── 流水线参数 ──
    pipeline_raw = raw.get("pipeline", {})
    config.pipeline = PipelineConfig(
        max_grill_rounds=int(pipeline_raw.get("max_grill_rounds", 3)),
        grill_timeout_minutes=int(pipeline_raw.get("grill_timeout_minutes", 15)),
    )

    # ── 附件与输出 ──
    attach_raw = raw.get("attachments", {})
    config.attachments = AttachmentConfig(
        max_files=int(attach_raw.get("max_files", 20)),
        max_total_size_mb=int(attach_raw.get("max_total_size_mb", 50)),
    )

    output_raw = raw.get("output", {})
    config.output = OutputConfig(
        clean_ai_traces=output_raw.get("clean_ai_traces", True),
        remove_metadata=output_raw.get("remove_metadata", True),
    )

    config.api_keys = api_keys

    if not config.optimizers:
        config.optimizers = [
            OptimizerConfig(id="radical", provider="openai", model="gpt-4o", temperature=0.8),
            OptimizerConfig(id="conservative", provider="openai", model="gpt-4o", temperature=0.2),
            OptimizerConfig(id="balanced", provider="deepseek", model="deepseek-chat", temperature=0.5),
        ]

    return config

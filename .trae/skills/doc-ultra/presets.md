# 文档类型预设速查

## 预设总览

| 预设名 | 适用场景 | 自动检测关键词 |
|--------|---------|---------------|
| `bid` | 招投标文档 | 投标/标书/招标/中标 |
| `patent` | 专利文档 | 专利/发明/权利要求/说明书附图 |
| `software_copyright` | 软件著作权 | 软著/著作权/软件登记/源程序 |
| `standard` | 团体/行业标准 | 标准/规范/团体标准/T/ |
| `project_application` | 项目申报书 | 申报/项目/立项/可行性/经费预算 |
| `knowledge_base` | 基于知识库的文档 | 知识库/FAQ/帮助中心/使用手册/操作指南 |
| `general` | 通用文档 | （默认回退） |
| `economical` | 低成本模式 | 使用 `-p economical` 显式指定 |

---

## 各预设的 Stage 模型分配策略

> 分配原则：
> - **高** = 高质量模型（GPT-4o/Claude），用于推理、审查、关键质量节点
> - **省** = 性价比模型（DeepSeek/Kimi/Flash），用于批量、并行任务
> - **快** = 快速模型（GPT-4o-mini/MiniMax），用于轻量抛光、格式化

### bid — 招投标文档

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **高** | 投标需求精确解读 |
| Optimizer ×3 | **高** + **高** + **省** | 投标文档质量要求极高，仅 1 路用性价比 |
| Fuser | **高** | 融合决策不可出错 |
| Checker | **高** | 投标漏项=废标 |
| Expander | **省** | 扩写量大但容错度高 |
| Polisher | **快** | 格式整理轻量任务 |

### patent — 专利文档

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **高** | 权利要求结构需精确理解 |
| Optimizer ×3 | **高** + **省** + **快** | 专利格式固定，结构优化空间小 |
| Fuser | **高** | 技术方案一致性关键 |
| Checker | **高** | 权利要求无歧义是底线 |
| Expander | **省** | 实施例扩写量大 |
| Polisher | **快** | 格式整理 |

### software_copyright — 软件著作权

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **省** | 软著模板化程度高 |
| Optimizer ×3 | **省** + **省** + **快** | 内容相对固定 |
| Fuser | **省** | 融合难度低 |
| Checker | **高** | 格式合规不可出错 |
| Expander | — | 通常不需要扩写 |
| Polisher | **快** | 格式整理 |

### standard — 团体标准

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **高** | 标准框架需精确解读 |
| Optimizer ×3 | **高** + **省** + **快** | 标准对格式要求极高 |
| Fuser | **高** | 术语一致性决定标准质量 |
| Checker | **高** | 标准不能有任何歧义 |
| Expander | **省** | 条文细化 |
| Polisher | **快** | 格式整理 |

### project_application — 项目申报书

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **高** | 申报要求不能误读 |
| Optimizer ×3 | **高** + **高** + **省** | 申报质量直接影响中标率 |
| Fuser | **高** | 技术路线一致性关键 |
| Checker | **高** | 形式审查不通过直接淘汰 |
| Expander | **省** | 经费预算/进度安排扩写 |
| Polisher | **快** | 格式整理 |

### knowledge_base — 知识库文档

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **省** | 知识库已有结构化内容 |
| Optimizer ×3 | **省** + **快** + **快** | 内容量大但质量要求适中 |
| Fuser | **省** | 融合难度中等 |
| Checker | **省** | 自检即可 |
| Expander | **快** | 大量FAQ扩写 |
| Polisher | **快** | 格式整理 |

### general — 通用文档

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **高** | 通用文档需要深度理解 |
| Optimizer ×3 | **高** + **省** + **省** | 均衡配置 |
| Fuser | **省** | 标准融合 |
| Checker | **高** | 质量底线 |
| Expander | **省** | 按需扩写 |
| Polisher | **快** | 格式整理 |

### economical — 低成本模式

| Stage | 分配 | 理由 |
|-------|------|------|
| Parser | **省** | 尽可能省钱 |
| Optimizer ×3 | **省** + **快** + **快** | 全性价比路线 |
| Fuser | **省** | 省 |
| Checker | **高** | 唯一不省的质量底线 |
| Expander | **快** | 最便宜 |
| Polisher | **快** | 最便宜 |

---

## 模型能力标签速查

| 标签 | 含义 | 适用模型 |
|------|------|---------|
| 🔴 高 (high_quality) | 推理强、输出质量高 | GPT-4o, Claude |
| 🟢 省 (economical) | 性价比高 | DeepSeek, Kimi |
| 🟡 快 (fast) | 响应快、成本低 | GPT-4o-mini, MiniMax, Qwen |
| 📏 长 (long_context) | 长上下文支持 | Claude, DeepSeek |
| 🎨 创 (creative) | 创造性写作 | Claude |
| 🧠 推 (reasoning) | 强推理能力 | GPT-4o, Claude |
| 🎯 准 (precise) | 精确、严谨 | GPT-4o |
| 📐 构 (structured) | 结构化输出 | GPT-4o, DeepSeek |

---

## Provider 注册表（来自 doc-ultra.config.yaml）

| Provider ID | 默认模型 | 能力标签 |
|-------------|---------|---------|
| `pro` | gpt-4o | 高 推 准 构 |
| `flash` | gpt-4o-mini | 快 省 |
| `claude` | claude-sonnet-4-20250514 | 高 长 创 推 |
| `deepseek` | deepseek-chat | 省 长 构 |
| `kimi` | moonshot-v1-8k | 省 |
| `minimax` | abab6.5s-chat | 快 |
| `qwen` | qwen-max | 快 |

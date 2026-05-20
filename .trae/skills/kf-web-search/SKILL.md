---
name: kf-web-search
description: |
  多引擎智能搜索。针对国内开发、技术文档、国际资料三种场景，
  自动选择最优搜索策略和关键词组合。支持精确搜索、站点限定、时间过滤。
  可被 kf-mvp 的 agent 按需自动调用搜索技术方案。
  运行 /web-search 启动搜索。
triggers:
  - web-search
  - 网络搜索
  - 搜索资料
  - 查文档
  - 搜索教程
  - 搜索最新
allowed-tools:
  - WebSearch
  - WebFetch
  - Bash
  - Read
metadata:
  called_by:
    - kf-mvp               # agent 按需自动调用
    - kf-spec               # 资料收集阶段
recommended_model: flash
graph:
  dependencies:
    - target: kf-exa-code
      type: substitution  # 通用搜索找不到代码示例

---

# 多引擎智能搜索

你是搜索策略专家。根据用户问题类型自动匹配最优搜索策略，组合精确关键词，过滤噪声。

---

## 三大搜索策略

### 策略A：国内日常搜索（中文资料优先）

适用场景：国内技术方案、产品选型对比、中文社区最佳实践

```
搜索语法模板：
"{精确关键词}" site:zhihu.com OR site:blog.csdn.net OR site:juejin.cn
"{精确关键词}" site:segmentfault.com OR site:cnblogs.com
"{精确关键词}" site:github.com OR site:gitee.com
```

执行规则：
- 首选 WebSearch 工具，指定 `lr=lang_zh` 语言偏向中文
- 关键词必须精确，避免模糊词（如"怎么做"→"实现步骤"、"最好的"→"推荐方案"）
- 时间范围：默认不限制，如需最新加 `after:2025-01-01`

### 策略B：技术开发搜索（教程/指南/文档）

适用场景：查阅官方文档、找代码示例、学习新技术栈

```
搜索语法模板：
intitle:"{技术名} 教程" OR intitle:"{技术名} 指南"
intitle:"{技术名}" filetype:md OR filetype:pdf
{技术名} "best practice" site:github.com
{技术名} "getting started" site:docs.{domain}
```

执行规则：
- `intitle:` 过滤标题含关键词的页面
- `filetype:md` 优先获取Markdown文档（更易读）
- 英文技术文档使用英文关键词，不翻译
- 官方文档优先（识别 docs.xxx.com 域名模式）

### 策略C：国际资料搜索（英文前沿/论文/规范）

适用场景：前沿技术趋势、学术论文、RFC规范、英文最佳实践

```
搜索语法模板：
"{keyword}" after:2026-01-01 inurl:docs OR inurl:blog
"{keyword}" site:arxiv.org OR site:github.com
"{keyword}" RFC OR "{keyword}" specification
"{keyword}" "state of the art" OR "{keyword}" "survey"
```

执行规则：
- 使用英文原文关键词
- `inurl:docs` 筛选文档类页面
- `after:` 限定时间范围
- 论文/规范类优先搜索 arxiv.org、github.com

---

## 搜索工作流

### Step 1: 问题分类

根据用户问题自动判断场景类型：

| 问题特征 | 匹配策略 | 示例 |
|---------|---------|------|
| 中文提问、国内工具/平台 | 策略A | "Vue3和React哪个好" |
| 技术实现/代码示例/API用法 | 策略B | "如何使用Playwright截图" |
| 前沿技术/论文/英文概念 | 策略C | "WebAssembly GC proposal" |
| 混合型（中文问英文技术） | 策略B + C | "Rust async trait最新进展" |

### Step 2: 关键词提取

- 提取问题的核心名词和技术名称作为精确关键词
- 去除口语化表达（"怎么"、"为什么"、"有没有"）
- 保留限定词（"最新"→after, "官方文档"→site限制）
- 中英双语关键词（如果相关）

### Step 3: 执行搜索

```
执行搜索（最多3轮）:
  第1轮: 主策略 + 精确关键词
  第2轮: 换角度/换关键词（如果第1轮结果不足）
  第3轮: 扩大范围（去掉严格限定）
```

### Step 4: 结果筛选与验证

- 优先点开官方域名、知名社区（GitHub/StackOverflow/知乎）
- 忽略内容农场、低质量采集站
- 对关键信息点开 WebFetch 获取全文验证
- 交叉验证：两个以上独立来源确认的信息才算可靠

### Step 5: 结构化输出

```markdown
## 搜索结果 — {问题摘要}

### 搜索策略
- 场景：{A/B/C}
- 关键词："{精确关键词}"
- 搜索轮次：{N} 轮

### 核心结论
{一句话总结，如有多个要点按优先级排列}

### 信息来源
| # | 标题 | 来源 | 相关度 | 摘要 |
|---|------|------|--------|------|
| 1 | {标题} | {域名} | ⭐⭐⭐ | {一句话摘要} |

### 补充建议
- {相关技术/替代方案/注意事项}

### 置信度
- 综合：{高/中/低} — {原因说明}
```

---


## Harness 反馈闭环（铁律 3）

| Step | 验证动作 | 失败处理 |
|------|---------|---------|
| 搜索执行 | `node {IDE_ROOT}/helpers/harness-gate-check.cjs --skill kf-web-search --stage search --required-sections "## 搜索结果" --forbidden-patterns "无结果"` | 换关键词重搜 |
| 结果汇总 | `node {IDE_ROOT}/helpers/harness-gate-check.cjs --skill kf-web-search --stage summary --required-sections "## 关键发现" "## 参考来源" --forbidden-patterns TODO 待定` | 补充来源链接 |

验证原则：**Plan → Build → Verify → Fix** 强制循环。

## 高级搜索技巧

### 组合操作符

| 操作符 | 用法 | 效果 |
|--------|------|------|
| `""` | `"exact phrase"` | 精确匹配整个短语 |
| `OR` | `A OR B` | 搜索A或B |
| `-` | `-excluded` | 排除特定词 |
| `site:` | `site:github.com` | 限定站点 |
| `intitle:` | `intitle:tutorial` | 标题含关键词 |
| `inurl:` | `inurl:docs` | URL含关键词 |
| `after:` | `after:2025-01-01` | 时间过滤 |
| `filetype:` | `filetype:pdf` | 文件类型过滤 |

### 错误处理

| 问题 | 自动处理 |
|------|---------|
| 搜索无结果 | 减少限定条件、换同义词、扩大时间范围 |
| 结果全是低质量站 | 加 `site:` 限定到高质量域名 |
| 中文结果不足 | 追加英文关键词 + 策略C |
| 结果过时 | 加 `after:` 时间过滤 |
| 网页打不开 | 用 WebFetch 重试、或搜索缓存版本 |

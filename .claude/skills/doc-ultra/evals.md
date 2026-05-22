# Evals for doc-ultra

## Positive (Skill SHOULD load)

| # | User Query | Expected | Notes |
|---|-----------|----------|-------|
| 1 | "帮我把这个需求文档优化成一本标书" | YES | 核心触发 — 文档处理 + 标书 |
| 2 | "doc-ultra 处理这个专利申请书" | YES | 名称直接触发 |
| 3 | "这段软著文档需要检查格式合规" | YES | 检查+软著子域 |
| 4 | "把会议记录整理成项目申报书" | YES | 文档生成+申报 |
| 5 | "帮我用多视角优化这个团体标准草案" | YES | 优化+标准 |
| 6 | "这段FAQ需要扩写和专业润色" | YES | 扩写+知识库 |
| 7 | "doc-ultra --auto-preset 需求.md" | YES | CLI 调用 |

## Negative (Skill should NOT load)

| # | User Query | Expected | Notes |
|---|-----------|----------|-------|
| 8 | "帮我写一个Python脚本来解析PDF" | NO | 代码编写，非文档处理 |
| 9 | "这个API的文档应该怎么设计" | NO | API设计讨论，非文档处理 |
| 10 | "GitHub Actions的配置文件怎么写" | NO | 配置文件编写 |
| 11 | "帮我review这段Java代码" | NO | 代码审查，应触发review/code-review |
| 12 | "Word和Markdown格式哪个更好" | NO | 格式比较讨论 |
| 13 | "帮我设计一个数据库schema" | NO | 数据库设计，非文档处理 |

## Neighbor Confusion (close domain boundary)

| # | User Query | Should Route To | Notes |
|---|-----------|-----------------|-------|
| 14 | "帮我写个FastAPI的接口文档" | N/A (非doc-ultra) | 技术文档写作，非标书/专利/软著等 |
| 15 | "审查这个SKILL.md是否符合规范" | kf-skill-design-expert | Skill审查，非文档处理 |

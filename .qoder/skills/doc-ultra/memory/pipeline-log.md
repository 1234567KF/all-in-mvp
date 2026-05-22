# Pipeline Memory Log

> 每次流水线运行后自动追加一条记录。最多保留 20 条，超量时删除最旧记录。

---

<!-- 记录格式（每次运行时追加在下方）：
### {ISO timestamp}
- input: {file path or "idea: {summary}"}
- preset: {name or "auto"}
- stages: {completed list}
- check rounds: {N}
- verdict: {PASS / 未决-{reason} / FAIL-{reason}}
- output: {file path}
- notes: {any issues encountered}
-->


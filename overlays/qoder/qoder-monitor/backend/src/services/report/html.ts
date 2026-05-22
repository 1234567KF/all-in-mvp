import { getDb, schema } from '../../db'
import { eq, desc, sql } from 'drizzle-orm'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution } from '../stats-aggregator'

export interface ReportOptions {
  sessionId?: string
  outputDir?: string
}

/**
 * Generate a standalone HTML dashboard (F-011)
 * Embedding all CSS + JS for offline viewing
 */
export function generateHtmlDashboard(options: ReportOptions = {}): string {
  const { sessionId } = options
  const stats = getTurnStats(sessionId)
  const cost = getTurnCost(sessionId)
  const savings = getTurnSavings(sessionId)
  const distribution = getModelDistribution(sessionId)
  const db = getDb()

  const conditions = sessionId ? eq(schema.turns.sessionId, sessionId) : sql`1=1`
  const allTurns = db.select()
    .from(schema.turns)
    .where(conditions)
    .orderBy(desc(schema.turns.timestamp))
    .all()

  const models = [...new Set(allTurns.map(t => t.modelUsed).filter(Boolean))]
  const isEmpty = allTurns.length === 0

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qoder Monitor — AI 执行看板${sessionId ? ` (${sessionId})` : ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; color: #e0e0e0; padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 20px; color: #fff; }
    h2 { font-size: 1.1rem; margin: 20px 0 10px; color: #a0a0c0; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card {
      background: #16213e; border-radius: 10px; padding: 16px; border: 1px solid #0f3460;
    }
    .card .label { font-size: 0.75rem; color: #8888aa; text-transform: uppercase; }
    .card .value { font-size: 1.3rem; font-weight: 700; margin-top: 4px; color: #e94560; }
    .card .value.green { color: #4ecca3; }
    table {
      width: 100%; border-collapse: collapse; background: #16213e; border-radius: 8px;
      overflow: hidden; margin-bottom: 20px;
    }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #0f3460; }
    th { background: #0f3460; color: #a0a0c0; font-size: 0.8rem; text-transform: uppercase; }
    td { font-size: 0.85rem; }
    tr:hover { background: #1a2744; }
    .filters { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
    .filters select, .filters input {
      background: #16213e; border: 1px solid #0f3460; color: #e0e0e0;
      padding: 6px 12px; border-radius: 6px; font-size: 0.85rem;
    }
    .filters label { font-size: 0.8rem; color: #8888aa; display: flex; align-items: center; gap: 6px; }
    .empty { text-align: center; padding: 40px; color: #666; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 0.75rem; background: #0f3460;
    }
    .badge.pro { background: #e94560; }
    .badge.flash { background: #4ecca3; color: #1a1a2e; }
    .note { font-size: 0.8rem; color: #666; text-align: center; margin-top: 30px; }
  </style>
</head>
<body>
<div class="container">
  <h1>📊 Qoder Monitor — AI 执行看板</h1>
  ${sessionId ? `<p style="color:#8888aa;margin-bottom:15px;">会话: ${sessionId}</p>` : ''}

  ${isEmpty ? '<div class="empty"><p>暂无数据</p></div>' : `
  <!-- Summary Cards -->
  <div class="cards">
    <div class="card"><div class="label">总调用次数</div><div class="value">${stats.total_calls}</div></div>
    <div class="card"><div class="label">输入 Token</div><div class="value">${stats.total_input_tokens.toLocaleString()}</div></div>
    <div class="card"><div class="label">缓存命中率</div><div class="value green">${stats.cache_hit_rate}%</div></div>
    <div class="card"><div class="label">输出 Token</div><div class="value">${stats.total_output_tokens.toLocaleString()}</div></div>
    <div class="card"><div class="label">模型切换</div><div class="value">${stats.model_switch_count}</div></div>
    <div class="card"><div class="label">模型数</div><div class="value">${stats.model_count}</div></div>
    <div class="card"><div class="label">预估成本</div><div class="value">¥${cost.total_cost.toFixed(4)}</div></div>
    <div class="card"><div class="label">总节省</div><div class="value green">${savings.total_savings.toLocaleString()}</div></div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <label>模型: <select id="modelFilter" onchange="applyFilters()">
      <option value="">全部</option>
      ${models.map(m => `<option value="${m}">${m}</option>`).join('')}
    </select></label>
    <label>类型: <select id="typeFilter" onchange="applyFilters()">
      <option value="">全部</option>
      <option value="turn">轮次</option>
      <option value="a2a">A2A</option>
    </select></label>
    <label>搜索: <input type="text" id="keywordFilter" placeholder="关键词..." oninput="applyFilters()"></label>
  </div>

  <!-- Model Distribution -->
  <h2>模型分布</h2>
  <table>
    <thead><tr><th>模型</th><th>调用次数</th><th>占比</th></tr></thead>
    <tbody>
      ${distribution.map(d => `<tr><td><span class="badge ${d.model.includes('flash') ? 'flash' : 'pro'}">${d.model}</span></td><td>${d.call_count}</td><td>${d.percentage}%</td></tr>`).join('')}
    </tbody>
  </table>

  <!-- Cost Breakdown -->
  <h2>成本明细</h2>
  <table>
    <thead><tr><th>模型</th><th>调用次数</th><th>输入成本</th><th>输出成本</th><th>总成本</th></tr></thead>
    <tbody>
      ${cost.items.map(i => `<tr><td>${i.model}${i.has_pricing ? '' : ' (无定价)'}</td><td>${i.call_count}</td><td>¥${i.input_cost.toFixed(4)}</td><td>¥${i.output_cost.toFixed(4)}</td><td>¥${i.total_cost.toFixed(4)}</td></tr>`).join('')}
      <tr style="font-weight:700;border-top:2px solid #e94560;"><td colspan="4">总计</td><td>¥${cost.total_cost.toFixed(4)}</td></tr>
    </tbody>
  </table>

  <!-- Savings Breakdown -->
  <h2>优化节省</h2>
  <table>
    <thead><tr><th>机制</th><th>节省 Token</th><th>占比</th></tr></thead>
    <tbody>
      ${Object.entries(savings.mechanisms).map(([k, v]) => `<tr><td>${k}</td><td>${v.toLocaleString()}</td><td>${(savings.percentages[k] ?? 0).toFixed(1)}%</td></tr>`).join('')}
      ${savings.model_switch_savings > 0 ? `<tr><td>模型切换 (单独)</td><td>${savings.model_switch_savings.toLocaleString()}</td><td>-</td></tr>` : ''}
    </tbody>
  </table>

  <!-- Recent Turns -->
  <h2>轮次明细</h2>
  <table id="turnsTable">
    <thead><tr><th>ID</th><th>类型</th><th>角色</th><th>模型</th><th>输入</th><th>输出</th><th>耗时</th><th>时间</th></tr></thead>
    <tbody>
      ${allTurns.map(t => `<tr class="turn-row" data-model="${t.modelUsed || ''}" data-type="${t.type}" data-note="${(t.note || '').toLowerCase()}">
        <td>${t.id}</td><td><span class="badge">${t.type}</span></td><td>${t.role}</td><td>${t.modelUsed}</td>
        <td>${((t.inputUncached || 0) + (t.inputCached || 0)).toLocaleString()}</td>
        <td>${(t.outputTokens || 0).toLocaleString()}</td>
        <td>${t.latencyMs ? t.latencyMs + 'ms' : '-'}</td>
        <td>${t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '-'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  `}

  <div class="note">
    <p>由 Qoder Monitor 自动生成 | ${new Date().toISOString().split('T')[0]}</p>
  </div>
</div>

<script>
function applyFilters() {
  const modelFilter = (document.getElementById('modelFilter')?.value || '').toLowerCase()
  const typeFilter = (document.getElementById('typeFilter')?.value || '').toLowerCase()
  const keywordFilter = (document.getElementById('keywordFilter')?.value || '').toLowerCase()

  document.querySelectorAll('.turn-row').forEach(row => {
    const model = (row.dataset.model || '').toLowerCase()
    const type = (row.dataset.type || '').toLowerCase()
    const note = (row.dataset.note || '').toLowerCase()

    const matchModel = !modelFilter || model === modelFilter
    const matchType = !typeFilter || type === typeFilter
    const matchKeyword = !keywordFilter || note.includes(keywordFilter)

    row.style.display = matchModel && matchType && matchKeyword ? '' : 'none'
  })
}
</script>
</body>
</html>`
}

---
name: kf-mvp-monitoring
description: >-
  Load when user asks for monitoring setup, alerting configuration, or observability.
  Triggers: 监控, 告警配置, 运维监控, monitoring, alerting, observability,
  日志聚合, log aggregation, health check. Also load when setting up
  production infrastructure.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-devops
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Monitoring — 监控与告警技能

> **Core Belief**: You can't fix what you can't see. Monitoring should catch issues before users do. Know what's broken before users tell you.

**Division of Labor**: This Skill focuses on **monitoring and observability setup** using Tool Wrapper pattern. Provides logging, metrics, and alerting configurations.

---

# Core Philosophy

1. **Three pillars** — Logs, metrics, traces
2. **Proactive alerting** — Alert before users notice
3. **Meaningful alerts** — No alert fatigue
4. **Dashboards tell stories** — At a glance health status

---

# Health Check Endpoint

```typescript
// src/routes/health.ts
import { Context, Next } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c: Context) => {
  const dbHealth = await checkDbConnection();
  const memoryUsage = process.memoryUsage();
  
  const isHealthy = dbHealth.status === 'ok';
  
  return c.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks: {
      database: dbHealth,
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
    },
  }, isHealthy ? 200 : 503);
});

async function checkDbConnection() {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: String(error) };
  }
}
```

---

# Structured Logging

```typescript
// src/lib/logger.ts
import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' 
    ? undefined  // Send to stdout
    : { target: 'pino-pretty' },  // Pretty print in dev
});

export function logRequest(req: Request, res: Response, duration: number) {
  logger.info({
    method: req.method,
    path: req.url,
    status: res.status,
    duration,
    userAgent: req.headers.get('user-agent'),
  }, 'HTTP Request');
}
```

---

# Error Tracking (Sentry)

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// In Hono app
app.onError((err, c) => {
  Sentry.captureException(err, {
    context: {
      method: c.req.method,
      path: c.req.path,
    },
  });
  
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : err.message,
    },
  }, 500);
});
```

---

# Metrics Endpoint

```typescript
// metrics.ts - Prometheus format
app.get('/metrics', async (c) => {
  const metrics = {
    http_requests_total: { type: 'counter', help: 'Total HTTP requests' },
    http_request_duration_seconds: { type: 'histogram', help: 'Request duration' },
    db_query_duration_seconds: { type: 'histogram', help: 'DB query duration' },
  };
  
  return c.text(Object.entries(metrics).map(([name, m]) => 
    `# HELP ${name} ${m.help}\n# TYPE ${name} ${m.type}\n${name} ${getValue(name)}`
  ).join('\n'));
});
```

---

# Alerting Rules

```yaml
# alerts.yml - Prometheus alerting rules
groups:
  - name: mvp-alerts
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
          description: "p95 latency is {{ $value }}s"
```

---

# Dashboard Template

```markdown
# MVP Dashboard

## System Health

| Metric | Value | Status |
|--------|-------|--------|
| Error Rate | 0.1% | ✅ |
| p95 Latency | 85ms | ✅ |
| Requests/sec | 45 | ✅ |
| Active Users | 128 | ✅ |

## Recent Alerts

| Alert | Time | Status |
|-------|------|--------|
| HighErrorRate | 2h ago | Resolved |
| HighLatency | 5h ago | Resolved |

## Services

| Service | Uptime | Last Check |
|---------|--------|------------|
| API | 99.9% | 1m ago |
| Database | 100% | 1m ago |
```

---

# Monitoring Stack

| Component | Tool | Purpose |
|----------|------|---------|
| Logs | Loki / CloudWatch | Log aggregation |
| Metrics | Prometheus | Metrics collection |
| Traces | Jaeger | Distributed tracing |
| Errors | Sentry | Error tracking |
| Uptime | UptimeRobot | External monitoring |

---

# Constraints

**MUST DO:**
- Implement health check endpoint
- Log errors with context
- Set meaningful alerts
- Monitor key metrics

**MUST NOT DO:**
- Alert on every metric
- Log sensitive data
- Ignore slow queries
- Skip production monitoring

---

# Gotchas

- **Alert fatigue** — Only alert on actionable issues
- **Log volume** — Rate limit in high-traffic scenarios
- **PII** — Never log passwords, tokens, or personal data
- **Retention** — Set log retention policies
- **Sampling** — Sample in high-volume scenarios
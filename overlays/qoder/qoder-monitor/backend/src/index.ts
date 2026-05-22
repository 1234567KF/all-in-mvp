import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

// Routes will be mounted by each module
import turnsRouter from './api/turns'
import statsRouter, { pricingRouter } from './api/stats'
import dashboardRouter from './api/dashboard'
import systemRouter from './api/system'
import sessionsRouter from './api/sessions'
import optimizationsRouter from './api/optimizations'

// M02: Turns API - /api/turns
// M03: Stats API must be mounted BEFORE turns (to avoid /:id capturing /stats, /cost etc.)
app.route('/api/turns', statsRouter)
app.route('/api/turns', turnsRouter)

// M04: Dashboard API - /api/dashboard/summary
app.route('/api/dashboard', dashboardRouter)

// M06: System API - /api/health, /api/data
app.route('/api', systemRouter)

// M08: Sessions API - /api/sessions
app.route('/api/sessions', sessionsRouter)

// Pricing API - /api/pricing
app.route('/api/pricing', pricingRouter)

// Optimizations API - /api/optimizations
app.route('/api/optimizations', optimizationsRouter)

const port = parseInt(process.env.PORT || '3456')
console.log(`[server] starting on http://localhost:${port}`)

serve({ fetch: app.fetch, port }, (info: any) => {
  console.log(`[server] listening on http://localhost:${info.port}`)
})

export default app

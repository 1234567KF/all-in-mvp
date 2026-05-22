import { Hono } from 'hono'
import { getDashboardSummary } from './handlers'

const router = new Hono()

// GET /api/dashboard/summary - Real-time dashboard summary (F-005)
router.get('/summary', getDashboardSummary)

export default router

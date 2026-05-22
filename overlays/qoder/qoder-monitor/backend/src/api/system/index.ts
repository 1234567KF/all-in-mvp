import { Hono } from 'hono'
import { healthCheck, clearAllData } from './handlers'

const router = new Hono()

// GET /api/health - Health check (F-013)
router.get('/health', healthCheck)

// DELETE /api/data - Clear all data (F-012)
router.delete('/data', clearAllData)

export default router

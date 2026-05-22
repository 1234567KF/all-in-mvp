import { Hono } from 'hono'
import { createOptimization, listOptimizations, getOptimizationSummary } from './handlers'

const router = new Hono()

router.post('/', createOptimization)
router.get('/', listOptimizations)
router.get('/summary', getOptimizationSummary)

export default router

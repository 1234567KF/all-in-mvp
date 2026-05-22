import { Hono } from 'hono'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution, getPricingHandler, listPricingHandler, updatePricingHandler } from './handlers'

const router = new Hono()

// GET /api/turns/stats - Token statistics (F-007)
router.get('/stats', getTurnStats)

// GET /api/turns/cost - Cost estimation (F-008)
router.get('/cost', getTurnCost)

// GET /api/turns/savings - Optimization savings (F-009)
router.get('/savings', getTurnSavings)

// GET /api/turns/model-distribution - Model distribution
router.get('/model-distribution', getModelDistribution)

export default router

// Pricing router (mounted separately at /api/pricing)
export const pricingRouter = new Hono()
pricingRouter.get('/', listPricingHandler)
pricingRouter.get('/:modelId', getPricingHandler)
pricingRouter.put('/:modelId', updatePricingHandler)

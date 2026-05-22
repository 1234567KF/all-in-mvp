import { Hono } from 'hono'
import { getTurns, getTurnById, createTurn } from './handlers'

const router = new Hono()

// POST /api/turns - Create a turn record
router.post('/', createTurn)

// GET /api/turns - List turns with filters
router.get('/', getTurns)

// GET /api/turns/:id - Get single turn
router.get('/:id', getTurnById)

export default router

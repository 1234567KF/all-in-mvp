import { Hono } from 'hono'
import { listSessions, getSessionById } from './handlers'

const sessionsRouter = new Hono()

sessionsRouter.get('/', listSessions)
sessionsRouter.get('/:id', getSessionById)

export default sessionsRouter

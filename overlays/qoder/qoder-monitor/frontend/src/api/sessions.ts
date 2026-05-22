import { api } from '.'

export interface SessionItem {
  id: string
  turnCount: number
  a2aCount: number
  created: string
  lastActivity: string
}

export async function fetchSessionsList(): Promise<SessionItem[]> {
  const res: any = await api.get('/sessions')
  return res.data.items
}

export async function fetchSessionById(id: string): Promise<any> {
  const res: any = await api.get(`/sessions/${id}`)
  return res.data
}

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'monitor.db')

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: Database.Database | null = null

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    _sqlite = new Database(DB_PATH)
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('foreign_keys = ON')
    _db = drizzle(_sqlite, { schema })
  }
  return _db
}

export function getSqlite(): Database.Database {
  if (!_sqlite) {
    getDb()
  }
  return _sqlite!
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}

export type DbSchema = typeof schema
export { schema }

'use strict'
// ============================================================
// sync-lean-ctx.cjs — Qoder Stop Hook
// Syncs optimization data at session end
// Triggered by: Stop event in ~/.qoder/settings.json
// ============================================================

const fs = require('fs')
const path = require('path')

const LOG_FILE = path.join(__dirname, 'perf-hook.log')

function log(msg) {
  try {
    const ts = new Date().toISOString()
    fs.appendFileSync(LOG_FILE, `[${ts}] [sync-lean-ctx] ${msg}\n`)
  } catch {}
}

// Read stdin with timeout
function readStdin(timeoutMs = 3000) {
  return new Promise((resolve) => {
    let data = ''
    let done = false
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve('') }
    }, timeoutMs)

    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => { data += chunk })
    process.stdin.on('end', () => {
      if (!done) { done = true; clearTimeout(timer); resolve(data) }
    })
    process.stdin.on('error', () => {
      if (!done) { done = true; clearTimeout(timer); resolve('') }
    })
  })
}

async function main() {
  log('=== sync-lean-ctx started ===')

  let raw
  try {
    raw = await readStdin(3000)
  } catch (e) {
    log(`stdin read failed: ${e.message}`)
    process.exit(0)
  }

  if (!raw.trim()) {
    log('No stdin data, exiting')
    process.exit(0)
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch (e) {
    log(`JSON parse failed: ${e.message}`)
    process.exit(0)
  }

  const hookEvent = data.hook_event_name || ''
  const sessionId = data.session_id || 'unknown'
  const lastMsg = data.last_assistant_message || ''

  log(`Event: ${hookEvent}, Session: ${sessionId}, Last msg length: ${(lastMsg || '').length}`)

  if (hookEvent !== 'Stop') {
    log(`Unexpected event: ${hookEvent}, exiting`)
    process.exit(0)
  }

  // TODO: Parse last_assistant_message for optimization data
  // and POST to /api/optimizations
  // For now, just log the session end
  log(`Session ${sessionId} ended. Last message: ${(lastMsg || '').slice(0, 100)}...`)
  log('=== sync-lean-ctx ended ===')
}

main().catch((e) => {
  log(`Fatal error: ${e.message}`)
  process.exit(0)  // Never block the IDE
})

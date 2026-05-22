'use strict'
// ============================================================
// perf-auto-log.cjs — Qoder UserPromptSubmit Hook
// Captures user input and POSTs to qoder-monitor backend
// Triggered by: UserPromptSubmit event in ~/.qoder/settings.json
// ============================================================

const http = require('http')
const fs = require('fs')
const path = require('path')

const API_URL = process.env.QODER_MONITOR_URL || 'http://localhost:3456'
const LOG_FILE = path.join(__dirname, 'perf-hook.log')

function log(msg) {
  try {
    const ts = new Date().toISOString()
    fs.appendFileSync(LOG_FILE, `[${ts}] [auto-log] ${msg}\n`)
  } catch {}
}

// Read stdin with timeout (prevents hanging when no input piped)
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

function postToApi(path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, API_URL)
    const postData = JSON.stringify(body)
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000,
    }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve({ ok: false }) }
      })
    })
    req.on('error', (e) => { log(`POST error: ${e.message}`); resolve({ ok: false }) })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    req.write(postData)
    req.end()
  })
}

async function main() {
  log('=== perf-auto-log started ===')

  // Read hook context from stdin
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
  const prompt = data.prompt || ''
  const transcriptPath = data.transcript_path || ''

  log(`Event: ${hookEvent}, Session: ${sessionId}, Prompt length: ${prompt.length}`)

  if (hookEvent !== 'UserPromptSubmit') {
    log(`Unexpected event: ${hookEvent}, exiting`)
    process.exit(0)
  }

  // BR-002: Empty message - skip
  if (!prompt || !prompt.trim()) {
    log('Empty prompt, skipping')
    process.exit(0)
  }

  // Estimate model from environment or use default (BR-003)
  const model = process.env.QODER_MODEL || 'deepseek-v4-pro'

  // Build turn record
  const turnData = {
    session_id: sessionId,
    type: 'turn',
    role: 'human',
    timestamp: new Date().toISOString(),
    model_used: model,
    message_size_bytes: Buffer.byteLength(prompt, 'utf8'),
    data_source: 'hook',
    note: prompt.slice(0, 200),  // First 200 chars as note
  }

  log(`POST /api/turns (human): session=${sessionId}, bytes=${turnData.message_size_bytes}`)

  const result = await postToApi('/api/turns', turnData)
  log(`Response: ${JSON.stringify(result)}`)
  log('=== perf-auto-log ended ===')
}

main().catch((e) => {
  log(`Fatal error: ${e.message}`)
  process.exit(0)  // Never block the IDE
})

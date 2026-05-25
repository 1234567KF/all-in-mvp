'use strict'
// ============================================================
// monitor-user-submit.cjs — Qoder UserPromptSubmit Hook
// Captures user's message and posts to qoder-monitor API
// ============================================================

const http = require('http')
const fs = require('fs')
const path = require('path')

const API_URL = process.env.QODER_MONITOR_URL || 'http://localhost:3456'
const LOG_FILE = path.join(__dirname, 'monitor-hook.log')

function log(msg) {
  try {
    const ts = new Date().toISOString()
    fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`)
  } catch {}
}

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

function postToApi(urlPath, body) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, API_URL)
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
  const raw = await readStdin(3000)
  if (!raw.trim()) return

  let data
  try { data = JSON.parse(raw) } catch { return }

  const hookEvent = data.hook_event_name || ''
  const sessionId = data.session_id || 'unknown'
  const prompt = data.prompt || ''

  if (hookEvent !== 'UserPromptSubmit' || !prompt.trim()) return

  const model = process.env.QODER_MODEL || 'deepseek-v4-pro'

  const turnData = {
    session_id: sessionId,
    type: 'turn',
    role: 'human',
    timestamp: new Date().toISOString(),
    model_used: model,
    message: prompt,
    message_size_bytes: Buffer.byteLength(prompt, 'utf8'),
    data_source: 'hook',
  }

  log(`POST /api/turns (human): session=${sessionId}, len=${prompt.length}`)
  const result = await postToApi('/api/turns', turnData)
  log(`Response: ${JSON.stringify(result)}`)
}

main().catch(() => process.exit(0))

'use strict'
// ============================================================
// perf-response-capture.cjs — Qoder PostToolUse Hook
// Captures AI response by reading transcript, POSTs to backend
// Triggered by: PostToolUse / PostToolUseFailure events
// ============================================================

const http = require('http')
const fs = require('fs')
const path = require('path')

const API_URL = process.env.QODER_MONITOR_URL || 'http://localhost:3456'
const LOG_FILE = path.join(__dirname, 'perf-hook.log')

function log(msg) {
  try {
    const ts = new Date().toISOString()
    fs.appendFileSync(LOG_FILE, `[${ts}] [resp-capture] ${msg}\n`)
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

// Read last assistant message from JSONL transcript
function getLastAssistantMessage(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null
    const content = fs.readFileSync(transcriptPath, 'utf8')
    const lines = content.split('\n').filter((l) => l.trim())
    // Walk backwards to find last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.role === 'assistant' && entry.message) {
          // Extract text content from message
          const contentArr = entry.message.content || []
          const textParts = contentArr
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text)
          const fullText = textParts.join('\n')
          if (fullText.length > 0) {
            return {
              text: fullText,
              byteLength: Buffer.byteLength(fullText, 'utf8'),
            }
          }
        }
      } catch { continue }  // Skip malformed lines
    }
    return null
  } catch (e) {
    log(`transcript read error: ${e.message}`)
    return null
  }
}

async function main() {
  log('=== perf-response-capture started ===')

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
  const toolName = data.tool_name || ''
  const transcriptPath = data.transcript_path || ''

  log(`Event: ${hookEvent}, Session: ${sessionId}, Tool: ${toolName}`)

  // Handle both PostToolUse and PostToolUseFailure
  if (hookEvent !== 'PostToolUse' && hookEvent !== 'PostToolUseFailure') {
    log(`Unexpected event: ${hookEvent}, exiting`)
    process.exit(0)
  }

  // Strategy: Read transcript to get last assistant message
  const assistantMsg = getLastAssistantMessage(transcriptPath)

  if (!assistantMsg) {
    log('No assistant message found in transcript, using tool_response fallback')
    // Fallback: use tool_response as output
    const toolResponse = typeof data.tool_response === 'string'
      ? data.tool_response
      : JSON.stringify(data.tool_response || '')
    const responseBytes = Buffer.byteLength(toolResponse, 'utf8')

    if (responseBytes < 10) {
      log('Tool response too short, skipping')
      process.exit(0)
    }

    const model = process.env.QODER_MODEL || 'deepseek-v4-pro'
    const turnData = {
      session_id: sessionId,
      type: 'turn',
      role: 'ai',
      timestamp: new Date().toISOString(),
      model_used: model,
      output_tokens: Math.max(1, Math.floor(responseBytes / 4)),
      message_size_bytes: responseBytes,
      data_source: 'hook',
      note: `[${toolName}] ${toolResponse.slice(0, 150)}`,
    }

    log(`POST /api/turns (ai-fallback): tool=${toolName}, bytes=${responseBytes}`)
    const result = await postToApi('/api/turns', turnData)
    log(`Response: ${JSON.stringify(result)}`)
    log('=== perf-response-capture ended ===')
    return
  }

  // Found assistant message in transcript
  const model = process.env.QODER_MODEL || 'deepseek-v4-pro'
  // Rough token estimation: ~4 bytes per token for mixed Chinese/English
  const estimatedOutputTokens = Math.max(1, Math.floor(assistantMsg.byteLength / 4))

  const turnData = {
    session_id: sessionId,
    type: 'turn',
    role: 'ai',
    timestamp: new Date().toISOString(),
    model_used: model,
    output_tokens: estimatedOutputTokens,
    message_size_bytes: assistantMsg.byteLength,
    data_source: 'hook',
    note: `[${toolName}] ${assistantMsg.text.slice(0, 150)}`,
  }

  log(`POST /api/turns (ai): tool=${toolName}, bytes=${assistantMsg.byteLength}, est_tokens=${estimatedOutputTokens}`)
  const result = await postToApi('/api/turns', turnData)
  log(`Response: ${JSON.stringify(result)}`)
  log('=== perf-response-capture ended ===')
}

main().catch((e) => {
  log(`Fatal error: ${e.message}`)
  process.exit(0)  // Never block the IDE
})

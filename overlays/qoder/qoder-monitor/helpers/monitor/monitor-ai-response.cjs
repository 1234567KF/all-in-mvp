'use strict'
// ============================================================
// monitor-ai-response.cjs — Qoder PostToolUse Hook
// Captures tool response from PostToolUse event and posts to API
// ============================================================

const http = require('http')
const fs = require('fs')
const path = require('path')

const API_URL = process.env.QODER_MONITOR_URL || 'http://localhost:3456'
const LOG_FILE = path.join(__dirname, 'monitor-hook.log')

const MAX_MESSAGE_LEN = 3000

function log(msg) {
  try {
    const ts = new Date().toISOString()
    fs.appendFileSync(LOG_FILE, `[${ts}] [ai-resp] ${msg}\n`)
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

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text
  return text.substring(0, maxLen) + `\n\n... [已截断，原始长度 ${text.length} 字符]`
}

function getToolResultMessage(toolName, toolResponse, isFailure, errorMsg) {
  const prefix = isFailure ? `[工具执行失败: ${toolName}]` : `[工具: ${toolName}]`
  const errorSuffix = errorMsg ? `\n错误: ${errorMsg}` : ''

  if (toolResponse) {
    const responseStr = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse)
    return prefix + '\n' + truncate(responseStr, MAX_MESSAGE_LEN) + errorSuffix
  }

  // If no tool_response, still use tool_name + note for visibility
  return prefix + errorSuffix
}

async function main() {
  const raw = await readStdin(3000)
  if (!raw.trim()) return

  let data
  try { data = JSON.parse(raw) } catch { return }

  const hookEvent = data.hook_event_name || ''
  const sessionId = data.session_id || 'unknown'
  const toolName = data.tool_name || 'unknown'
  const toolResponse = data.tool_response
  const errorMsg = data.error || ''
  const isFailure = hookEvent === 'PostToolUseFailure'

  if (hookEvent !== 'PostToolUse' && hookEvent !== 'PostToolUseFailure') return

  const model = process.env.QODER_MODEL || 'deepseek-v4-pro'

  // Build message from tool_response (available in PostToolUse/PostToolUseFailure)
  const message = getToolResultMessage(toolName, toolResponse, isFailure, errorMsg)
  const byteLen = Buffer.byteLength(message, 'utf8')

  const turnData = {
    session_id: sessionId,
    type: 'turn',
    role: 'ai',
    timestamp: new Date().toISOString(),
    model_used: model,
    message: message,
    note: isFailure ? `工具执行失败: ${toolName}` : `工具名: ${toolName}`,
    output_tokens: Math.max(1, Math.floor(byteLen / 4)),
    message_size_bytes: byteLen,
    data_source: 'hook',
  }

  log(`POST /api/turns (ai): session=${sessionId}, tool=${toolName}, len=${message.length}`)
  const result = await postToApi('/api/turns', turnData)
  log(`Response: ${JSON.stringify(result)}`)
}

main().catch(() => process.exit(0))

'use strict'

/**
 * Kyron Medical — MCP Client
 *
 * Spawns the MCP server as a child process and communicates with it
 * over stdin/stdout using the Model Context Protocol (JSON-RPC 2.0).
 *
 * Implements a singleton pattern — the server process is spawned once
 * on first use and reused for the lifetime of the Fastify application.
 *
 * Public API:
 *   getOpenAITools()      — returns tool definitions in OpenAI function-calling format
 *   callTool(name, args)  — executes a tool via MCP and returns the parsed result
 */

const { spawn }  = require('child_process')
const path       = require('path')
const readline   = require('readline')

const MCP_SERVER_PATH = path.join(__dirname, '../mcp/kyron-medical-server.mjs')

// ── Singleton State ────────────────────────────────────────────────────────────

let serverProcess   = null   // child_process.ChildProcess
let rl              = null   // readline interface on server stdout
let requestId       = 1      // auto-incrementing JSON-RPC request ID
let pendingRequests = {}     // id → { resolve, reject }
let cachedTools     = null   // cached after first tools/list call
let initPromise     = null   // ensures we only initialize once

// ── Transport Helpers ──────────────────────────────────────────────────────────

function sendToServer(method, params) {
  return new Promise((resolve, reject) => {
    const id = requestId++
    pendingRequests[id] = { resolve, reject }

    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    serverProcess.stdin.write(message)

    // Timeout guard — reject if MCP server doesn't respond in 10s
    setTimeout(() => {
      if (pendingRequests[id]) {
        delete pendingRequests[id]
        reject(new Error(`MCP timeout for method: ${method}`))
      }
    }, 10_000)
  })
}

function sendNotification(method) {
  const message = JSON.stringify({ jsonrpc: '2.0', method }) + '\n'
  serverProcess.stdin.write(message)
}

// ── Initialization ─────────────────────────────────────────────────────────────

async function initialize() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    // Spawn MCP server — inherits our env so it gets DATABASE_URL automatically
    serverProcess = spawn(process.execPath, [MCP_SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'inherit'], // stdin, stdout, stderr → parent terminal
      env:   process.env,
    })

    serverProcess.on('error', (err) => {
      console.error('[MCP] Server process error:', err.message)
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0) console.error(`[MCP] Server exited with code ${code}`)
      serverProcess = null
      initPromise   = null
      cachedTools   = null
    })

    // Read responses from server stdout — each line is a JSON-RPC response
    rl = readline.createInterface({ input: serverProcess.stdout, terminal: false })

    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      let response
      try {
        response = JSON.parse(trimmed)
      } catch {
        console.error('[MCP] Malformed response from server:', trimmed)
        return
      }

      const pending = pendingRequests[response.id]
      if (!pending) return

      delete pendingRequests[response.id]

      if (response.error) {
        pending.reject(new Error(response.error.message))
      } else {
        pending.resolve(response.result)
      }
    })

    // ── MCP Handshake ──────────────────────────────────────────────────────────
    // Step 1: initialize — server advertises capabilities
    await sendToServer('initialize', {
      protocolVersion: '2024-11-05',
      capabilities:    {},
      clientInfo:      { name: 'kyron-ai-client', version: '1.0.0' },
    })

    // Step 2: notify server we're ready (no response expected)
    sendNotification('notifications/initialized')

    console.log('[MCP] Connected to kyron-medical server')
  })()

  return initPromise
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns tool definitions converted from MCP JSON Schema format
 * to the OpenAI function-calling format.
 * Result is cached after the first call.
 */
async function getOpenAITools() {
  await initialize()

  if (cachedTools) return cachedTools

  const { tools } = await sendToServer('tools/list', {})

  // MCP inputSchema is already JSON Schema — OpenAI parameters accepts the same shape
  cachedTools = tools.map((tool) => ({
    type: 'function',
    function: {
      name:        tool.name,
      description: tool.description,
      parameters:  tool.inputSchema,
    },
  }))

  return cachedTools
}

/**
 * Calls a named tool on the MCP server with the given arguments.
 * Returns the parsed JSON result from the server's content response.
 */
async function callTool(name, args) {
  await initialize()

  const result = await sendToServer('tools/call', { name, arguments: args })

  // MCP response format: { content: [{ type: 'text', text: '...' }] }
  const textContent = result.content?.find((c) => c.type === 'text')
  if (!textContent) throw new Error(`MCP tool ${name} returned no text content`)

  return JSON.parse(textContent.text)
}

/**
 * Gracefully shuts down the MCP server process.
 * Called during Fastify's onClose hook.
 */
function shutdown() {
  if (serverProcess) {
    serverProcess.stdin.end()
    serverProcess = null
    initPromise   = null
    cachedTools   = null
  }
}

module.exports = { getOpenAITools, callTool, shutdown }

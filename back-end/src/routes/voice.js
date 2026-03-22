'use strict'

/**
 * Voice Routes — Vapi.ai outbound call with full tool support
 *
 * POST /api/voice/call
 *   Initiates an outbound call. Injects chat history AND registers server-side
 *   tools so Kara on the phone can actually book appointments, check prescriptions,
 *   etc. — not just talk about them.
 *
 * POST /api/voice/tool
 *   Webhook that Vapi calls when the voice assistant wants to execute a tool.
 *   Runs the tool via our MCP server and returns the result to Vapi.
 *
 * How server-side tools work:
 *   1. We define tools in the Vapi call config with a `server.url` pointing here
 *   2. When voice Kara decides to call a tool, Vapi POSTs to /api/voice/tool
 *   3. We execute it via MCP → Prisma → DB and return the result as JSON
 *   4. Vapi feeds the result back to GPT-4o and Kara speaks the response
 *
 * Required .env:
 *   VAPI_API_KEY          — from app.vapi.ai → Account → API Keys
 *   VAPI_PHONE_NUMBER_ID  — UUID from app.vapi.ai → Phone Numbers
 *   VAPI_SERVER_URL       — public URL to THIS server (use ngrok locally)
 *                           e.g. https://abc123.ngrok.io
 *
 * Local setup (one time):
 *   npm install -g ngrok
 *   ngrok http 4000        ← copy the https URL into VAPI_SERVER_URL
 */

const { callTool } = require('../services/mcp-client')

const VAPI_API_URL = 'https://api.vapi.ai/call'

const KARA_VOICE_SYSTEM_PROMPT = `
You are Kara, an AI medical assistant for Kyron Medical on a phone call.
You are CONTINUING an existing chat conversation with this patient.
Do NOT re-introduce yourself — pick up naturally from where the chat left off.

You have the same tools as the chat: you can find available slots, book appointments,
check prescriptions, view appointments, and cancel bookings.

Phone call rules:
- Keep responses short and natural — this is a voice call, not a chat
- Spell out times and dates clearly: "Monday April twentieth at nine AM"
- When booking, confirm the provider name, date, time, and appointment type out loud
- End calls warmly after completing the patient's request
`

// ── Tool definitions (Vapi format) ────────────────────────────────────────────
// server.url tells Vapi to POST to our webhook instead of running tools locally
function buildVapiTools(serverUrl) {
  const toolUrl = `${serverUrl}/api/voice/tool`
  return [
    {
      type: 'function',
      function: {
        name: 'find_available_slots',
        description: 'Find available appointment slots by specialty and date range.',
        parameters: {
          type: 'object',
          properties: {
            specialty:  { type: 'string', enum: ['CARDIOLOGY','ORTHOPEDICS','DERMATOLOGY','NEUROLOGY','GENERAL'] },
            startDate:  { type: 'string', description: 'YYYY-MM-DD' },
            endDate:    { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['startDate', 'endDate'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book an appointment once the patient confirms slot, provider, and type.',
        parameters: {
          type: 'object',
          properties: {
            patientId:         { type: 'string' },
            providerId:        { type: 'string' },
            slotId:            { type: 'string' },
            appointmentType:   { type: 'string', enum: ['TELE','IN_PERSON'] },
            appointmentDate:   { type: 'string', description: 'YYYY-MM-DD' },
            appointmentReason: { type: 'string' },
          },
          required: ['patientId','providerId','slotId','appointmentType','appointmentDate'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'get_patient_appointments',
        description: 'Get all appointments for the patient.',
        parameters: {
          type: 'object',
          properties: { patientId: { type: 'string' } },
          required: ['patientId'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'get_patient_prescriptions',
        description: 'Get all prescriptions for the patient.',
        parameters: {
          type: 'object',
          properties: { patientId: { type: 'string' } },
          required: ['patientId'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'cancel_appointment',
        description: 'Cancel an appointment and release the slot.',
        parameters: {
          type: 'object',
          properties: { appointmentId: { type: 'string' } },
          required: ['appointmentId'],
        },
      },
      server: { url: toolUrl },
    },
  ]
}

module.exports = async function (fastify) {

  // ── POST /api/voice/call ───────────────────────────────────────────────────
  fastify.post('/call', {
    schema: {
      tags: ['Voice'],
      summary: 'Initiate an outbound Vapi call with full tool support and chat history',
      body: {
        type: 'object',
        required: ['patientId', 'phoneNumber'],
        properties: {
          patientId:           { type: 'string' },
          phoneNumber:         { type: 'string', description: 'E.164 format e.g. +12125551234' },
          conversationHistory: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
  }, async (request, reply) => {
    const { patientId, phoneNumber, conversationHistory = [] } = request.body

    const patient = await fastify.prisma.patient.findUnique({ where: { patientId } })
    if (!patient) return reply.code(404).send({ error: 'Patient not found' })

    const vapiKey       = process.env.VAPI_API_KEY
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID
    const serverUrl     = process.env.VAPI_SERVER_URL?.replace(/\/$/, '') // strip trailing slash

    if (!vapiKey || !phoneNumberId) {
      return reply.code(503).send({ error: 'Voice calling not configured — set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID' })
    }
    if (!serverUrl) {
      return reply.code(503).send({ error: 'VAPI_SERVER_URL not set — run: ngrok http 4000, then add the URL to .env' })
    }

    // Inject prior chat as real OpenAI messages — text only, no tool_call objects
    // This gives the voice Kara actual conversational memory, not just a text dump
    const priorMessages = conversationHistory
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))

    const systemContent = KARA_VOICE_SYSTEM_PROMPT
      + `\n\nCurrent patient: ${patient.firstName} ${patient.lastName} (ID: ${patientId})`

    const vapiResponse = await fetch(VAPI_API_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId,
        customer: { number: phoneNumber },
        assistant: {
          name:         'Kara',
          firstMessage: `Hi ${patient.firstName}, it's Kara from Kyron Medical. Let's continue where we left off.`,
          model: {
            provider: 'openai',
            model:    'gpt-4o',
            messages: [
              { role: 'system', content: systemContent },
              ...priorMessages,   // ← full chat history injected here
            ],
            tools: buildVapiTools(serverUrl),  // ← live tools via webhook
          },
          voice: {
            provider: '11labs',
            voiceId:  'EXAVITQu4vr4xnSDxMaL', // Bella — warm, professional
          },
          endCallFunctionEnabled: true,
          endCallMessage:         'Thank you, take care. Goodbye!',
        },
      }),
    })

    if (!vapiResponse.ok) {
      const err = await vapiResponse.text()
      fastify.log.error(`[VAPI] Call failed: ${err}`)
      return reply.code(502).send({ error: 'Failed to initiate call', detail: err })
    }

    const callData = await vapiResponse.json()
    fastify.log.info(`[VAPI] Call initiated: ${callData.id}`)
    return { success: true, callId: callData.id, status: callData.status }
  })


  // ── POST /api/voice/tool ───────────────────────────────────────────────────
  // Vapi calls this webhook when the voice assistant wants to execute a tool.
  // We route through mcp-client → MCP server → Prisma and return in Vapi's format.
  fastify.post('/tool', {
    schema: {
      tags: ['Voice'],
      summary: 'Vapi tool webhook — executes a tool call from the voice assistant via MCP',
    },
  }, async (request, reply) => {
    const toolCallList = request.body?.message?.toolCallList

    if (!toolCallList?.length) {
      return reply.code(400).send({ error: 'No tool calls in request' })
    }

    const results = await Promise.all(
      toolCallList.map(async (toolCall) => {
        const name = toolCall.function?.name
        let   args = {}

        try {
          args = typeof toolCall.function?.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : (toolCall.function?.arguments ?? {})
        } catch {
          return { toolCallId: toolCall.id, result: JSON.stringify({ error: 'Invalid arguments' }) }
        }

        fastify.log.info(`[VAPI TOOL] ${name}(${JSON.stringify(args)})`)

        try {
          const result = await callTool(name, args)
          return { toolCallId: toolCall.id, result: JSON.stringify(result) }
        } catch (err) {
          fastify.log.error(`[VAPI TOOL] ${name} failed: ${err.message}`)
          return { toolCallId: toolCall.id, result: JSON.stringify({ error: err.message }) }
        }
      })
    )

    // Vapi expects: { results: [{ toolCallId, result }] }
    return { results }
  })
}

'use strict'

/**
 * Kyron Medical — MCP Tool Server
 *
 * Implements the Model Context Protocol (MCP) over stdio transport.
 * MCP is a JSON-RPC 2.0 based protocol that lets AI models discover
 * and call tools through a standardised interface.
 *
 * Wire format: newline-delimited JSON messages on stdin/stdout.
 *
 * Supported MCP methods:
 *   initialize              — handshake, advertise capabilities
 *   notifications/initialized — client ack (no response needed)
 *   tools/list              — return all available tool schemas
 *   tools/call              — execute a named tool with arguments
 *
 * This server runs as a child process spawned by the MCP client
 * in src/services/mcp-client.js.
 */

const readline  = require('readline')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// ── MCP Tool Schemas (JSON Schema format, per MCP spec) ───────────────────────

const TOOL_SCHEMAS = [
  {
    name: 'find_available_slots',
    description: 'Find available appointment slots by medical specialty and date range. Use when patient wants to schedule an appointment or asks about availability.',
    inputSchema: {
      type: 'object',
      properties: {
        specialty: {
          type: 'string',
          enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'],
          description: 'Medical specialty inferred from patient symptoms or explicit request',
        },
        startDate: { type: 'string', description: 'Start of date range in YYYY-MM-DD format' },
        endDate:   { type: 'string', description: 'End of date range in YYYY-MM-DD format' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment for the patient once they have selected a slot. Requires patientId, providerId, slotId, and appointmentType.',
    inputSchema: {
      type: 'object',
      properties: {
        patientId:         { type: 'string', description: 'UUID of the patient' },
        providerId:        { type: 'string', description: 'UUID of the provider' },
        slotId:            { type: 'string', description: 'UUID of the selected slot' },
        appointmentType:   { type: 'string', enum: ['TELE', 'IN_PERSON'] },
        appointmentDate:   { type: 'string', description: 'Date in YYYY-MM-DD format' },
        appointmentReason: { type: 'string', description: 'Reason or symptoms described by patient' },
      },
      required: ['patientId', 'providerId', 'slotId', 'appointmentType', 'appointmentDate'],
    },
  },
  {
    name: 'get_patient_appointments',
    description: 'Get all appointments for the current patient. Use when patient asks about upcoming or past appointments.',
    inputSchema: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_patient_prescriptions',
    description: 'Get all prescriptions for the current patient. Use when patient asks about medications or refills.',
    inputSchema: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'UUID of the patient' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an appointment and release the slot back to available. Use when patient explicitly asks to cancel.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'UUID of the appointment to cancel' },
      },
      required: ['appointmentId'],
    },
  },
]

// ── Tool Executors ─────────────────────────────────────────────────────────────

async function find_available_slots({ specialty, startDate, endDate }) {
  const slotWhere = { status: 'AVAILABLE' }
  if (startDate || endDate) {
    slotWhere.slotDate = {}
    if (startDate) slotWhere.slotDate.gte = new Date(startDate)
    if (endDate)   slotWhere.slotDate.lte = new Date(endDate)
  }

  const slots = await prisma.providerSlot.findMany({
    where: {
      ...slotWhere,
      provider: specialty ? { specialty } : undefined,
    },
    include: {
      provider: {
        select: {
          providerId:        true,
          providerFirstName: true,
          providerLastName:  true,
          specialty:         true,
        },
      },
    },
    orderBy: [{ slotDate: 'asc' }, { slotStartTime: 'asc' }],
    take: 10,
  })

  if (!slots.length) return { available: false, message: 'No available slots found for the given criteria' }
  return { available: true, slots }
}

async function book_appointment({ patientId, providerId, slotId, appointmentType, appointmentDate, appointmentReason }) {
  const slot = await prisma.providerSlot.findUnique({ where: { slotId } })
  if (!slot)                          return { success: false, error: 'Slot not found' }
  if (slot.providerId !== providerId) return { success: false, error: 'Slot does not belong to this provider' }
  if (slot.status !== 'AVAILABLE')    return { success: false, error: 'Slot is no longer available' }

  const patient = await prisma.patient.findUnique({ where: { patientId } })
  if (!patient) return { success: false, error: 'Patient not found' }

  try {
    const [appointment] = await prisma.$transaction([
      prisma.appointment.create({
        data: {
          patientId,
          providerId,
          slotId,
          appointmentType,
          appointmentDate:   new Date(appointmentDate),
          appointmentReason: appointmentReason || null,
          apptStatus:        'PENDING',
        },
        include: { patient: true, provider: true, slot: true },
      }),
      prisma.providerSlot.update({
        where: { slotId },
        data:  { status: 'BOOKED' },
      }),
    ])
    return { success: true, appointment }
  } catch (err) {
    if (err.code === 'P2002') return { success: false, error: 'Slot was just taken by another patient, please choose another' }
    throw err
  }
}

async function get_patient_appointments({ patientId }) {
  const appointments = await prisma.appointment.findMany({
    where:   { patientId },
    include: { provider: true, slot: true },
    orderBy: { appointmentDate: 'asc' },
  })
  if (!appointments.length) return { found: false, message: 'No appointments found for this patient' }
  return { found: true, appointments }
}

async function get_patient_prescriptions({ patientId }) {
  const visits = await prisma.visitHistory.findMany({
    where:   { patientId },
    include: { prescriptions: true },
  })
  const prescriptions = visits.flatMap((v) => v.prescriptions)
  if (!prescriptions.length) return { found: false, message: 'No prescriptions found for this patient' }
  return { found: true, prescriptions }
}

async function cancel_appointment({ appointmentId }) {
  const appt = await prisma.appointment.findUnique({ where: { appointmentId } })
  if (!appt) return { success: false, error: 'Appointment not found' }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { appointmentId },
      data:  { apptStatus: 'CANCELLED' },
    }),
    prisma.providerSlot.update({
      where: { slotId: appt.slotId },
      data:  { status: 'AVAILABLE' },
    }),
  ])
  return { success: true, message: 'Appointment cancelled and slot released' }
}

// ── Tool Dispatcher ────────────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    case 'find_available_slots':      return find_available_slots(args)
    case 'book_appointment':          return book_appointment(args)
    case 'get_patient_appointments':  return get_patient_appointments(args)
    case 'get_patient_prescriptions': return get_patient_prescriptions(args)
    case 'cancel_appointment':        return cancel_appointment(args)
    default: return { error: `Unknown tool: ${name}` }
  }
}

// ── MCP JSON-RPC 2.0 Transport ─────────────────────────────────────────────────
// MCP uses newline-delimited JSON over stdio.
// Each line in is a request, each line out is a response.

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

// ── MCP Request Handler ────────────────────────────────────────────────────────

async function handleRequest(request) {
  const { id, method, params } = request

  switch (method) {

    // Handshake — client sends this first, we advertise our capabilities
    case 'initialize':
      sendResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'kyron-medical', version: '1.0.0' },
      })
      break

    // Client acknowledges the handshake — no response expected (notification)
    case 'notifications/initialized':
      break

    // List all available tools with their JSON Schema definitions
    case 'tools/list':
      sendResult(id, { tools: TOOL_SCHEMAS })
      break

    // Execute a named tool and return the result as MCP content
    case 'tools/call': {
      const { name, arguments: args } = params
      try {
        const result = await callTool(name, args || {})
        sendResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        })
      } catch (err) {
        sendError(id, -32603, err.message)
      }
      break
    }

    default:
      sendError(id, -32601, `Method not found: ${method}`)
  }
}

// ── Stdio Loop ─────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let request
  try {
    request = JSON.parse(trimmed)
  } catch {
    sendError(null, -32700, 'Parse error')
    return
  }

  handleRequest(request).catch((err) => {
    sendError(request.id ?? null, -32603, err.message)
  })
})

rl.on('close', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

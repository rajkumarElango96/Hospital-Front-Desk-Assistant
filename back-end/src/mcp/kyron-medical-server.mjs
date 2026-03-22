/**
 * Kyron Medical — MCP Tool Server (Official SDK)
 *
 * Rewritten using @modelcontextprotocol/sdk instead of hand-rolled JSON-RPC.
 * The SDK handles the initialize handshake, tools/list, tools/call routing,
 * and stdio transport automatically.
 *
 * Runs as a child process spawned by src/services/mcp-client.js.
 */

import { McpServer }           from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z }                    from 'zod'
import { PrismaClient }         from '@prisma/client'
import { createRequire }        from 'module'

// mailer.js is CommonJS — use createRequire to import it from ESM
const require = createRequire(import.meta.url)
const { sendConfirmationEmail } = require('../utils/mailer.js')

const prisma = new PrismaClient()

// ── Create MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name:    'kyron-medical',
  version: '1.0.0',
})

// ── Tool: find_available_slots ─────────────────────────────────────────────────

server.tool(
  'find_available_slots',
  'Find available appointment slots by medical specialty and date range. Use when patient wants to schedule an appointment or asks about availability.',
  {
    specialty:  z.enum(['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'])
                 .optional()
                 .describe('Medical specialty inferred from patient symptoms or explicit request'),
    startDate:  z.string().describe('Start of date range in YYYY-MM-DD format'),
    endDate:    z.string().describe('End of date range in YYYY-MM-DD format'),
  },
  async ({ specialty, startDate, endDate }) => {
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

    const result = slots.length
      ? { available: true, slots }
      : { available: false, message: 'No available slots found for the given criteria' }

    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  },
)

// ── Tool: book_appointment ─────────────────────────────────────────────────────

server.tool(
  'book_appointment',
  'Book an appointment for the patient once they have selected a slot. Requires patientId, providerId, slotId, and appointmentType.',
  {
    patientId:         z.string().describe('UUID of the patient'),
    providerId:        z.string().describe('UUID of the provider'),
    slotId:            z.string().describe('UUID of the selected slot'),
    appointmentType:   z.enum(['TELE', 'IN_PERSON']),
    appointmentDate:   z.string().describe('Date in YYYY-MM-DD format'),
    appointmentReason: z.string().optional().describe('Reason or symptoms described by patient'),
  },
  async ({ patientId, providerId, slotId, appointmentType, appointmentDate, appointmentReason }) => {
    const slot = await prisma.providerSlot.findUnique({ where: { slotId } })
    if (!slot)                          return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Slot not found' }) }] }
    if (slot.providerId !== providerId) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Slot does not belong to this provider' }) }] }
    if (slot.status !== 'AVAILABLE')    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Slot is no longer available' }) }] }

    const patient = await prisma.patient.findUnique({ where: { patientId } })
    if (!patient) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Patient not found' }) }] }

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
      // Fire confirmation email automatically — non-blocking, don't fail booking if email fails
      sendConfirmationEmail(appointment).catch((e) =>
        console.error('[MAILER] Failed to send confirmation email:', e.message)
      )
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, appointment }) }] }
    } catch (err) {
      const error = err.code === 'P2002'
        ? 'Slot was just taken by another patient, please choose another'
        : err.message
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }] }
    }
  },
)

// ── Tool: get_patient_appointments ────────────────────────────────────────────

server.tool(
  'get_patient_appointments',
  'Get all appointments for the current patient. Use when patient asks about upcoming or past appointments.',
  {
    patientId: z.string().describe('UUID of the patient'),
  },
  async ({ patientId }) => {
    const appointments = await prisma.appointment.findMany({
      where:   { patientId },
      include: { provider: true, slot: true },
      orderBy: { appointmentDate: 'asc' },
    })

    const result = appointments.length
      ? { found: true, appointments }
      : { found: false, message: 'No appointments found for this patient' }

    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  },
)

// ── Tool: get_patient_prescriptions ───────────────────────────────────────────

server.tool(
  'get_patient_prescriptions',
  'Get all prescriptions for the current patient. Use when patient asks about medications or refills.',
  {
    patientId: z.string().describe('UUID of the patient'),
  },
  async ({ patientId }) => {
    const visits = await prisma.visitHistory.findMany({
      where:   { patientId },
      include: { prescriptions: true },
    })
    const prescriptions = visits.flatMap((v) => v.prescriptions)

    const result = prescriptions.length
      ? { found: true, prescriptions }
      : { found: false, message: 'No prescriptions found for this patient' }

    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  },
)

// ── Tool: cancel_appointment ──────────────────────────────────────────────────

server.tool(
  'cancel_appointment',
  'Cancel an appointment and release the slot back to available. Use when patient explicitly asks to cancel.',
  {
    appointmentId: z.string().describe('UUID of the appointment to cancel'),
  },
  async ({ appointmentId }) => {
    const appt = await prisma.appointment.findUnique({ where: { appointmentId } })
    if (!appt) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Appointment not found' }) }] }

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

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Appointment cancelled and slot released' }) }] }
  },
)

// ── Start Server ───────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

'use strict'

/**
 * Tool Implementations — Kyron Medical AI Layer
 *
 * Each function here maps 1:1 to an OpenAI tool definition.
 * GPT-4o decides which tool to call based on the patient's message.
 * We execute directly via Prisma — no HTTP round trip to our own endpoints.
 */

// ── Tool Definitions (sent to OpenAI) ─────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'find_available_slots',
      description: 'Find available appointment slots by medical specialty and date range. Use when patient wants to schedule an appointment or asks about availability.',
      parameters: {
        type: 'object',
        properties: {
          specialty: {
            type: 'string',
            enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'],
            description: 'Medical specialty inferred from patient symptoms or explicit request',
          },
          startDate: {
            type: 'string',
            description: 'Start of date range in YYYY-MM-DD format',
          },
          endDate: {
            type: 'string',
            description: 'End of date range in YYYY-MM-DD format',
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment for the patient once they have selected a slot. Requires patientId, providerId, slotId, and appointmentType.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description: 'Get all appointments for the current patient. Use when patient asks about their upcoming or past appointments.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'string', description: 'UUID of the patient' },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_prescriptions',
      description: 'Get all prescriptions for the current patient. Use when patient asks about their medications or refills.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'string', description: 'UUID of the patient' },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an appointment for the patient. Use when patient explicitly asks to cancel.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string', description: 'UUID of the appointment to cancel' },
        },
        required: ['appointmentId'],
      },
    },
  },
]

// ── Tool Executors (called when GPT-4o fires a tool) ──────────────────────────

async function find_available_slots(prisma, { specialty, startDate, endDate }) {
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
    take: 10, // limit to 10 so GPT response stays concise
  })

  if (!slots.length) return { available: false, message: 'No available slots found for the given criteria' }
  return { available: true, slots }
}

async function book_appointment(prisma, { patientId, providerId, slotId, appointmentType, appointmentDate, appointmentReason }) {
  // Validate slot
  const slot = await prisma.providerSlot.findUnique({ where: { slotId } })
  if (!slot)                       return { success: false, error: 'Slot not found' }
  if (slot.providerId !== providerId) return { success: false, error: 'Slot does not belong to this provider' }
  if (slot.status !== 'AVAILABLE') return { success: false, error: 'Slot is no longer available' }

  // Validate patient
  const patient = await prisma.patient.findUnique({ where: { patientId } })
  if (!patient) return { success: false, error: 'Patient not found' }

  // Atomic transaction
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

async function get_patient_appointments(prisma, { patientId }) {
  const appointments = await prisma.appointment.findMany({
    where:   { patientId },
    include: { provider: true, slot: true },
    orderBy: { appointmentDate: 'asc' },
  })
  if (!appointments.length) return { found: false, message: 'No appointments found for this patient' }
  return { found: true, appointments }
}

async function get_patient_prescriptions(prisma, { patientId }) {
  const visits = await prisma.visitHistory.findMany({
    where:   { patientId },
    include: { prescriptions: true },
  })
  const prescriptions = visits.flatMap((v) => v.prescriptions)
  if (!prescriptions.length) return { found: false, message: 'No prescriptions found for this patient' }
  return { found: true, prescriptions }
}

async function cancel_appointment(prisma, { appointmentId }) {
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

// ── Tool Dispatcher ───────────────────────────────────────────────────────────
// Called by the OpenAI service when GPT-4o fires a tool_call

async function executeTool(prisma, toolName, toolArgs) {
  switch (toolName) {
    case 'find_available_slots':     return find_available_slots(prisma, toolArgs)
    case 'book_appointment':         return book_appointment(prisma, toolArgs)
    case 'get_patient_appointments': return get_patient_appointments(prisma, toolArgs)
    case 'get_patient_prescriptions':return get_patient_prescriptions(prisma, toolArgs)
    case 'cancel_appointment':       return cancel_appointment(prisma, toolArgs)
    default: return { error: `Unknown tool: ${toolName}` }
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool }

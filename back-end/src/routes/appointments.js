'use strict'

/**
 * Appointments Route — Kyron Medical
 *
 * SCHEDULING LOGIC OVERVIEW
 * ─────────────────────────
 * The POST / (book appointment) endpoint implements a 6-step booking
 * workflow designed to prevent double-booking, slot hijacking, and
 * orphaned data under concurrent load.
 *
 * Booking flow:
 *   1. Verify the slot exists                  → 404 if missing
 *   2. Verify slot belongs to this provider    → 400 if mismatch (prevents hijacking)
 *   3. Verify slot is AVAILABLE                → 409 if BOOKED or BLOCKED
 *   4. Verify the patient exists               → 404 if missing
 *   5. Atomic $transaction                     → INSERT appointment + UPDATE slot to BOOKED
 *        └─ P2002 catch handles race condition → 409 if two patients hit simultaneously
 *   6. Fire confirmation email async           → does not block the 201 response
 *
 * Double-booking protection layers:
 *   Layer 1 — Application: status check before transaction (Step 3)
 *   Layer 2 — DB transaction: atomic insert + update, no partial state
 *   Layer 3 — DB constraint: @unique on slotId in Appointment table
 *             Postgres physically rejects a second insert for the same slot.
 *             Prisma surfaces this as error code P2002, caught in Step 5.
 *
 * Cancellation logic (PATCH /:id/status):
 *   When status → CANCELLED, the slot is released back to AVAILABLE
 *   in the same $transaction so the slot is never left in a BOOKED
 *   state after a cancellation.
 */

const { sendConfirmationEmail } = require('../utils/mailer')

module.exports = async function (fastify) {

  // List all appointments. Optionally filter by patientId or status.
  fastify.get('/', {
    schema: {
      tags: ['Appointments'],
      summary: 'List all appointments',
      querystring: {
        type: 'object',
        properties: {
          patientId: { type: 'string' },
          status:    { type: 'string', enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] },
        },
      },
    },
  }, async (request) => {
    const { patientId, status } = request.query
    const where = {}
    if (patientId) where.patientId  = patientId
    if (status)    where.apptStatus = status
    return fastify.prisma.appointment.findMany({
      where,
      include: { patient: true, provider: true, slot: true },
      orderBy: { appointmentDate: 'asc' },
    })
  })

  // Fetch a single appointment with patient, provider, slot, and visit joined.
  fastify.get('/:id', {
    schema: {
      tags: ['Appointments'],
      summary: 'Get a single appointment with full detail',
    },
  }, async (request, reply) => {
    const appt = await fastify.prisma.appointment.findUnique({
      where:   { appointmentId: request.params.id },
      include: { patient: true, provider: true, slot: true, visit: true },
    })
    if (!appt) return reply.code(404).send({ error: 'Appointment not found' })
    return appt
  })

  /**  Book an appointment. Implements the full 6-step scheduling workflow.
  See module-level JSDoc for the complete flow and concurrency strategy. */
  fastify.post('/', {
    schema: {
      tags: ['Appointments'],
      summary: 'Book an appointment — full validation + atomic transaction',
      description: `
**Scheduling workflow (6 steps):**

1. Slot exists check → 404
2. Provider–slot ownership check → 400
3. Slot availability check → 409
4. Patient exists check → 404
5. Atomic transaction: INSERT appointment + UPDATE slot → BOOKED. P2002 caught for race conditions → 409
6. Async confirmation email — does not block response
      `,
      body: {
        type: 'object',
        required: ['patientId', 'providerId', 'slotId', 'appointmentType', 'appointmentDate'],
        properties: {
          patientId:         { type: 'string', description: 'UUID of the patient' },
          providerId:        { type: 'string', description: 'UUID of the provider' },
          slotId:            { type: 'string', description: 'UUID of the selected slot' },
          appointmentType:   { type: 'string', enum: ['TELE', 'IN_PERSON'] },
          appointmentDate:   { type: 'string', format: 'date' },
          appointmentReason: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { patientId, providerId, slotId, appointmentType, appointmentDate, appointmentReason } = request.body

    // ── Step 1: Slot exists? ────────────────────────────────────────────────
    const slot = await fastify.prisma.providerSlot.findUnique({ where: { slotId } })
    if (!slot) {
      return reply.code(404).send({ error: 'Slot not found' })
    }

    // ── Step 2: Slot belongs to this provider? ──────────────────────────────
    // Prevents a patient from using a valid slotId that belongs to a different provider.
    if (slot.providerId !== providerId) {
      return reply.code(400).send({ error: 'Slot does not belong to this provider' })
    }

    // ── Step 3: Slot is AVAILABLE? ──────────────────────────────────────────
    // BOOKED = taken by another patient. BLOCKED = manually blocked by admin.
    if (slot.status === 'BOOKED') {
      return reply.code(409).send({ error: 'Slot is already booked' })
    }
    if (slot.status === 'BLOCKED') {
      return reply.code(409).send({ error: 'Slot is unavailable' })
    }

    // ── Step 4: Patient exists? ─────────────────────────────────────────────
    const patient = await fastify.prisma.patient.findUnique({ where: { patientId } })
    if (!patient) {
      return reply.code(404).send({ error: 'Patient not found' })
    }

    // ── Step 5: Atomic transaction ──────────────────────────────────────────
    // Both writes succeed or both are rolled back.
    // If two patients pass Step 3 simultaneously, the @unique constraint on
    // slotId in Appointment fires for the second insert → Prisma P2002 error.
    let appointment
    try {
      const [created] = await fastify.prisma.$transaction([
        fastify.prisma.appointment.create({
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
        fastify.prisma.providerSlot.update({
          where: { slotId },
          data:  { status: 'BOOKED' },
        }),
      ])
      appointment = created
    } catch (err) {
      // P2002 = unique constraint violation → race condition, slot taken mid-transaction
      if (err.code === 'P2002') {
        return reply.code(409).send({ error: 'Slot was just booked by another patient, please select a different time' })
      }
      throw err
    }

    // ── Step 6: Confirmation email (fire-and-forget) ────────────────────────
    // Runs async after response is sent. Email failure never blocks the booking.
    sendConfirmationEmail(appointment).catch((e) =>
      fastify.log.error({ err: e }, 'Email send failed')
    )

    return reply.code(201).send(appointment)
  })

  /** Update appointment status. Cancelling atomically releases the slot back
  * to AVAILABLE so it can be booked by another patient immediately.
  */
  fastify.patch('/:id/status', {
    schema: {
      tags: ['Appointments'],
      summary: 'Update appointment status — cancelling frees the slot atomically',
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id }     = request.params
    const { status } = request.body

    // Cancellation: atomically update appointment + release slot in one transaction
    if (status === 'CANCELLED') {
      const appt = await fastify.prisma.appointment.findUnique({ where: { appointmentId: id } })
      if (!appt) return reply.code(404).send({ error: 'Appointment not found' })

      await fastify.prisma.$transaction([
        fastify.prisma.appointment.update({
          where: { appointmentId: id },
          data:  { apptStatus: 'CANCELLED' },
        }),
        fastify.prisma.providerSlot.update({
          where: { slotId: appt.slotId },
          data:  { status: 'AVAILABLE' },
        }),
      ])

      return { message: 'Appointment cancelled and slot released' }
    }

    // Non-cancellation status update (PENDING → CONFIRMED, CONFIRMED → COMPLETED, etc.)
    const updated = await fastify.prisma.appointment.update({
      where: { appointmentId: id },
      data:  { apptStatus: status },
    })
    return updated
  })
}

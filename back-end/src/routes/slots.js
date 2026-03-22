'use strict'

module.exports = async function (fastify) {

  // GET /api/slots/available — key query for the AI layer
  // ?specialty=CARDIOLOGY&startDate=2026-04-20&endDate=2026-04-24
  // ?providerId=<uuid>&startDate=2026-04-20&endDate=2026-04-24
  fastify.get('/available', {
    schema: {
      tags: ['Slots'],
      summary: 'Find available slots — filter by specialty or providerId and date range',
      querystring: {
        type: 'object',
        properties: {
          specialty:  { type: 'string', enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'] },
          providerId: { type: 'string' },
          startDate:  { type: 'string', format: 'date' },
          endDate:    { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request, reply) => {
    const { specialty, providerId, startDate, endDate } = request.query

    // Build the slot filter
    const slotWhere = { status: 'AVAILABLE' }
    if (providerId) slotWhere.providerId = providerId
    if (startDate || endDate) {
      slotWhere.slotDate = {}
      if (startDate) slotWhere.slotDate.gte = new Date(startDate)
      if (endDate)   slotWhere.slotDate.lte = new Date(endDate)
    }

    // Build the provider filter (used when filtering by specialty)
    const providerWhere = {}
    if (specialty) providerWhere.specialty = specialty

    const slots = await fastify.prisma.providerSlot.findMany({
      where: {
        ...slotWhere,
        provider: Object.keys(providerWhere).length ? providerWhere : undefined,
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
    })

    if (!slots.length) {
      return reply.code(404).send({ error: 'No available slots found for the given criteria' })
    }

    return slots
  })

  // GET /api/slots — list all slots with optional filters
  fastify.get('/', {
    schema: {
      tags: ['Slots'],
      summary: 'List slots — filter by ?providerId= ?date= ?status=',
      querystring: {
        type: 'object',
        properties: {
          providerId: { type: 'string' },
          date:       { type: 'string', format: 'date' },
          status:     { type: 'string', enum: ['AVAILABLE', 'BOOKED', 'BLOCKED'] },
        },
      },
    },
  }, async (request) => {
    const { providerId, date, status } = request.query
    const where = {}
    if (providerId) where.providerId = providerId
    if (status)     where.status     = status
    if (date)       where.slotDate   = new Date(date)
    return fastify.prisma.providerSlot.findMany({
      where,
      include: { provider: true },
      orderBy: [{ slotDate: 'asc' }, { slotStartTime: 'asc' }],
    })
  })

  // GET /api/slots/:id — single slot
  fastify.get('/:id', {
    schema: {
      tags: ['Slots'],
      summary: 'Get a single slot by ID',
    },
  }, async (request, reply) => {
    const slot = await fastify.prisma.providerSlot.findUnique({
      where:   { slotId: request.params.id },
      include: { provider: true },
    })
    if (!slot) return reply.code(404).send({ error: 'Slot not found' })
    return slot
  })

  // POST /api/slots — create a slot with overlap check
  fastify.post('/', {
    schema: {
      tags: ['Slots'],
      summary: 'Create a provider slot — rejects overlapping times',
      body: {
        type: 'object',
        required: ['providerId', 'slotDate', 'slotStartTime', 'slotEndTime'],
        properties: {
          providerId:    { type: 'string' },
          slotDate:      { type: 'string', format: 'date' },
          slotStartTime: { type: 'string', description: 'HH:MM e.g. 09:00' },
          slotEndTime:   { type: 'string', description: 'HH:MM e.g. 10:00' },
          timezone:      { type: 'string', enum: ['AMERICA_NEW_YORK', 'AMERICA_CHICAGO', 'AMERICA_DENVER', 'AMERICA_LOS_ANGELES'] },
        },
      },
    },
  }, async (request, reply) => {
    const { providerId, slotDate, slotStartTime, slotEndTime, timezone } = request.body

    // Overlap check — same provider, same date
    const existing = await fastify.prisma.providerSlot.findMany({
      where: { providerId, slotDate: new Date(slotDate) },
    })

    const newStart = new Date(`1970-01-01T${slotStartTime}`)
    const newEnd   = new Date(`1970-01-01T${slotEndTime}`)

    const hasOverlap = existing.some((s) => {
      const exStart = new Date(`1970-01-01T${s.slotStartTime.toISOString().substr(11, 8)}`)
      const exEnd   = new Date(`1970-01-01T${s.slotEndTime.toISOString().substr(11, 8)}`)
      return newStart < exEnd && newEnd > exStart
    })

    if (hasOverlap) {
      return reply.code(409).send({ error: 'Slot overlaps with an existing slot for this provider' })
    }

    const slot = await fastify.prisma.providerSlot.create({
      data: {
        providerId,
        slotDate:      new Date(slotDate),
        slotStartTime: new Date(`1970-01-01T${slotStartTime}`),
        slotEndTime:   new Date(`1970-01-01T${slotEndTime}`),
        timezone:      timezone || 'AMERICA_NEW_YORK',
        status:        'AVAILABLE',
      },
    })
    return reply.code(201).send(slot)
  })

  // PATCH /api/slots/:id/status — manually update slot status
  fastify.patch('/:id/status', {
    schema: {
      tags: ['Slots'],
      summary: 'Update slot status manually (e.g. block a slot)',
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['AVAILABLE', 'BOOKED', 'BLOCKED'] },
        },
      },
    },
  }, async (request, reply) => {
    const slot = await fastify.prisma.providerSlot.update({
      where: { slotId: request.params.id },
      data:  { status: request.body.status },
    })
    return slot
  })
}

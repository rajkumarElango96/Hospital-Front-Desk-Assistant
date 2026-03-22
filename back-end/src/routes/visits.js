'use strict'

module.exports = async function (fastify) {

  // GET /api/visits/patient/:patientId — all visits for a patient
  fastify.get('/patient/:patientId', async (request) => {
    return fastify.prisma.visitHistory.findMany({
      where:   { patientId: request.params.patientId },
      include: { appointment: true, prescriptions: true },
      orderBy: { appointmentId: 'desc' },
    })
  })

  // GET /api/visits/:id — single visit with prescriptions
  fastify.get('/:id', async (request, reply) => {
    const visit = await fastify.prisma.visitHistory.findUnique({
      where:   { visitId: request.params.id },
      include: { patient: true, appointment: true, prescriptions: true },
    })
    if (!visit) return reply.code(404).send({ error: 'Visit not found' })
    return visit
  })

  // POST /api/visits — create a visit record after an appointment is completed
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['patientId', 'appointmentId'],
        properties: {
          patientId:            { type: 'string' },
          appointmentId:        { type: 'string' },
          visitSummary:         { type: 'string' },
          prescriptionProvided: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { patientId, appointmentId, visitSummary, prescriptionProvided } = request.body

    // Mark appointment as COMPLETED when visit is created
    const visit = await fastify.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { appointmentId },
        data:  { apptStatus: 'COMPLETED' },
      })
      return tx.visitHistory.create({
        data: {
          patientId,
          appointmentId,
          visitSummary:         visitSummary         || null,
          prescriptionProvided: prescriptionProvided || false,
        },
      })
    })

    return reply.code(201).send(visit)
  })
}

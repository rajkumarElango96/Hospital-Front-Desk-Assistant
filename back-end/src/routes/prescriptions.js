'use strict'

module.exports = async function (fastify) {

  // GET /api/prescriptions/visit/:visitId — all prescriptions for a visit
  fastify.get('/visit/:visitId', async (request) => {
    return fastify.prisma.prescription.findMany({
      where:   { visitId: request.params.visitId },
      orderBy: { prescriptionDate: 'desc' },
    })
  })

  // GET /api/prescriptions/:id — single prescription
  fastify.get('/:id', async (request, reply) => {
    const rx = await fastify.prisma.prescription.findUnique({
      where:   { prescriptionId: request.params.id },
      include: { visit: true },
    })
    if (!rx) return reply.code(404).send({ error: 'Prescription not found' })
    return rx
  })

  // POST /api/prescriptions — issue a prescription
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['visitId', 'prescriptionDate', 'prescriptionMedicine'],
        properties: {
          visitId:              { type: 'string' },
          prescriptionDate:     { type: 'string', format: 'date' },
          prescriptionMedicine: { type: 'string' },
          isRefill:             { type: 'boolean' },
          nextRefillDate:       { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request, reply) => {
    const { visitId, prescriptionDate, prescriptionMedicine, isRefill, nextRefillDate } = request.body

    const rx = await fastify.prisma.prescription.create({
      data: {
        visitId,
        prescriptionDate:     new Date(prescriptionDate),
        prescriptionMedicine,
        isRefill:             isRefill       || false,
        nextRefillDate:       nextRefillDate ? new Date(nextRefillDate) : null,
      },
    })

    // If a prescription is issued, mark prescriptionProvided on the visit
    await fastify.prisma.visitHistory.update({
      where: { visitId },
      data:  { prescriptionProvided: true },
    })

    return reply.code(201).send(rx)
  })
}

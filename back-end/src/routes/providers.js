'use strict'

module.exports = async function (fastify) {

  // GET /api/providers — list all, optional ?specialty= filter
  fastify.get('/', async (request) => {
    const { specialty } = request.query
    return fastify.prisma.provider.findMany({
      where: specialty ? { specialty } : undefined,
    })
  })

  // GET /api/providers/:id — get provider with their available slots
  fastify.get('/:id', async (request, reply) => {
    const provider = await fastify.prisma.provider.findUnique({
      where:   { providerId: request.params.id },
      include: { slots: { where: { status: 'AVAILABLE' } } },
    })
    if (!provider) return reply.code(404).send({ error: 'Provider not found' })
    return provider
  })

  // POST /api/providers — create a provider
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['providerFirstName', 'providerLastName', 'npi', 'specialty'],
        properties: {
          providerFirstName: { type: 'string' },
          providerLastName:  { type: 'string' },
          npi:               { type: 'string' },
          specialty:         { type: 'string', enum: ['CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL'] },
        },
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.prisma.provider.create({ data: request.body })
    return reply.code(201).send(provider)
  })
}

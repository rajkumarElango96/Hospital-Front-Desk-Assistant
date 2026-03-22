'use strict'

const fp = require('fastify-plugin')
const { PrismaClient } = require('@prisma/client')

async function prismaPlugin(fastify) {
  const prisma = new PrismaClient()
  await prisma.$connect()

  // Decorate fastify instance so every route can access via fastify.prisma
  fastify.decorate('prisma', prisma)

  // Disconnect cleanly when server shuts down
  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect()
  })
}

module.exports = fp(prismaPlugin)

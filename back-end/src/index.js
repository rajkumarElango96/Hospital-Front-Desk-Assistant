'use strict'

require('dotenv').config()

const fastify = require('fastify')({ logger: true })

// ── Swagger (must register BEFORE routes) ─────────────────────────────────────
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: {
      title:       'Kyron Medical API',
      description: 'Patient-facing API powering the Kyron Medical chat assistant',
      version:     '1.0.0',
    },
    servers: [{ url: 'http://localhost:4000' }],
    tags: [
      { name: 'Chat',          description: 'AI assistant — Kara'          },
      { name: 'Patients',      description: 'Patient management'           },
      { name: 'Providers',     description: 'Provider / doctor management' },
      { name: 'Slots',         description: 'Provider slot availability'   },
      { name: 'Appointments',  description: 'Appointment booking'          },
      { name: 'Visits',        description: 'Visit history'                },
      { name: 'Prescriptions', description: 'Prescription management'      },
      { name: 'Voice',         description: 'Vapi.ai voice call handoff'   },
    ],
  },
})

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking:  true,
  },
})

// ── Plugins ───────────────────────────────────────────────────────────────────
fastify.register(require('@fastify/cors'), { origin: true })
fastify.register(require('./plugins/prisma'))

// ── Routes ────────────────────────────────────────────────────────────────────
fastify.register(require('./routes/chat'),          { prefix: '/api/chat'          })
fastify.register(require('./routes/patients'),      { prefix: '/api/patients'      })
fastify.register(require('./routes/providers'),     { prefix: '/api/providers'     })
fastify.register(require('./routes/slots'),         { prefix: '/api/slots'         })
fastify.register(require('./routes/appointments'),  { prefix: '/api/appointments'  })
fastify.register(require('./routes/visits'),        { prefix: '/api/visits'        })
fastify.register(require('./routes/prescriptions'), { prefix: '/api/prescriptions' })
fastify.register(require('./routes/voice'),         { prefix: '/api/voice'         })

// ── Health check ──────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 4000, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

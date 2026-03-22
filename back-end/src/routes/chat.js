'use strict'

const { runChat } = require('../services/openai')

module.exports = async function (fastify) {

  /**
   * POST /api/chat/message
   *
   * Single endpoint the React frontend calls for every chat message.
   * Passes the message + conversation history to GPT-4o.
   * GPT-4o decides which tools to call, we execute them, and return
   * a natural language reply to the frontend.
   */
  fastify.post('/message', {
    schema: {
      tags: ['Chat'],
      summary: 'Send a message to Kara — the Kyron Medical AI assistant',
      body: {
        type: 'object',
        required: ['patientId', 'message'],
        properties: {
          patientId:           { type: 'string', description: 'UUID of the logged-in patient' },
          message:             { type: 'string', description: 'The patient\'s chat message' },
          conversationHistory: {
            type: 'array',
            description: 'Full OpenAI message chain — includes user, assistant, tool-call, and tool-result messages. Send back exactly what was returned in the previous response.',
            items: {
              type: 'object',
              // Must be permissive — history now includes OpenAI tool_call messages:
              //   { role: 'assistant', content: null, tool_calls: [...] }
              //   { role: 'tool', tool_call_id: '...', content: '...' }
              // Restricting role enum or content type here would cause Fastify to
              // strip/reject those messages, breaking multi-turn booking context.
              additionalProperties: true,
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { patientId, message, conversationHistory = [] } = request.body

    // Verify patient exists before processing
    const patient = await fastify.prisma.patient.findUnique({ where: { patientId } })
    if (!patient) return reply.code(404).send({ error: 'Patient not found' })

    // prisma no longer passed — MCP server owns its own Prisma connection
    const { reply: aiReply, updatedHistory, slotsData } = await runChat(
      patientId,
      conversationHistory,
      message
    )

    return {
      reply:               aiReply,
      conversationHistory: updatedHistory,
      slotsData:           slotsData ?? null,
    }
  })
}

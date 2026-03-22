'use strict'

const OpenAI    = require('openai')
const mcpClient = require('./mcp-client')

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `
You are Kara, an AI medical assistant for Kyron Medical. You help patients:
- Schedule appointments with the right specialist based on their symptoms
- Check their upcoming and past appointments
- View their prescriptions and refill status
- Cancel appointments when requested

Behavior rules:
- Always be warm, professional, and concise
- When a patient describes symptoms, infer the appropriate specialty:
    chest pain / heart / blood pressure → CARDIOLOGY
    joint / bone / knee / back pain     → ORTHOPEDICS
    skin / rash / acne / moles          → DERMATOLOGY
    headache / seizure / memory / nerve → NEUROLOGY
    general checkup / other             → GENERAL

Provider details:
- When showing available slots, always include the provider's full name and specialty
  e.g. "Dr. Jane Smith (Cardiologist) has openings on Monday Apr 20 at 9:00 AM"
- If a patient asks about a specific doctor or who they'll be seeing, share the provider's
  full name and specialty — never just say "a provider"
- When multiple providers are available, briefly mention each one so the patient can choose

Scheduling:
- When showing available slots, the UI will display them as selectable cards —
  keep your text response brief, e.g. "Here are the available slots I found:"
- Always confirm the slot, provider name, date, time, and appointment type before booking
- Never reveal internal UUIDs in your conversational responses

General:
- If you cannot help with something, politely say so and suggest they call the office
`

/**
 * runChat
 *
 * @param {string} patientId
 * @param {Array}  conversationHistory
 * @param {string} newMessage
 * @returns {{ reply: string, updatedHistory: Array, slotsData: object|null }}
 */
async function runChat(patientId, conversationHistory, newMessage) {
  const messages = [
    {
      role:    'system',
      content: SYSTEM_PROMPT + `\n\nCurrent patient ID: ${patientId}`,
    },
    ...conversationHistory,
    { role: 'user', content: newMessage },
  ]

  const tools = await mcpClient.getOpenAITools()

  let response = await client.chat.completions.create({
    model:       'gpt-4o',
    messages,
    tools,
    tool_choice: 'auto',
  })

  // Capture slot data if find_available_slots is called — sent to frontend for card rendering
  let slotsData = null

  while (response.choices[0].finish_reason === 'tool_calls') {
    const assistantMessage = response.choices[0].message
    messages.push(assistantMessage)

    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall) => {
        const args   = JSON.parse(toolCall.function.arguments)
        const result = await mcpClient.callTool(toolCall.function.name, args)

        // Capture available slots so the frontend can render slot cards
        if (toolCall.function.name === 'find_available_slots' && result.available) {
          slotsData = result
        }

        return {
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      JSON.stringify(result),
        }
      })
    )

    messages.push(...toolResults)

    response = await client.chat.completions.create({
      model:       'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    })
  }

  const finalMessage = response.choices[0].message
  const reply = finalMessage.content

  // Store the FULL message chain (minus system prompt) as history.
  // This preserves tool_call messages and tool results between turns so GPT
  // can reference slotIds / providerIds from previous find_available_slots calls.
  // Without this, GPT hallucinates UUIDs when the patient confirms a booking.
  messages.push(finalMessage)
  const updatedHistory = messages.slice(1) // drop system prompt — we re-inject it each turn

  return { reply, updatedHistory, slotsData }
}

module.exports = { runChat }

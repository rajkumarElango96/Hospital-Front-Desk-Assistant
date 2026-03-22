# Kyron Medical — Backend

Fastify REST API powering the Kyron Medical patient-facing chat assistant (Kara).

## Architecture

```
React Frontend
      │
      │ HTTP (Vite proxy / Nginx)
      ▼
Fastify API  (port 4000)
      │
      ├── /api/chat/message  ──►  GPT-4o (OpenAI)
      │                               │
      │                               │ tool_calls
      │                               ▼
      │                        MCP Client (mcp-client.js)
      │                               │  JSON-RPC 2.0 over stdio
      │                               ▼
      │                        MCP Server (kyron-medical-server.js)
      │                               │  child process
      │                               ▼
      │                        Prisma ORM ──► PostgreSQL
      │
      ├── /api/voice/call  ──►  Vapi.ai REST API
      │                               │
      │                               │ tool webhook
      │                               ▼
      └── /api/voice/tool  ──►  MCP Client → Prisma → DB
```

### Key design decisions

**MCP (Model Context Protocol)** — The AI layer communicates with the database through an MCP server running as a child process over stdio. This decouples the AI orchestration layer from the data layer — swapping GPT-4o for Claude requires changing only `openai.js`, not the tool implementations.

**Atomic booking with double-booking prevention** — `$transaction([appointment.create, slot.update])` combined with a `@@unique([providerId, slotDate, slotStartTime])` DB constraint and P2002 error handling prevents race conditions.

**Full conversation history** — The complete OpenAI message chain (including tool_call and tool_result messages) is preserved and sent back on each turn, allowing GPT-4o to reference slot UUIDs from earlier in the conversation when the patient confirms a booking.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Fastify v5 |
| ORM | Prisma |
| Database | PostgreSQL |
| AI Model | GPT-4o (OpenAI) |
| Tool Protocol | MCP (JSON-RPC 2.0 over stdio, hand-rolled) |
| Voice | Vapi.ai (outbound calls + server-side tool webhooks) |
| Email | Nodemailer (Gmail SMTP) |
| API Docs | Swagger UI at `/docs` |

## Database Schema

6 models: `Patient`, `Provider`, `ProviderSlot`, `Appointment`, `VisitHistory`, `Prescription`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/message` | Send message to Kara (AI assistant) |
| POST | `/api/voice/call` | Initiate Vapi outbound voice call |
| POST | `/api/voice/tool` | Vapi tool webhook (executes tools server-side) |
| POST | `/api/patients` | Register a new patient |
| GET | `/api/slots/available` | Query available appointment slots |
| POST | `/api/appointments` | Book an appointment |
| PATCH | `/api/appointments/:id/status` | Cancel an appointment |
| GET | `/api/visits` | Get visit history |
| GET | `/api/prescriptions` | Get prescriptions |

Full docs at `http://localhost:4000/docs`

## MCP Tools

| Tool | Description |
|------|-------------|
| `find_available_slots` | Query slots by specialty and date range |
| `book_appointment` | Atomic slot booking with double-booking prevention |
| `get_patient_appointments` | Fetch upcoming and past appointments |
| `get_patient_prescriptions` | Fetch prescriptions with refill status |
| `cancel_appointment` | Cancel and atomically release the slot |

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env   # fill in values

# 3. Run migrations
npx prisma migrate dev

# 4. Seed sample data (1 week of slots, 4 providers, 3 patients)
node prisma/seed.js

# 5. Start server
node src/index.js
```

## Environment Variables

```env
DATABASE_URL=postgresql://user@localhost:5432/kyron_medical
OPENAI_API_KEY=sk-...

# Email (Gmail SMTP)
SMTP_USER=yourname@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    # Gmail App Password
SMTP_FROM="Kyron Medical <yourname@gmail.com>"

# Vapi voice calls
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
VAPI_SERVER_URL=https://your-public-url.com   # EC2 domain or ngrok URL for local dev
```

## What's Complete

- Patient intake and registration
- AI chat with GPT-4o and full tool calling via MCP
- Slot availability search by specialty and date
- Appointment booking with double-booking prevention
- Appointment cancellation with slot release
- Prescription and visit history retrieval
- Outbound voice call handoff via Vapi with conversation context
- Voice assistant can execute all tools via webhook (book, cancel, check prescriptions)
- HTML confirmation email on booking via nodemailer
- Swagger API documentation

## What's Incomplete / Known Issues

- **Email**: Nodemailer is wired but `SMTP_USER` / `SMTP_PASS` must be configured. Gmail App Password required.
- **Voice — phone number format**: Patient phone must be entered in US format during intake. International numbers not validated.
- **Voice — Vapi phone number**: Requires purchasing a phone number in the Vapi dashboard (~$2/month).
- **No authentication**: The app has no JWT/session auth. `patientId` is trusted from the client. Production would require Cognito or similar.
- **Prescription refill**: UI shows prescriptions but refill request flow is not implemented end-to-end.
- **SMS notifications**: Opt-in checkbox is wired in the UI but SMS sending (Twilio etc.) is not implemented.
- **Multi-timezone slot display**: Slots are displayed in UTC. Timezone-aware formatting not yet implemented.

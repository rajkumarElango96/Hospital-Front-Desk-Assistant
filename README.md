# Hospital Front Desk Assistant — Kyron Medical

AI-powered patient-facing web app built with React, Fastify, MCP, and OpenAI GPT-4o.

## Monorepo Structure

```
Hospital-Front-Desk-Assistant/
├── front-end/        # React 18 + Vite — Patient chat UI, intake form, voice call
└── back-end/         # Fastify + Node.js — API, MCP server, PostgreSQL, Vapi
```

## Quick Start

### Backend
```bash
cd back-end
npm install
cp .env.example .env   # fill in your keys
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend
```bash
cd front-end
npm install
npm run dev
```

## Architecture

- **Frontend** — React 18, Vite, chat UI with slot picker cards
- **Backend** — Fastify API, OpenAI tool-calling loop, hand-rolled MCP server over stdio
- **Database** — PostgreSQL via Prisma ORM
- **Voice** — Vapi.ai outbound calls with server-side tool webhooks
- **Email** — Nodemailer via Gmail SMTP

See `back-end/README.md` and `front-end/README.md` for full details.

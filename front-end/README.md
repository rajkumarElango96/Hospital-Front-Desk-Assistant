# Kyron Medical — Frontend

React patient-facing chat interface for the Kyron Medical AI assistant (Kara).

## Stack

- **React 18** + **Vite**
- **Liquid glass UI** — custom CSS with backdrop-filter, animated gradient background
- No UI framework — all styling is inline + custom CSS classes

## Key Components

```
App.jsx
  ├── IntakeCard       — patient registration form (E.164 phone, DOB, email)
  └── ChatScreen       — full-page chat interface
        ├── MessageBubble  — renders text, slot cards, confirmations, prescriptions
        ├── SlotPicker     — 2-col grid of appointment slot cards
        ├── ConfirmationCard
        ├── PrescriptionCards
        └── TypingIndicator
```

## Chat Flow

1. Patient fills out intake form → `POST /api/patients` → receives `patientId`
2. Patient sends a message → `POST /api/chat/message` with full `conversationHistory`
3. Backend returns `reply` (text) + optional `slotsData` (structured slot objects)
4. If `slotsData` present → render `SlotPicker` cards grouped by provider
5. Patient taps a slot → auto-sends booking message to Kara
6. Patient taps 📞 → `POST /api/voice/call` → Vapi dials patient with full chat context

## Local Setup

```bash
npm install
npm run dev    # starts on http://localhost:5173
```

Vite proxies `/api/*` → `http://127.0.0.1:4000` (backend must be running).

## Environment

No `.env` needed for the frontend — all API calls go through the Vite proxy to the backend.

## What's Complete

- Patient intake with E.164 phone formatting and live validation
- Full-page AI chat with typing indicator and auto-scroll
- Slot cards rendered inline in chat from real API data
- Action buttons (Schedule, Prescriptions, Appointments, Office Info)
- Voice call handoff button
- Voice calling overlay UI

## What's Incomplete

- **Confirmation card**: UI component exists but is not wired to the real booking confirmation flow
- **Prescription cards**: Renders mock data — not yet wired to real `/api/prescriptions` response
- **SMS opt-in**: Checkbox is present but backend SMS sending not implemented
- **Mobile responsiveness**: Designed for desktop — not optimised for small screens

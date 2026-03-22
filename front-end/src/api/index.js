// ─────────────────────────────────────────────────────────────────────────────
// Kyron Medical — API Client
// All backend calls go through here. Vite proxies /api → localhost:4000
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ── Patients ──────────────────────────────────────────────────────────────────
export const createPatient = (body) => request('POST', '/patients', body)

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendChatMessage = (body) => request('POST', '/chat/message', body)

// ── Voice ─────────────────────────────────────────────────────────────────────
export const initiateVoiceCall = (body) => request('POST', '/voice/call', body)

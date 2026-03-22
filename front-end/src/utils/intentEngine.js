import { DOCTORS } from "@/data/mockData";

export function detectIntent(message) {
  const m = message.toLowerCase();

  // Symptom → doctor match
  for (const doc of DOCTORS) {
    if (doc.keywords.some((k) => m.includes(k))) {
      return { type: "schedule", doctor: doc };
    }
  }

  if (/schedule|appointment|book|see a doctor|visit|consult/.test(m))
    return { type: "schedule_ask" };

  if (/prescription|refill|medication|medicine|drug/.test(m))
    return { type: "prescription" };

  if (/address|location|office|hours|where|direction|open|close/.test(m))
    return { type: "office" };

  if (/cancel|reschedule|change.*appoint/.test(m))
    return { type: "cancel" };

  const dayMatch = m.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
  if (dayMatch)
    return { type: "day_preference", day: dayMatch[0] };

  if (/hi|hello|hey|good morning|good afternoon|good evening/.test(m))
    return { type: "greeting" };

  return { type: "general" };
}

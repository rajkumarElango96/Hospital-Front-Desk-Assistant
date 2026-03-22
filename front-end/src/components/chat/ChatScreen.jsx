import { useEffect, useRef, useState } from "react";
import { sendChatMessage, initiateVoiceCall } from "@/api/index";
import { MessageBubble }   from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { PatientAvatar }   from "@/components/shared/Avatars";

// Colour per specialty — used as the dot accent in SlotPicker
const SPECIALTY_COLORS = {
  CARDIOLOGY:   "#ef4444",
  ORTHOPEDICS:  "#f97316",
  DERMATOLOGY:  "#a855f7",
  NEUROLOGY:    "#06b6d4",
  GENERAL:      "#22c55e",
};

/**
 * groupSlotsByProvider
 * Transforms raw slotsData from the API into the shape SlotPicker expects.
 * Groups by providerId so each provider gets their own card grid.
 */
function groupSlotsByProvider(slotsData) {
  if (!slotsData?.slots?.length) return [];

  const grouped = {};

  for (const slot of slotsData.slots) {
    const pid = slot.provider.providerId;
    if (!grouped[pid]) {
      grouped[pid] = {
        providerId: pid,
        name:       `Dr. ${slot.provider.providerFirstName} ${slot.provider.providerLastName}`,
        specialty:  slot.provider.specialty,
        color:      SPECIALTY_COLORS[slot.provider.specialty] ?? "#2563eb",
        slots:      [],
      };
    }

    // Format date: "Mon Apr 20" — use UTC to avoid timezone shift on date-only fields
    const date = new Date(slot.slotDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    });

    // Format time: "9:00 AM" — slotStartTime is stored as a Time type (1970 epoch)
    const time = new Date(slot.slotStartTime).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "UTC",
    });

    grouped[pid].slots.push({
      id:         slot.slotId,
      slotId:     slot.slotId,
      providerId: pid,
      date,
      time,
      rawDate:    slot.slotDate,
    });
  }

  return Object.values(grouped);
}

export function ChatScreen({ patient }) {
  const [messages,            setMessages]            = useState([]);
  const [input,               setInput]               = useState("");
  const [typing,              setTyping]              = useState(false);
  const [smsOpted,            setSmsOpted]            = useState(false);
  const [voiceCalling,        setVoiceCalling]        = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [selectedSlot,        setSelectedSlot]        = useState(null);

  const msgsRef    = useRef(null);
  const inputRef   = useRef(null);
  const greetedRef = useRef(false); // guards against React StrictMode double-invoke

  const now = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

  const addMsg = (msg) =>
    setMessages(ms => [...ms, { id: crypto.randomUUID(), time: now(), ...msg }]);

  /* ── Greeting on mount — ref guard prevents StrictMode double-fire ── */
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setTimeout(() => {
      addMsg({
        role: "ai",
        type: "text",
        text: `Hi ${patient.firstName}! 👋 I'm Kara, your Kyron Medical assistant. I can help you schedule an appointment, check on a prescription, or find our office info. What can I help you with today?`,
      });
    }, 600);
  }, []);

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, typing]);

  /* ── Send message to AI backend ── */
  const handleSend = async (override) => {
    const msg = (override ?? input).trim();
    if (!msg) return;
    setInput("");
    addMsg({ role:"user", type:"text", text: msg });
    setTyping(true);

    try {
      const res = await sendChatMessage({
        patientId:           patient.patientId,
        message:             msg,
        conversationHistory,
      });

      setConversationHistory(res.conversationHistory);
      setTyping(false);

      // If the AI called find_available_slots, render slot cards alongside the text reply
      if (res.slotsData?.available) {
        const doctors = groupSlotsByProvider(res.slotsData);
        addMsg({ role:"ai", type:"slots", text: res.reply, doctors });
      } else {
        addMsg({ role:"ai", type:"text", text: res.reply });
      }
    } catch (err) {
      setTyping(false);
      addMsg({ role:"ai", type:"text", text:"Sorry, I'm having trouble connecting right now. Please try again in a moment." });
    }
  };

  /* ── Slot selected — auto-send booking intent to Kara ── */
  const handleSlotSelect = (slot, doctor) => {
    setSelectedSlot(slot);
    handleSend(`Book the ${slot.date} at ${slot.time} slot with Dr. ${doctor.name.replace("Dr. ", "")}`);
  };

  const handleVoiceCall = async () => {
    setVoiceCalling(true);
    addMsg({ role:"user", type:"text", text:"I'd like to continue by phone." });

    try {
      await initiateVoiceCall({
        patientId:           patient.patientId,
        phoneNumber:         patient.phone,
        conversationHistory,
      });
      addMsg({ role:"ai", type:"text", text:`Calling you now at ${patient.phone ?? "your number"} 📞 Kara will pick up and remember this entire conversation.` });
    } catch {
      setVoiceCalling(false);
      addMsg({ role:"ai", type:"text", text:"Sorry, I couldn't initiate the call right now. Please try again or call us directly." });
    }
  };

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden" }}>

      {/* Blobs */}
      <div className="blob" style={{ width:700,height:700,background:"rgba(37,99,235,.11)",top:-250,right:-220 }}/>
      <div className="blob" style={{ width:500,height:500,background:"rgba(6,182,212,.07)",bottom:-150,left:-120,animationDelay:"7s" }}/>
      <div className="blob" style={{ width:350,height:350,background:"rgba(139,92,246,.07)",top:"35%",left:"40%",animationDelay:"11s" }}/>

      {/* ── Header ── */}
      <div className="glass" style={{ padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:10,flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",boxShadow:"0 0 22px rgba(37,99,235,.45)" }}>K</div>
          <div>
            <div style={{ fontSize:15,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.2px" }}>Kyron Medical</div>
            <div style={{ fontSize:11,color:"#34d399",display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#34d399",display:"inline-block",boxShadow:"0 0 6px #34d399" }}/>
              Kara · AI Assistant
            </div>
          </div>
        </div>
        {/* Patient pill */}
        <div className="glass fade-in" style={{ padding:"7px 14px",borderRadius:40,display:"flex",alignItems:"center",gap:10 }}>
          <PatientAvatar initials={patient.initials}/>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:"#e2e8f0" }}>{patient.name}</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,.35)" }}>DOB: {patient.dob}</div>
          </div>
        </div>
      </div>

      {/* ── Action buttons — visible until the user sends their first message ── */}
      {messages.length <= 1 && !typing && (
        <div className="fade-in" style={{ padding:"10px 24px 6px",display:"flex",gap:8,flexWrap:"wrap",position:"relative",zIndex:10,flexShrink:0 }}>
          {[
            { label:"📅  Schedule Appointment", msg:"I'd like to schedule an appointment" },
            { label:"💊  My Prescriptions",     msg:"Show me my prescriptions"            },
            { label:"📋  My Appointments",      msg:"Show me my upcoming appointments"    },
            { label:"🏥  Office Info",           msg:"What are your office hours and location?" },
          ].map(({ label, msg }) => (
            <button
              key={label}
              onClick={() => handleSend(msg)}
              style={{
                padding:         "8px 16px",
                borderRadius:    24,
                border:          "1px solid rgba(255,255,255,.15)",
                background:      "rgba(255,255,255,.06)",
                backdropFilter:  "blur(12px)",
                color:           "rgba(255,255,255,.75)",
                fontSize:        12,
                fontWeight:      600,
                cursor:          "pointer",
                letterSpacing:   ".01em",
                transition:      "background .2s,border-color .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.28)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.15)"; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={msgsRef} className="msgs" style={{ flex:1,minHeight:0,overflowY:"auto",padding:"12px 24px 0",display:"flex",flexDirection:"column",gap:18,position:"relative",zIndex:5 }}>

        {messages.map(msg => (
          <MessageBubble
            key={msg.id} msg={msg} patient={patient}
            selectedSlot={selectedSlot}
            smsOpted={smsOpted}
            onSlotSelect={handleSlotSelect}
            onSmsOpt={() => setSmsOpted(true)}
            onVoiceCall={handleVoiceCall}
          />
        ))}
        {typing && <TypingIndicator />}
        <div style={{ height:24 }}/>
      </div>

      {/* ── Input bar ── */}
      <div className="glass" style={{ padding:"14px 20px",display:"flex",gap:10,alignItems:"center",position:"relative",zIndex:10,flexShrink:0 }}>
        <button className="voice-pill" style={{ width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"none",fontSize:18,flexShrink:0 }} onClick={handleVoiceCall}>
          📞
        </button>
        <input
          ref={inputRef}
          className="glass-input"
          style={{ flex:1,borderRadius:22,padding:"12px 18px",fontSize:13 }}
          placeholder="Ask about appointments, prescriptions, office hours…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !typing && handleSend()}
        />
        <button className="btn-primary" onClick={() => handleSend()} disabled={!input.trim() || typing} style={{ width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18 }}>
          ↑
        </button>
      </div>

      {/* ── Voice calling overlay ── */}
      {voiceCalling && (
        <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
          <div className="glass-strong fade-up" style={{ borderRadius:28,padding:"44px 52px",textAlign:"center",maxWidth:340 }}>
            <div style={{ position:"relative",width:88,height:88,margin:"0 auto 22px" }}>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(139,92,246,.6)",animation:"ringPulse 1.6s ease-out infinite" }}/>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(139,92,246,.4)",animation:"ringPulse 1.6s ease-out .55s infinite" }}/>
              <div style={{ width:88,height:88,borderRadius:"50%",background:"rgba(139,92,246,.25)",border:"1px solid rgba(139,92,246,.6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,position:"relative" }}>📞</div>
            </div>
            <div style={{ fontSize:18,fontWeight:800,color:"#e2e8f0",marginBottom:8 }}>Calling you now…</div>
            <div style={{ fontSize:13,color:"#a78bfa",marginBottom:6 }}>{patient.phone}</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.38)",lineHeight:1.6 }}>Kara will pick up and remember this entire conversation seamlessly</div>
            <button onClick={() => setVoiceCalling(false)} style={{ marginTop:26,padding:"9px 22px",borderRadius:20,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.14)",color:"rgba(255,255,255,.55)",cursor:"pointer",fontSize:12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

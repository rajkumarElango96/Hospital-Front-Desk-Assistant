import { useState } from "react";
import { createPatient } from "@/api/index";

// Converts any phone input to E.164 format required by Vapi (+12125551234)
function toE164(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10)                        return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 0)                           return `+${digits}`;
  return "";
}

// Formats digits into (415) 555-0192 for display while typing
function formatPhoneDisplay(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3)  return `(${d}`;
  if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

export function IntakeCard({ onSubmit }) {
  const [form,    setForm]    = useState({ name:"", dob:"", email:"", phone:"", smsOptIn:false });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (key) => (e) =>
    setForm(f => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // Phone field: store raw digits only, display formatted
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm(f => ({ ...f, phone: digits }));
  };

  const phoneE164   = toE164(form.phone);
  const phoneValid  = phoneE164.length >= 10; // at minimum +1XXXXXXXXXX
  const valid = !!form.name.trim() && !!form.dob && !!form.email.trim() && phoneValid;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const [firstName, ...rest] = form.name.trim().split(" ");
      const lastName = rest.join(" ") || firstName;
      const patient = await createPatient({
        firstName,
        lastName,
        dob:   form.dob,
        email: form.email,
        phone: phoneE164, // always send E.164 — required for Vapi voice calls
      });
      onSubmit({ ...form, patientId: patient.patientId, firstName, lastName, phone: phoneE164 });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const Label = ({ children }) => (
    <label style={{ fontSize:10,color:"rgba(255,255,255,.38)",fontWeight:700,letterSpacing:".06em",display:"block",marginBottom:6 }}>
      {children}
    </label>
  );

  return (
    <div className="glass-strong slide-down" style={{ borderRadius:20,padding:"28px 26px" }}>

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:22 }}>
        <div className="glow-logo" style={{ width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0 }}>
          K
        </div>
        <div>
          <div style={{ fontSize:17,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.2px" }}>Welcome to Kyron Medical</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.38)",marginTop:3 }}>Please share a few details so we can assist you</div>
        </div>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

        {/* Full name */}
        <div>
          <Label>FULL NAME</Label>
          <input className="glass-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} placeholder="Raj Kumar" value={form.name} onChange={set("name")} />
        </div>

        {/* DOB + Email */}
        <div style={{ display:"flex",gap:12 }}>
          <div style={{ flex:1 }}>
            <Label>DATE OF BIRTH</Label>
            <input type="date" className="glass-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} value={form.dob} onChange={set("dob")} />
          </div>
          <div style={{ flex:1 }}>
            <Label>EMAIL</Label>
            <input type="email" className="glass-input" style={{ borderRadius:12,padding:"10px 14px",fontSize:13 }} placeholder="you@email.com" value={form.email} onChange={set("email")} />
          </div>
        </div>

        {/* Phone — always required for voice call handoff */}
        <div>
          <Label>PHONE NUMBER</Label>
          <input
            type="tel"
            className="glass-input"
            style={{ borderRadius:12, padding:"10px 14px", fontSize:13 }}
            placeholder="(415) 555-0192"
            value={formatPhoneDisplay(form.phone)}
            onChange={handlePhoneChange}
          />
          {form.phone.length > 0 && (
            <div style={{ fontSize:10, color: phoneValid ? "#34d399" : "rgba(255,255,255,.25)", marginTop:4, paddingLeft:2 }}>
              {phoneValid ? `✓ ${phoneE164}` : "Enter a 10-digit US number"}
            </div>
          )}
        </div>

        {/* SMS opt-in */}
        <div className="glass" style={{ borderRadius:14,padding:"13px 14px" }}>
          <label style={{ display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer" }}>
            <input type="checkbox" className="custom-check" style={{ marginTop:1 }} checked={form.smsOptIn} onChange={set("smsOptIn")} />
            <div>
              <div style={{ fontSize:13,color:"#e2e8f0",fontWeight:600 }}>Receive SMS notifications</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginTop:3,lineHeight:1.5 }}>
                Get appointment reminders and updates via text. Standard message rates may apply.
              </div>
            </div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize:12,color:"#f87171",padding:"8px 12px",borderRadius:8,background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)" }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-primary"
          disabled={!valid || loading}
          onClick={handleSubmit}
          style={{ width:"100%",padding:"13px",borderRadius:14,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}
        >
          {loading
            ? <div style={{ width:18,height:18,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spinnerRing .7s linear infinite" }}/>
            : "Start Chat →"
          }
        </button>

        <div style={{ fontSize:10,color:"rgba(255,255,255,.2)",textAlign:"center" }}>
          🔒 HIPAA-compliant · Your data is encrypted and never sold
        </div>
      </div>
    </div>
  );
}

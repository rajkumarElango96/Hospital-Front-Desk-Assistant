import { PRESCRIPTIONS } from "@/data/mockData";

export function PrescriptionCards() {
  return (
    <div style={{ marginTop:12,display:"flex",flexDirection:"column",gap:8 }}>
      {PRESCRIPTIONS.map((rx, i) => (
        <div
          key={i}
          className="glass fade-up"
          style={{ borderRadius:13,padding:"13px 15px",animationDelay:`${i * .1}s`,opacity:rx.status==="expired"?.55:1 }}
        >
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div style={{ fontSize:13,fontWeight:600,color:"#e2e8f0" }}>💊 {rx.name}</div>
            <span style={{
              fontSize:10,padding:"2px 9px",borderRadius:20,fontWeight:600,
              background: rx.status==="expired"?"rgba(239,68,68,.18)":"rgba(99,179,237,.18)",
              color:      rx.status==="expired"?"#fca5a5":"#93c5fd",
              border:     `1px solid ${rx.status==="expired"?"rgba(239,68,68,.3)":"rgba(99,179,237,.3)"}`,
            }}>
              {rx.status==="expired" ? "Expired" : `${rx.refills} refill${rx.refills !== 1 ? "s" : ""} left`}
            </span>
          </div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.42)",marginTop:4 }}>{rx.dosage}</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.28)",marginTop:3 }}>Valid until {rx.expires}</div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmationCard({ slot, doctor, patient }) {
  const rows = [
    ["Patient",  patient.name],
    ["Doctor",   doctor.name],
    ["Specialty",doctor.specialty],
    ["Date",     `${slot.date} at ${slot.time}`],
    ["Location", "1247 Health Plaza, Suite 400, SF"],
  ];
  return (
    <div className="confirm-card confirm-pop" style={{ marginTop:12,padding:"16px 18px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <div style={{ width:22,height:22,borderRadius:"50%",background:"#10b981",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700 }}>✓</div>
        <span style={{ fontSize:14,fontWeight:700,color:"#34d399" }}>Appointment Confirmed</span>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display:"flex",gap:8,fontSize:12,marginBottom:5 }}>
          <span style={{ color:"rgba(255,255,255,.38)",width:68,flexShrink:0 }}>{label}</span>
          <span style={{ color:"#e2e8f0",fontWeight:500 }}>{value}</span>
        </div>
      ))}
      <div style={{ marginTop:12,padding:"7px 12px",background:"rgba(16,185,129,.18)",borderRadius:10,fontSize:11,color:"#6ee7b7",display:"flex",gap:6 }}>
        📧 Confirmation sent to {patient.email}
      </div>
      {patient.smsOptIn && (
        <div style={{ marginTop:6,padding:"7px 12px",background:"rgba(245,158,11,.15)",borderRadius:10,fontSize:11,color:"#fcd34d",display:"flex",gap:6 }}>
          📱 Reminder will be texted to {patient.phone}
        </div>
      )}
    </div>
  );
}

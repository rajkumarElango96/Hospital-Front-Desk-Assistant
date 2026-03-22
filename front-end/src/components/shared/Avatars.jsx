export function KaraAvatar() {
  return (
    <div style={{ width:34,height:34,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",boxShadow:"0 0 18px rgba(37,99,235,.45)" }}>
      K
    </div>
  );
}

export function PatientAvatar({ initials = "?" }) {
  return (
    <div style={{ width:34,height:34,borderRadius:"50%",flexShrink:0,background:"rgba(255,255,255,.13)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.18)" }}>
      {initials}
    </div>
  );
}

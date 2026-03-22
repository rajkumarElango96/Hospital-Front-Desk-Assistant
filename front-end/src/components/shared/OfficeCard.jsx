import { OFFICE } from "@/data/mockData";

export function OfficeCard() {
  return (
    <div className="glass fade-up" style={{ marginTop:12,borderRadius:16,padding:"16px 18px" }}>
      <div style={{ fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:10 }}>📍 {OFFICE.name}</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.45)",whiteSpace:"pre-line",marginBottom:12,lineHeight:1.7 }}>
        {OFFICE.address}
      </div>
      <div style={{ borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:10,marginBottom:10 }}>
        {Object.entries(OFFICE.hours).map(([day, hrs]) => (
          <div key={day} style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5 }}>
            <span style={{ color:"rgba(255,255,255,.4)" }}>{day}</span>
            <span style={{ color:hrs==="Closed"?"#f87171":"#a7f3d0",fontWeight:500 }}>{hrs}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:6 }}>
        📞 {OFFICE.phone}
      </div>
    </div>
  );
}

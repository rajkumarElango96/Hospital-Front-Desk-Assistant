export function SlotPicker({ doctor, selected, onSelect }) {
  return (
    <div className="fade-up" style={{ marginTop:12 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
        <div style={{ width:6,height:6,borderRadius:"50%",background:doctor.color }}/>
        <span style={{ fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em" }}>
          {doctor.name} · {doctor.specialty}
        </span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
        {doctor.slots.map(slot => (
          <div
            key={slot.id}
            className={`slot-card ${selected?.id === slot.id ? "picked" : ""}`}
            style={{ padding:"11px 14px" }}
            onClick={() => onSelect(slot, doctor)}
          >
            <div style={{ fontSize:12,fontWeight:700,color:"#f1f5f9" }}>{slot.date}</div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.45)",marginTop:3 }}>{slot.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

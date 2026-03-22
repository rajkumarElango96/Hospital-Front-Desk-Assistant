export function SmsOptIn({ phone, opted, onOpt }) {
  return (
    <div className="sms-card fade-up" style={{ marginTop:8,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
      <div>
        <div style={{ fontSize:12,fontWeight:600,color:"#fcd34d" }}>Text reminder?</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,.38)",marginTop:2 }}>We'll text {phone} 24h before your visit</div>
      </div>
      <button
        onClick={onOpt}
        style={{ padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0,background:opted?"rgba(16,185,129,.3)":"rgba(245,158,11,.85)",color:opted?"#6ee7b7":"#fff",transition:"all .2s",boxShadow:opted?"none":"0 0 14px rgba(245,158,11,.3)" }}
      >
        {opted ? "✓ Opted in" : "Yes, text me"}
      </button>
    </div>
  );
}

export function VoiceBanner({ onCall }) {
  return (
    <div
      className="voice-pill fade-up"
      style={{ marginTop:14,padding:"11px 16px",borderRadius:40,display:"flex",alignItems:"center",justifyContent:"space-between" }}
      onClick={onCall}
    >
      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <div style={{ width:30,height:30,borderRadius:"50%",background:"rgba(139,92,246,.28)",border:"1px solid rgba(139,92,246,.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>
          📞
        </div>
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:"#c4b5fd" }}>Continue as a phone call</div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,.32)",marginTop:1 }}>AI will remember this entire conversation</div>
        </div>
      </div>
      <div style={{ fontSize:11,color:"rgba(168,139,250,.8)",fontWeight:700 }}>Call me →</div>
    </div>
  );
}

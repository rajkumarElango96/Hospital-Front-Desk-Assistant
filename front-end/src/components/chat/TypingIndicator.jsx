import { KaraAvatar } from "@/components/shared/Avatars";

export function TypingIndicator() {
  return (
    <div className="fade-up" style={{ display:"flex",alignItems:"flex-start",gap:10,maxWidth:"70%" }}>
      <KaraAvatar />
      <div className="glass" style={{ borderRadius:"18px 18px 18px 4px",padding:"13px 18px",display:"flex",gap:6,alignItems:"center" }}>
        <div className="tdot" />
        <div className="tdot" />
        <div className="tdot" />
      </div>
    </div>
  );
}

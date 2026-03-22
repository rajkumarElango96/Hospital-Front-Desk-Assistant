import { KaraAvatar, PatientAvatar } from "@/components/shared/Avatars";
import { SlotPicker }        from "@/components/shared/SlotPicker";
import { ConfirmationCard }  from "@/components/shared/ConfirmationCard";
import { SmsOptIn }          from "@/components/shared/SmsOptIn";
import { OfficeCard }        from "@/components/shared/OfficeCard";
import { PrescriptionCards } from "@/components/shared/PrescriptionCards";
import { VoiceBanner }       from "@/components/shared/VoiceBanner";

export function MessageBubble({ msg, patient, selectedSlot, smsOpted, onSlotSelect, onSmsOpt, onVoiceCall }) {
  const isAI = msg.role === "ai";

  return (
    <div
      className="fade-up"
      style={{ display:"flex",flexDirection:isAI?"row":"row-reverse",alignItems:"flex-start",gap:10,maxWidth:"82%",marginLeft:isAI?0:"auto" }}
    >
      {isAI ? <KaraAvatar /> : <PatientAvatar initials={patient.initials} />}

      <div style={{ flex:1,minWidth:0 }}>
        {/* Text bubble */}
        {msg.text && (
          <div style={{
            background:        isAI ? "rgba(255,255,255,.07)" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
            backdropFilter:    isAI ? "blur(20px)" : undefined,
            WebkitBackdropFilter: isAI ? "blur(20px)" : undefined,
            border:            isAI ? "1px solid rgba(255,255,255,.11)" : "none",
            borderRadius:      isAI ? "18px 18px 18px 5px" : "18px 18px 5px 18px",
            padding:           "11px 15px",
            fontSize:          13,
            lineHeight:        1.65,
            color:             "#e2e8f0",
          }}>
            {msg.text}
          </div>
        )}

        {/* Slot cards — one SlotPicker per provider, rendered from real API data */}
        {msg.type === "slots" && msg.doctors?.length > 0 && (
          <div style={{ display:"flex",flexDirection:"column",gap:16,marginTop:msg.text ? 12 : 0 }}>
            {msg.doctors.map((doctor) => (
              <SlotPicker
                key={doctor.providerId}
                doctor={doctor}
                selected={selectedSlot}
                onSelect={onSlotSelect}
              />
            ))}
          </div>
        )}

        {/* Legacy single-doctor slot picker (mock flow) */}
        {msg.type === "slots" && msg.doctor && !msg.doctors && (
          <SlotPicker doctor={msg.doctor} selected={selectedSlot} onSelect={onSlotSelect} />
        )}

        {msg.type === "confirmation" && selectedSlot && msg.doctor && (
          <>
            <ConfirmationCard slot={selectedSlot} doctor={msg.doctor} patient={patient} />
            {!patient.smsOptIn && <SmsOptIn phone={patient.phone} opted={smsOpted} onOpt={onSmsOpt} />}
            <VoiceBanner onCall={onVoiceCall} />
          </>
        )}

        {msg.type === "office"        && <OfficeCard />}
        {msg.type === "prescription"  && <PrescriptionCards />}

        {/* Timestamp */}
        <div style={{ fontSize:10,color:"rgba(255,255,255,.2)",marginTop:4,textAlign:isAI?"left":"right" }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
}

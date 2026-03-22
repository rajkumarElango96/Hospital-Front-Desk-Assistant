import { useState } from "react";
import { IntakeCard }  from "@/components/intake/IntakeCard";
import { ChatScreen }  from "@/components/chat/ChatScreen";

export default function App() {
  const [patient,    setPatient]    = useState(null);
  const [intakeOpen, setIntakeOpen] = useState(true);

  const handleIntakeSubmit = (form) => {
    // form now includes patientId returned from the real API
    setPatient({
      patientId: form.patientId,
      firstName: form.firstName,
      lastName:  form.lastName,
      name:      `${form.firstName} ${form.lastName}`.trim(),
      initials:  `${form.firstName[0]}${form.lastName ? form.lastName[0] : ""}`.toUpperCase(),
      dob:       form.dob,
      email:     form.email,
      phone:     form.phone,
      smsOptIn:  form.smsOptIn,
    });
    setTimeout(() => setIntakeOpen(false), 300);
  };

  return (
    <div className="bg-anim" style={{ height:"100vh",overflow:"hidden",position:"relative" }}>

      {/* Background blobs — always visible */}
      <div className="blob" style={{ width:700,height:700,background:"rgba(37,99,235,.11)",top:-250,right:-220 }}/>
      <div className="blob" style={{ width:500,height:500,background:"rgba(6,182,212,.07)",bottom:-150,left:-120,animationDelay:"7s" }}/>
      <div className="blob" style={{ width:350,height:350,background:"rgba(139,92,246,.07)",top:"35%",left:"40%",animationDelay:"11s" }}/>

      {/* ── Intake state: centered card ── */}
      {intakeOpen && !patient && (
        <div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:10 }}>
          <div style={{ width:"100%",maxWidth:460 }}>
            <IntakeCard onSubmit={handleIntakeSubmit} />
          </div>
        </div>
      )}

      {/* ── Chat state: full screen ── */}
      {patient && !intakeOpen && (
        <ChatScreen patient={patient} />
      )}
    </div>
  );
}

export const DOCTORS = [
  {
    id: "d1", name: "Dr. Sarah Chen", specialty: "Cardiology",
    avatar: "SC", color: "#ef4444",
    bio: "Board-certified cardiologist, 14 years experience",
    keywords: ["chest","heart","cardiac","palpitation","cardiovascular","blood pressure","shortness of breath","chest pain","artery"],
    slots: [
      { id:"s1",  date:"Mon, Apr 7",  time:"9:00 AM"  },
      { id:"s2",  date:"Wed, Apr 9",  time:"2:30 PM"  },
      { id:"s3",  date:"Fri, Apr 11", time:"11:00 AM" },
      { id:"s4",  date:"Tue, Apr 15", time:"10:00 AM" },
      { id:"s5",  date:"Thu, Apr 17", time:"3:00 PM"  },
    ],
  },
  {
    id: "d2", name: "Dr. Marcus Webb", specialty: "Orthopedics",
    avatar: "MW", color: "#f59e0b",
    bio: "Orthopedic surgeon, sports medicine specialist",
    keywords: ["knee","back","joint","shoulder","bone","hip","spine","wrist","ankle","fracture","arthritis","muscle","ligament"],
    slots: [
      { id:"s6",  date:"Tue, Apr 8",  time:"8:30 AM"  },
      { id:"s7",  date:"Thu, Apr 10", time:"3:00 PM"  },
      { id:"s8",  date:"Mon, Apr 14", time:"1:00 PM"  },
      { id:"s9",  date:"Wed, Apr 16", time:"10:30 AM" },
      { id:"s10", date:"Fri, Apr 18", time:"9:00 AM"  },
    ],
  },
  {
    id: "d3", name: "Dr. Priya Nair", specialty: "Dermatology",
    avatar: "PN", color: "#a855f7",
    bio: "Dermatologist & skin cancer screening specialist",
    keywords: ["skin","rash","acne","mole","itch","hair","nail","eczema","psoriasis","dermatitis","breakout","hive","lesion"],
    slots: [
      { id:"s11", date:"Wed, Apr 9",  time:"11:00 AM" },
      { id:"s12", date:"Fri, Apr 11", time:"2:00 PM"  },
      { id:"s13", date:"Mon, Apr 14", time:"9:30 AM"  },
      { id:"s14", date:"Thu, Apr 17", time:"3:30 PM"  },
      { id:"s15", date:"Tue, Apr 22", time:"11:00 AM" },
    ],
  },
  {
    id: "d4", name: "Dr. James Okoro", specialty: "Neurology",
    avatar: "JO", color: "#06b6d4",
    bio: "Neurologist, headache & nerve conditions",
    keywords: ["headache","migraine","dizzy","dizziness","brain","nerve","seizure","memory","numbness","tremor","tingling","vertigo","neurological"],
    slots: [
      { id:"s16", date:"Mon, Apr 7",  time:"2:00 PM"  },
      { id:"s17", date:"Thu, Apr 10", time:"9:00 AM"  },
      { id:"s18", date:"Tue, Apr 15", time:"11:30 AM" },
      { id:"s19", date:"Fri, Apr 18", time:"10:00 AM" },
      { id:"s20", date:"Mon, Apr 21", time:"1:30 PM"  },
    ],
  },
];

export const OFFICE = {
  name:    "Kyron Medical Group",
  address: "1247 Health Plaza, Suite 400\nSan Francisco, CA 94105",
  phone:   "(415) 555-0100",
  hours: {
    "Monday – Friday": "8:00 AM – 6:00 PM",
    "Saturday":        "9:00 AM – 1:00 PM",
    "Sunday":          "Closed",
  },
};

export const PRESCRIPTIONS = [
  { name:"Lisinopril 10mg",    dosage:"1 tablet daily",       refills:2, expires:"Jun 30, 2026", status:"active"  },
  { name:"Metoprolol 25mg",    dosage:"1 tablet twice daily", refills:1, expires:"May 15, 2026", status:"active"  },
  { name:"Atorvastatin 20mg",  dosage:"1 tablet at bedtime",  refills:0, expires:"Apr 1, 2026",  status:"expired" },
];

export const QUICK_REPLIES = [
  "Schedule an appointment",
  "Check my prescriptions",
  "Office hours & location",
  "I have chest pain",
];

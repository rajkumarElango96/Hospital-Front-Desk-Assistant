const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper — time value (date part ignored by @db.Time)
const t = (hh, mm) => new Date(`1970-01-01T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`)

// Helper — date value (time part ignored by @db.Date)
const d = (yyyy, mm, dd) => new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T00:00:00`)

// Week of April 20–24 2026 (Mon–Fri)
const WEEK = [
  d(2026, 4, 20), // Monday
  d(2026, 4, 21), // Tuesday
  d(2026, 4, 22), // Wednesday
  d(2026, 4, 23), // Thursday
  d(2026, 4, 24), // Friday
]

// Slot blocks per day — each provider gets a different schedule pattern
const PATEL_TIMES = [
  { start: t(9,  0), end: t(10, 0) },
  { start: t(10, 0), end: t(11, 0) },
  { start: t(14, 0), end: t(15, 0) },
  { start: t(15, 0), end: t(16, 0) },
]

const ROSS_TIMES = [
  { start: t(9,  0), end: t(10, 0) },
  { start: t(10, 0), end: t(11, 0) },
  { start: t(11, 0), end: t(12, 0) },
  { start: t(13, 0), end: t(14, 0) },
]

const KIM_TIMES = [
  { start: t(10, 0), end: t(11, 0) },
  { start: t(11, 0), end: t(12, 0) },
  { start: t(14, 0), end: t(15, 0) },
]

async function main() {

  // ── Clean existing data (order respects FK constraints) ───────────────────
  await prisma.prescription.deleteMany()
  await prisma.visitHistory.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.providerSlot.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.provider.deleteMany()
  console.log('🧹 Cleared existing data')

  // ── Providers ─────────────────────────────────────────────────────────────
  const drPatel = await prisma.provider.create({
    data: {
      providerFirstName: 'Anika',
      providerLastName:  'Patel',
      npi:               '1234567890',
      specialty:         'CARDIOLOGY',
    },
  })

  const drRoss = await prisma.provider.create({
    data: {
      providerFirstName: 'James',
      providerLastName:  'Ross',
      npi:               '0987654321',
      specialty:         'ORTHOPEDICS',
    },
  })

  const drKim = await prisma.provider.create({
    data: {
      providerFirstName: 'Sarah',
      providerLastName:  'Kim',
      npi:               '1122334455',
      specialty:         'DERMATOLOGY',
    },
  })

  const drNguyen = await prisma.provider.create({
    data: {
      providerFirstName: 'David',
      providerLastName:  'Nguyen',
      npi:               '5566778899',
      specialty:         'NEUROLOGY',
    },
  })

  console.log('✅ Providers seeded (4)')

  // ── Patients ──────────────────────────────────────────────────────────────
  const patient1 = await prisma.patient.create({
    data: {
      firstName: 'John',
      lastName:  'Doe',
      dob:       d(1985, 6, 15),
      email:     'john.doe@email.com',
      phone:     '5551234567',
    },
  })

  const patient2 = await prisma.patient.create({
    data: {
      firstName: 'Maria',
      lastName:  'Garcia',
      dob:       d(1990, 3, 22),
      email:     'maria.garcia@email.com',
      phone:     null,
    },
  })

  const patient3 = await prisma.patient.create({
    data: {
      firstName: 'Tom',
      lastName:  'Chen',
      dob:       d(1978, 11, 5),
      email:     'tom.chen@email.com',
      phone:     '5559876543',
    },
  })

  console.log('✅ Patients seeded (3)')

  // ── Slots — full week for each provider ───────────────────────────────────
  const slotData = []

  // Dr Patel (Cardiology) — Mon, Wed, Fri
  for (const day of [WEEK[0], WEEK[2], WEEK[4]]) {
    for (const block of PATEL_TIMES) {
      slotData.push({
        providerId:    drPatel.providerId,
        slotDate:      day,
        slotStartTime: block.start,
        slotEndTime:   block.end,
        timezone:      'AMERICA_NEW_YORK',
        status:        'AVAILABLE',
      })
    }
  }

  // Dr Ross (Orthopedics) — Tue, Thu
  for (const day of [WEEK[1], WEEK[3]]) {
    for (const block of ROSS_TIMES) {
      slotData.push({
        providerId:    drRoss.providerId,
        slotDate:      day,
        slotStartTime: block.start,
        slotEndTime:   block.end,
        timezone:      'AMERICA_CHICAGO',
        status:        'AVAILABLE',
      })
    }
  }

  // Dr Kim (Dermatology) — Mon–Fri
  for (const day of WEEK) {
    for (const block of KIM_TIMES) {
      slotData.push({
        providerId:    drKim.providerId,
        slotDate:      day,
        slotStartTime: block.start,
        slotEndTime:   block.end,
        timezone:      'AMERICA_LOS_ANGELES',
        status:        'AVAILABLE',
      })
    }
  }

  // Dr Nguyen (Neurology) — Mon, Tue, Thu
  const NGUYEN_TIMES = [
    { start: t(9,  0), end: t(10, 0) },
    { start: t(13, 0), end: t(14, 0) },
    { start: t(15, 0), end: t(16, 0) },
  ]
  for (const day of [WEEK[0], WEEK[1], WEEK[3]]) {
    for (const block of NGUYEN_TIMES) {
      slotData.push({
        providerId:    drNguyen.providerId,
        slotDate:      day,
        slotStartTime: block.start,
        slotEndTime:   block.end,
        timezone:      'AMERICA_DENVER',
        status:        'AVAILABLE',
      })
    }
  }

  await prisma.providerSlot.createMany({ data: slotData })
  console.log(`✅ Slots seeded (${slotData.length} total across 4 providers)`)

  // ── Completed appointment chain ────────────────────────────────────────────
  // John Doe — sees Dr Patel (Cardiology) on Mon Apr 20 at 9am → visit → prescription

  const bookedSlot = await prisma.providerSlot.findFirst({
    where: {
      providerId:    drPatel.providerId,
      slotDate:      WEEK[0],
      slotStartTime: t(9, 0),
    },
  })

  const appointment1 = await prisma.appointment.create({
    data: {
      patientId:         patient1.patientId,
      providerId:        drPatel.providerId,
      slotId:            bookedSlot.slotId,
      appointmentType:   'IN_PERSON',
      appointmentDate:   WEEK[0],
      appointmentReason: 'Chest pain and shortness of breath',
      apptStatus:        'COMPLETED',
    },
  })

  await prisma.providerSlot.update({
    where: { slotId: bookedSlot.slotId },
    data:  { status: 'BOOKED' },
  })

  const visit1 = await prisma.visitHistory.create({
    data: {
      patientId:            patient1.patientId,
      appointmentId:        appointment1.appointmentId,
      visitSummary:         'Patient presented with chest pain. EKG normal. Prescribed beta blocker.',
      prescriptionProvided: true,
    },
  })

  await prisma.prescription.create({
    data: {
      visitId:              visit1.visitId,
      prescriptionDate:     WEEK[0],
      prescriptionMedicine: 'Metoprolol 25mg',
      isRefill:             false,
      nextRefillDate:       null,
    },
  })

  console.log('✅ Completed appointment + visit + prescription seeded')

  // ── Confirmed upcoming appointment ────────────────────────────────────────
  // Maria Garcia — sees Dr Ross (Orthopedics) on Tue Apr 21 at 9am

  const upcomingSlot = await prisma.providerSlot.findFirst({
    where: {
      providerId:    drRoss.providerId,
      slotDate:      WEEK[1],
      slotStartTime: t(9, 0),
    },
  })

  await prisma.appointment.create({
    data: {
      patientId:         patient2.patientId,
      providerId:        drRoss.providerId,
      slotId:            upcomingSlot.slotId,
      appointmentType:   'IN_PERSON',
      appointmentDate:   WEEK[1],
      appointmentReason: 'Knee pain after running',
      apptStatus:        'CONFIRMED',
    },
  })

  await prisma.providerSlot.update({
    where: { slotId: upcomingSlot.slotId },
    data:  { status: 'BOOKED' },
  })

  // ── Tele appointment ──────────────────────────────────────────────────────
  // Tom Chen — telehealth with Dr Kim (Dermatology) on Wed Apr 22 at 10am

  const teleSlot = await prisma.providerSlot.findFirst({
    where: {
      providerId:    drKim.providerId,
      slotDate:      WEEK[2],
      slotStartTime: t(10, 0),
    },
  })

  await prisma.appointment.create({
    data: {
      patientId:         patient3.patientId,
      providerId:        drKim.providerId,
      slotId:            teleSlot.slotId,
      appointmentType:   'TELE',
      appointmentDate:   WEEK[2],
      appointmentReason: 'Skin rash review',
      apptStatus:        'PENDING',
    },
  })

  await prisma.providerSlot.update({
    where: { slotId: teleSlot.slotId },
    data:  { status: 'BOOKED' },
  })

  console.log('✅ Upcoming appointments seeded (confirmed + pending tele)')
  console.log('\n🎉 Done — kyron_medical seeded with a full week of data.')
  console.log(`   Providers : 4`)
  console.log(`   Patients  : 3`)
  console.log(`   Slots     : ${slotData.length} (${slotData.length - 3} available, 3 booked)`)
  console.log(`   Appointments: 3 (1 completed, 1 confirmed, 1 pending tele)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

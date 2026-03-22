-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('CARDIOLOGY', 'ORTHOPEDICS', 'DERMATOLOGY', 'NEUROLOGY', 'GENERAL');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ApptType" AS ENUM ('TELE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "ApptStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Timezone" AS ENUM ('AMERICA_NEW_YORK', 'AMERICA_CHICAGO', 'AMERICA_DENVER', 'AMERICA_LOS_ANGELES');

-- CreateTable
CREATE TABLE "Patient" (
    "patientId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("patientId")
);

-- CreateTable
CREATE TABLE "Provider" (
    "providerId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerFirstName" TEXT NOT NULL,
    "providerLastName" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "specialty" "Specialty" NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("providerId")
);

-- CreateTable
CREATE TABLE "ProviderSlot" (
    "slotId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL,
    "slotDate" DATE NOT NULL,
    "slotStartTime" TIME NOT NULL,
    "slotEndTime" TIME NOT NULL,
    "timezone" "Timezone" NOT NULL DEFAULT 'AMERICA_NEW_YORK',
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "ProviderSlot_pkey" PRIMARY KEY ("slotId")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "appointmentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "appointmentType" "ApptType" NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "appointmentReason" TEXT,
    "apptStatus" "ApptStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("appointmentId")
);

-- CreateTable
CREATE TABLE "VisitHistory" (
    "visitId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "visitSummary" TEXT,
    "prescriptionProvided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VisitHistory_pkey" PRIMARY KEY ("visitId")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "prescriptionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitId" UUID NOT NULL,
    "prescriptionDate" DATE NOT NULL,
    "prescriptionMedicine" TEXT NOT NULL,
    "isRefill" BOOLEAN NOT NULL DEFAULT false,
    "nextRefillDate" DATE,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("prescriptionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_npi_key" ON "Provider"("npi");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSlot_providerId_slotDate_slotStartTime_key" ON "ProviderSlot"("providerId", "slotDate", "slotStartTime");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_slotId_key" ON "Appointment"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitHistory_appointmentId_key" ON "VisitHistory"("appointmentId");

-- AddForeignKey
ALTER TABLE "ProviderSlot" ADD CONSTRAINT "ProviderSlot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("providerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("providerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ProviderSlot"("slotId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitHistory" ADD CONSTRAINT "VisitHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitHistory" ADD CONSTRAINT "VisitHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("appointmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "VisitHistory"("visitId") ON DELETE RESTRICT ON UPDATE CASCADE;

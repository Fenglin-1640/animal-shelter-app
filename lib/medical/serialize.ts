import type {
  DesexingSchedule,
  DesexingStatus,
  HealthAssessment,
  MedicalClearance,
  PreReleaseCheck,
  PreReleaseFitnessResult,
  TreatmentEvent,
  TreatmentPathway,
  VaccinationRecord,
} from "@/lib/medical/types";

// Server-side row shapes returned by the Prisma 8 contract client (see
// prisma/contract.prisma) - identical to the TS types except createdAt/
// issuedAt/completedAt are Date, not string (see prisma/contract.prisma's
// comment on why those three are DateTime and the rest stay String).

// urgentTreatmentRequired/furtherTreatmentRequired are Int (0/1) columns,
// not Boolean - this SQL PSL provider doesn't support the Boolean field
// type (CONTRACT.SOURCE_LOAD_FAILED / PSL_UNSUPPORTED_FIELD_TYPE).
export interface HealthAssessmentRow
  extends Omit<HealthAssessment, "createdAt" | "urgentTreatmentRequired" | "treatmentPathway"> {
  urgentTreatmentRequired: number;
  treatmentPathway: string | null;
  createdAt: Date;
}
export function toHealthAssessment(row: HealthAssessmentRow): HealthAssessment {
  return {
    ...row,
    urgentTreatmentRequired: Boolean(row.urgentTreatmentRequired),
    treatmentPathway: (row.treatmentPathway as TreatmentPathway | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface TreatmentEventRow
  extends Omit<TreatmentEvent, "createdAt" | "furtherTreatmentRequired"> {
  furtherTreatmentRequired: number;
  createdAt: Date;
}
export function toTreatmentEvent(row: TreatmentEventRow): TreatmentEvent {
  return {
    ...row,
    furtherTreatmentRequired: Boolean(row.furtherTreatmentRequired),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface VaccinationRecordRow extends Omit<VaccinationRecord, "createdAt"> {
  createdAt: Date;
}
export function toVaccinationRecord(row: VaccinationRecordRow): VaccinationRecord {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export interface DesexingScheduleRow
  extends Omit<DesexingSchedule, "createdAt" | "completedAt" | "status" | "completedByEmail" | "completedByName"> {
  status: string;
  completedAt: Date | null;
  completedByEmail: string | null;
  completedByName: string | null;
  createdAt: Date;
}
export function toDesexingSchedule(row: DesexingScheduleRow): DesexingSchedule {
  return {
    ...row,
    status: row.status as DesexingStatus,
    completedByEmail: row.completedByEmail ?? undefined,
    completedByName: row.completedByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

export function toDesexingScheduleRowPatch(patch: Partial<DesexingSchedule>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "completedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}

export interface MedicalClearanceRow extends Omit<MedicalClearance, "issuedAt"> {
  issuedAt: Date;
}
export function toMedicalClearance(row: MedicalClearanceRow): MedicalClearance {
  return { ...row, issuedAt: row.issuedAt.toISOString() };
}

export interface PreReleaseCheckRow extends Omit<PreReleaseCheck, "createdAt" | "fitnessResult"> {
  fitnessResult: string;
  createdAt: Date;
}
export function toPreReleaseCheck(row: PreReleaseCheckRow): PreReleaseCheck {
  return {
    ...row,
    fitnessResult: row.fitnessResult as PreReleaseFitnessResult,
    createdAt: row.createdAt.toISOString(),
  };
}

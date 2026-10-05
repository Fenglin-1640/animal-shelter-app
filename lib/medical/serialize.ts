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
  extends Omit<HealthAssessment, "createdAt" | "urgentTreatmentRequired" | "treatmentPathway" | "healthRecheckRequired"> {
  urgentTreatmentRequired: number;
  treatmentPathway: string | null;
  // Nullable - rows created before this column existed have no value;
  // treated as false (no recheck pending), the same as if it had never
  // been ticked.
  healthRecheckRequired: number | null;
  createdAt: string;
}
export function toHealthAssessment(row: HealthAssessmentRow): HealthAssessment {
  return {
    ...row,
    urgentTreatmentRequired: Boolean(row.urgentTreatmentRequired),
    healthRecheckRequired: Boolean(row.healthRecheckRequired),
    treatmentPathway: (row.treatmentPathway as TreatmentPathway | null) ?? undefined,
    createdAt: row.createdAt,
  };
}

export interface TreatmentEventRow
  extends Omit<TreatmentEvent, "createdAt" | "furtherTreatmentRequired"> {
  furtherTreatmentRequired: number;
  createdAt: string;
}
export function toTreatmentEvent(row: TreatmentEventRow): TreatmentEvent {
  return {
    ...row,
    furtherTreatmentRequired: Boolean(row.furtherTreatmentRequired),
    createdAt: row.createdAt,
  };
}

export interface VaccinationRecordRow extends Omit<VaccinationRecord, "createdAt" | "antibodyOverrideReason" | "antibodyOverrideNote"> {
  createdAt: string;
  antibodyOverrideReason: string | null;
  antibodyOverrideNote: string | null;
}
export function toVaccinationRecord(row: VaccinationRecordRow): VaccinationRecord {
  return {
    ...row,
    createdAt: row.createdAt,
    antibodyOverrideReason: row.antibodyOverrideReason ?? undefined,
    antibodyOverrideNote: row.antibodyOverrideNote ?? undefined,
  };
}

export interface DesexingScheduleRow
  extends Omit<DesexingSchedule, "createdAt" | "completedAt" | "status" | "completedByEmail" | "completedByName"> {
  status: string;
  completedAt: string | null;
  completedByEmail: string | null;
  completedByName: string | null;
  createdAt: string;
}
export function toDesexingSchedule(row: DesexingScheduleRow): DesexingSchedule {
  return {
    ...row,
    status: row.status as DesexingStatus,
    completedByEmail: row.completedByEmail ?? undefined,
    completedByName: row.completedByName ?? undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export function toDesexingScheduleRowPatch(patch: Partial<DesexingSchedule>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    row[key] = value;
  }
  return row;
}

export interface MedicalClearanceRow extends Omit<MedicalClearance, "issuedAt"> {
  issuedAt: string;
}
export function toMedicalClearance(row: MedicalClearanceRow): MedicalClearance {
  return { ...row, issuedAt: row.issuedAt };
}

export interface PreReleaseCheckRow extends Omit<PreReleaseCheck, "createdAt" | "fitnessResult"> {
  fitnessResult: string;
  createdAt: string;
}
export function toPreReleaseCheck(row: PreReleaseCheckRow): PreReleaseCheck {
  return {
    ...row,
    fitnessResult: row.fitnessResult as PreReleaseFitnessResult,
    createdAt: row.createdAt,
  };
}

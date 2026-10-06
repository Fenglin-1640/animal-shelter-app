import { antigensForVaccine, protectiveAntigens, type AntibodyCheck } from "@/lib/medical/antibodies";
import type { VaccinationRecord } from "@/lib/medical/types";

// Vaccination Check: which of the animal's required vaccine types it is
// already covered for, and which become pending vaccination items. Shared
// by the check form (preview before saving) and the route that saves it,
// so both apply the same rules.

// Outside evidence (and a vaccination with no booster date) counts as
// current for this long after the date given.
export const EVIDENCE_VALID_DAYS = 365;
const DAY_MS = 86400000;

export interface EvidenceRow {
  vaccineType: string;
  dateGiven: string;
  source: string;
}

export interface CoverageEntry {
  vaccineType: string;
  reason: string;
}

export interface VaccinationCheck {
  id: string;
  animalId: string;
  checkDate: string;
  report: string;
  outcome: string;
  evidence: EvidenceRow[];
  coverage: CoverageEntry[];
  notApplicable: string[];
  checkedByEmail: string;
  checkedByName: string;
  createdAt: string;
}

export interface VaccinationCheckRow extends Omit<VaccinationCheck, "evidence" | "coverage" | "notApplicable"> {
  evidence: string;
  coverage: string;
  notApplicable: string;
}

export function toVaccinationCheck(row: VaccinationCheckRow): VaccinationCheck {
  return {
    ...row,
    evidence: JSON.parse(row.evidence) as EvidenceRow[],
    coverage: JSON.parse(row.coverage) as CoverageEntry[],
    notApplicable: JSON.parse(row.notApplicable) as string[],
  };
}

export type VaccinationTaskStatus = "Pending" | "Completed" | "Waived";

export interface VaccinationTask {
  id: string;
  animalId: string;
  checkId: string;
  vaccineType: string;
  status: VaccinationTaskStatus;
  dueDate?: string;
  waivedReason?: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  completedVaccinationId?: string;
  resolvedByEmail?: string;
  resolvedByName?: string;
  resolvedAt?: string;
}

type Nullable<T> = { [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K] };
export type VaccinationTaskRow = Omit<Nullable<VaccinationTask>, "status"> & { status: string };

export function toVaccinationTask(row: VaccinationTaskRow): VaccinationTask {
  return {
    id: row.id,
    animalId: row.animalId,
    checkId: row.checkId,
    vaccineType: row.vaccineType,
    status: row.status as VaccinationTaskStatus,
    dueDate: row.dueDate ?? undefined,
    waivedReason: row.waivedReason ?? undefined,
    createdByEmail: row.createdByEmail,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    completedVaccinationId: row.completedVaccinationId ?? undefined,
    resolvedByEmail: row.resolvedByEmail ?? undefined,
    resolvedByName: row.resolvedByName ?? undefined,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}

// Vaccine Type options for the animal's species: those tagged with it plus
// untagged ones (which apply to every species). With no species tags the
// whole active list applies.
export function applicableVaccineTypes(options: { value: string; speciesId?: string | null; isRetired?: boolean }[], species: string): string[] {
  return options.filter((o) => !o.isRetired && (!o.speciesId || o.speciesId === species)).map((o) => o.value);
}

function day(iso: string): number {
  return new Date(iso.slice(0, 10)).getTime();
}

export interface CoverageContext {
  checkDate: string;
  antibodyChecks: AntibodyCheck[];
  vaccinations: VaccinationRecord[];
  evidence: EvidenceRow[];
}

// Why a vaccine type is already covered, or null if it isn't: every
// antigen it protects against has a current Protective antibody result,
// or it was given (here or elsewhere) and is still current on the check
// date.
export function coverageReason(vaccineType: string, ctx: CoverageContext): string | null {
  const at = day(ctx.checkDate);
  const antigens = antigensForVaccine(vaccineType);
  const protective = protectiveAntigens(ctx.antibodyChecks, at);
  if (antigens.length > 0 && antigens.every((a) => protective.has(a))) return `Protective antibodies (${antigens.join(", ")})`;
  for (const v of ctx.vaccinations.filter((r) => r.vaccineType === vaccineType)) {
    const until = v.nextBoosterDueDate ? day(v.nextBoosterDueDate) : day(v.administrationDate) + EVIDENCE_VALID_DAYS * DAY_MS;
    if (day(v.administrationDate) <= at && until >= at) return `Vaccinated ${v.administrationDate.slice(0, 10)}`;
  }
  for (const e of ctx.evidence.filter((r) => r.vaccineType === vaccineType && r.dateGiven)) {
    const given = day(e.dateGiven);
    if (given <= at && given + EVIDENCE_VALID_DAYS * DAY_MS >= at) return `Given ${e.dateGiven.slice(0, 10)}${e.source ? ` (${e.source})` : ""}`;
  }
  return null;
}

export function computeCoverage(required: string[], ctx: CoverageContext): { covered: CoverageEntry[]; uncovered: string[] } {
  const covered: CoverageEntry[] = [];
  const uncovered: string[] = [];
  for (const vaccineType of required) {
    const reason = coverageReason(vaccineType, ctx);
    if (reason) covered.push({ vaccineType, reason });
    else uncovered.push(vaccineType);
  }
  return { covered, uncovered };
}

export function outcomeLabel(requiredCount: number, pendingCount: number): string {
  if (pendingCount === 0) return "Fully covered";
  if (pendingCount >= requiredCount) return "No vaccination cover – all items pending";
  return `Partially covered – ${pendingCount} item${pendingCount === 1 ? "" : "s"} pending`;
}

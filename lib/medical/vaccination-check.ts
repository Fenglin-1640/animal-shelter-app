import { protectiveAntigens, type AntibodyCheck } from "@/lib/medical/antibodies";
import { findType, proposeTypes, type ResolvedVaccineType, type VaccineModel } from "@/lib/medical/vaccine-model";
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

// One covered antigen and why it is covered.
export interface CoverageEntry {
  antigen: string;
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

function day(iso: string): number {
  return new Date(iso.slice(0, 10)).getTime();
}

export interface CoverageContext {
  checkDate: string;
  antibodyChecks: AntibodyCheck[];
  vaccinations: VaccinationRecord[];
  evidence: EvidenceRow[];
}

// Antigen key -> why it is covered on the check date: a current
// Protective antibody result, a vaccination still current (until its
// booster date, or for a year when it has none), or outside evidence
// given within the last year. Vaccines are resolved with the vaccine
// model; names it does not know cover nothing.
export function coveredAntigens(model: VaccineModel, ctx: CoverageContext): Map<string, string> {
  const at = day(ctx.checkDate);
  const covered = new Map<string, string>();
  for (const key of protectiveAntigens(ctx.antibodyChecks, at)) covered.set(key, "Protective antibodies");
  const add = (type: ResolvedVaccineType | undefined, reason: string) => {
    for (const a of type?.antigens ?? []) if (!covered.has(a)) covered.set(a, reason);
  };
  for (const v of ctx.vaccinations) {
    const until = v.nextBoosterDueDate ? day(v.nextBoosterDueDate) : day(v.administrationDate) + EVIDENCE_VALID_DAYS * DAY_MS;
    if (day(v.administrationDate) <= at && until >= at) add(findType(v.vaccineType, model.all), `${v.vaccineType} given ${v.administrationDate.slice(0, 10)}`);
  }
  for (const e of ctx.evidence.filter((r) => r.vaccineType && r.dateGiven)) {
    const given = day(e.dateGiven);
    if (given <= at && given + EVIDENCE_VALID_DAYS * DAY_MS >= at) add(findType(e.vaccineType, model.all), `${e.vaccineType} given ${e.dateGiven.slice(0, 10)}${e.source ? ` (${e.source})` : ""}`);
  }
  return covered;
}

export interface GapResult {
  required: string[];
  covered: CoverageEntry[];
  gap: string[];
  proposed: ResolvedVaccineType[];
}

// Required antigens = every antigen of the vaccine types applicable to
// the species; the gap is what is not covered, and the proposed vaccine
// types cover it (greedy, see proposeTypes).
export function computeGap(model: VaccineModel, ctx: CoverageContext): GapResult {
  const required = new Set(model.types.flatMap((t) => t.antigens));
  const covered = coveredAntigens(model, ctx);
  const label = (k: string) => model.antigenLabels.get(k) ?? k;
  const gap = new Set([...required].filter((a) => !covered.has(a)));
  return {
    required: [...required],
    covered: [...required].filter((a) => covered.has(a)).map((a) => ({ antigen: label(a), reason: covered.get(a)! })),
    gap: [...gap].map(label),
    proposed: proposeTypes(gap, model.types),
  };
}

export function outcomeLabel(result: Pick<GapResult, "required" | "covered" | "gap">, pendingCount: number): string {
  if (result.required.length === 0) return "No vaccine types configured for this species";
  if (result.gap.length === 0) return "Fully covered";
  if (pendingCount === 0) return "Not fully covered – no items pending";
  if (result.covered.length === 0) return "No vaccination cover – all items pending";
  return `Partially covered – ${pendingCount} item${pendingCount === 1 ? "" : "s"} pending`;
}

import { writeAuditLog } from "@/lib/audit/store";
import { getApplication } from "@/lib/applications/store";
import { getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getSystemSettings } from "@/lib/system-administration/settings-store";
import type { AdoptionAgreement } from "@/lib/agreements/types";

// FR-AGR-01: AdoptionAgreement records, persisted to localStorage since
// there is no backend.
const STORAGE_KEY = "asams-agreements";

const STANDARD_CONDITIONS =
  "Standard adoption conditions apply, including desexing and registration requirements, compliance with the ASAMS Code of Care, and notifying the shelter of any change of address.";
const STANDARD_RETURN_POLICY = "14 days";

function loadAll(): AdoptionAgreement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdoptionAgreement[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: AdoptionAgreement[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateId(): string {
  return `AGR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Every version generated for an application, oldest first - "签署后协议不可
// 编辑，只能查看或生成新版本并重新签署" means a signed version stays in history
// once superseded.
export function listAgreementsForApplication(applicationId: string): AdoptionAgreement[] {
  return loadAll()
    .filter((a) => a.applicationId === applicationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// The current version - the one to view/sign/pay against. There is at
// most one unsigned version at a time (generateAgreement blocks a
// second while one is Pending Signature), so "most recent" is
// unambiguous.
export function getActiveAgreementForApplication(applicationId: string): AdoptionAgreement | undefined {
  const versions = listAgreementsForApplication(applicationId);
  return versions[versions.length - 1];
}

export function getAgreement(agreementId: string): AdoptionAgreement | undefined {
  return loadAll().find((a) => a.agreementId === agreementId);
}

export function listMyAgreements(email: string): AdoptionAgreement[] {
  const normalized = email.trim().toLowerCase();
  const versions = loadAll().filter((a) => a.adopterEmail.toLowerCase() === normalized);
  // One card per application, showing only the active (latest) version.
  const byApplication = new Map<string, AdoptionAgreement>();
  for (const version of versions) {
    const current = byApplication.get(version.applicationId);
    if (!current || new Date(version.createdAt) > new Date(current.createdAt)) {
      byApplication.set(version.applicationId, version);
    }
  }
  return Array.from(byApplication.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export type MutationResult = { ok: true; agreementId?: string } | { ok: false; reason: string };

function nextVersionLabel(existing: AdoptionAgreement | undefined): string {
  if (!existing) return "v1.0";
  const match = /^v(\d+)\.0$/.exec(existing.agreementVersion);
  const n = match ? Number(match[1]) : 1;
  return `v${n + 1}.0`;
}

// PRD 6.13: "Staff 根据当前条款模板生成 AdoptionAgreement." Judgment call: gated on
// the Meet and Greet outcome being Compatible, since PRD 6.12 says
// "Compatible 进入协议和付款阶段" - there is no agreement-worthy application
// before that point.
export function generateAgreement(applicationId: string, email: string, name: string): MutationResult {
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  const meetAndGreet = getMeetAndGreetForApplication(applicationId);
  if (!meetAndGreet || meetAndGreet.status !== "Compatible") {
    return { ok: false, reason: "not_compatible" };
  }

  const existing = getActiveAgreementForApplication(applicationId);
  if (existing && !existing.isSigned) return { ok: false, reason: "already_pending" };

  const now = new Date().toISOString();
  const agreement: AdoptionAgreement = {
    agreementId: generateId(),
    applicationId,
    animalId: application.animalId,
    animalName: application.animalName,
    animalSpecies: application.animalSpecies,
    adopterEmail: application.adopterEmail,
    adopterName: application.adopterName,
    agreementVersion: nextVersionLabel(existing),
    templateVersion: getSystemSettings().agreementTemplateVersion,
    adoptionConditions: STANDARD_CONDITIONS,
    returnPolicyPeriod: STANDARD_RETURN_POLICY,
    generatedAt: now,
    generatedByEmail: email,
    generatedByName: name,
    isSigned: false,
    createdAt: now,
    updatedAt: now,
  };
  saveAll([...loadAll(), agreement]);

  writeAuditLog({
    userId: email,
    userName: name,
    action: existing ? "Generate New Adoption Agreement Version" : "Generate Adoption Agreement",
    entityType: "Animal",
    entityId: application.animalId,
    oldValue: existing ? `applicationId=${applicationId}, previousVersion=${existing.agreementVersion}` : `applicationId=${applicationId}`,
    newValue: `agreementId=${agreement.agreementId}, version=${agreement.agreementVersion}`,
    result: "Success",
  });

  return { ok: true, agreementId: agreement.agreementId };
}

// PRD 6.13: "Adopter 可在线签署。签署后协议不可编辑." Once signed, the record is
// immutable - the only way forward is generateAgreement() creating a new
// version.
export function signAgreement(agreementId: string, email: string, name: string): MutationResult {
  const all = loadAll();
  const index = all.findIndex((a) => a.agreementId === agreementId);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].isSigned) return { ok: false, reason: "already_signed" };

  const now = new Date().toISOString();
  const agreement = all[index];
  all[index] = { ...agreement, isSigned: true, signedDate: now, updatedAt: now };
  saveAll(all);

  writeAuditLog({
    userId: email,
    userName: name,
    action: "Sign Adoption Agreement",
    entityType: "Animal",
    entityId: agreement.animalId,
    oldValue: `agreementId=${agreementId}, applicationId=${agreement.applicationId}`,
    newValue: "Signed",
    result: "Success",
  });

  return { ok: true };
}

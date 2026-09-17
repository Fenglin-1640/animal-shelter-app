import { writeAuditLog } from "@/lib/audit/store";
import { getApplication } from "@/lib/applications/store";
import { getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getSystemSettings } from "@/lib/system-administration/settings-store";
import type { AdoptionAgreement } from "@/lib/agreements/types";

// FR-AGR-01: AdoptionAgreement now lives in the database (see
// prisma/contract.prisma) behind /api/agreements - see
// prisma/README.md for this Prisma toolchain's quirks.

const STANDARD_CONDITIONS =
  "Standard adoption conditions apply, including desexing and registration requirements, compliance with the ASAMS Code of Care, and notifying the shelter of any change of address.";
const STANDARD_RETURN_POLICY = "14 days";

async function fetchAll(): Promise<AdoptionAgreement[]> {
  const response = await fetch("/api/agreements");
  const result = await response.json();
  return result.items as AdoptionAgreement[];
}

function generateId(): string {
  return `AGR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Every version generated for an application, oldest first - "签署后协议不可
// 编辑，只能查看或生成新版本并重新签署" means a signed version stays in history
// once superseded.
export async function listAgreementsForApplication(applicationId: string): Promise<AdoptionAgreement[]> {
  return (await fetchAll())
    .filter((a) => a.applicationId === applicationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// The current version - the one to view/sign/pay against. There is at
// most one unsigned version at a time (generateAgreement blocks a
// second while one is Pending Signature), so "most recent" is
// unambiguous.
export async function getActiveAgreementForApplication(applicationId: string): Promise<AdoptionAgreement | undefined> {
  const versions = await listAgreementsForApplication(applicationId);
  return versions[versions.length - 1];
}

export async function getAgreement(agreementId: string): Promise<AdoptionAgreement | undefined> {
  return (await fetchAll()).find((a) => a.agreementId === agreementId);
}

// FR-REC-01 "导出...adoption agreement": every version of every agreement.
export async function listAllAgreements(): Promise<AdoptionAgreement[]> {
  return fetchAll();
}

export async function listMyAgreements(email: string): Promise<AdoptionAgreement[]> {
  const normalized = email.trim().toLowerCase();
  const versions = (await fetchAll()).filter((a) => a.adopterEmail.toLowerCase() === normalized);
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
export async function generateAgreement(applicationId: string, email: string, name: string): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  const meetAndGreet = await getMeetAndGreetForApplication(applicationId);
  if (!meetAndGreet || meetAndGreet.status !== "Compatible") {
    return { ok: false, reason: "not_compatible" };
  }

  const existing = await getActiveAgreementForApplication(applicationId);
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
  await fetch("/api/agreements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agreement),
  });

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
export async function signAgreement(agreementId: string, email: string, name: string): Promise<MutationResult> {
  const agreement = await getAgreement(agreementId);
  if (!agreement) return { ok: false, reason: "not_found" };
  if (agreement.isSigned) return { ok: false, reason: "already_signed" };

  const now = new Date().toISOString();
  const response = await fetch(`/api/agreements/${agreementId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isSigned: true, signedDate: now, updatedAt: now }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };

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

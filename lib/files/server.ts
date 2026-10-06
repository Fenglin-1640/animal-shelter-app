import { NextResponse } from "next/server";
import { STAFF, isOwnRecord } from "@/lib/auth/api-roles";
import type { ApiUser } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toSystemSettings } from "@/lib/system-administration/serialize";
import { effectiveRules, type AttachmentRules } from "@/lib/files/rules";

// Server-side checks for /api/files: who may read or add files for an
// owner record, and the attachment rules in force.

export const OWNER_TYPES = ["application"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export interface OwnerAccess {
  canRead: boolean;
  // Add documents.
  canWrite: boolean;
  // Remove documents (only while the application is a Draft).
  canRemove: boolean;
  // The upload answers Staff's request for more documents.
  answersRequest: boolean;
  // For the audit entry: the animal the application is for.
  animalId?: string;
}

// Adoption application documents: Shelter Staff and Administrators can
// see and download them, the Adopter who owns the application can see
// theirs, add or remove them while it is a Draft, and add more (not
// remove) after Staff ask for more documents, until a decision is made.
// Veterinarians, Council Officers and other Adopters cannot.
export async function ownerAccess(auth: ApiUser, ownerType: string, ownerId: string): Promise<OwnerAccess | null> {
  if (ownerType !== "application") return null;
  const app = await db.orm.AdoptionApplication.select("adopterEmail", "applicationStatus", "animalId", "infoRequestedAt").where({ applicationId: ownerId }).first();
  if (!app) return null;
  const staff = STAFF.includes(auth.role);
  const owner = auth.role === "Adopter" && isOwnRecord(auth, app.adopterEmail);
  const draft = app.applicationStatus === "Draft";
  const requested = Boolean(app.infoRequestedAt) && ["Submitted", "Under Review", "On Hold"].includes(app.applicationStatus);
  return {
    canRead: staff || owner,
    canWrite: owner && (draft || requested),
    canRemove: owner && draft,
    answersRequest: owner && !draft && requested,
    animalId: app.animalId,
  };
}

export async function loadRules(): Promise<AttachmentRules> {
  const row = await db.orm.SystemSettings.where({ id: "system-settings" }).first();
  return effectiveRules(row ? toSystemSettings(row) : null);
}

export function fail(status: number, reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status });
}

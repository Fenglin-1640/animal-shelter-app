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
  canWrite: boolean;
  // For the audit entry: the animal the application is for.
  animalId?: string;
}

// Adoption application documents: Shelter Staff and Administrators can
// see and download them, the Adopter who owns the application can see
// theirs and add or remove them while it is a Draft. Veterinarians, Council
// Officers and other Adopters cannot.
export async function ownerAccess(auth: ApiUser, ownerType: string, ownerId: string): Promise<OwnerAccess | null> {
  if (ownerType !== "application") return null;
  const app = await db.orm.AdoptionApplication.select("adopterEmail", "applicationStatus", "animalId").where({ applicationId: ownerId }).first();
  if (!app) return null;
  const staff = STAFF.includes(auth.role);
  const owner = auth.role === "Adopter" && isOwnRecord(auth, app.adopterEmail);
  return { canRead: staff || owner, canWrite: owner && app.applicationStatus === "Draft", animalId: app.animalId };
}

export async function loadRules(): Promise<AttachmentRules> {
  const row = await db.orm.SystemSettings.where({ id: "system-settings" }).first();
  return effectiveRules(row ? toSystemSettings(row) : null);
}

export function fail(status: number, reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status });
}

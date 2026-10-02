import { EMPTY_ADOPTER_PROFILE, type AdopterProfile } from "@/lib/adopter-profile/types";
import { getJson, send } from "@/lib/shared/http";

// Adopter's own maintained profile (FR-ADP-01) now lives in the
// database (see prisma/contract.prisma) behind /api/adopter-profiles -
// see prisma/README.md for this Prisma toolchain's quirks. Keyed by the
// account's email. The demo Adopter (Jordan Taylor)'s seed profile now
// lives in prisma/seed.ts alongside the other PRD 4.2/12.1 seed data,
// not as a runtime fallback here - any other Adopter with no saved row
// yet still falls back to EMPTY_ADOPTER_PROFILE below.

async function fetchAll(): Promise<Record<string, AdopterProfile>> {
  const result = await getJson("/api/adopter-profiles");
  const items = result.items as (AdopterProfile & { email: string })[];
  const map: Record<string, AdopterProfile> = {};
  for (const { email, ...profile } of items) {
    map[email] = profile;
  }
  return map;
}

export async function getAdopterProfile(email: string): Promise<AdopterProfile> {
  const normalized = email.trim().toLowerCase();
  const all = await fetchAll();
  return all[normalized] ?? EMPTY_ADOPTER_PROFILE;
}

export async function saveAdopterProfile(email: string, profile: AdopterProfile): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await send("/api/adopter-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalized, ...profile }),
  });
}

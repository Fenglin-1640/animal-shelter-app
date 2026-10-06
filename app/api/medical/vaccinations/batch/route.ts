import { VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { recordVaccinationBatch, type VaccinationBatchInput } from "@/lib/medical/vaccination-server";

// Several vaccinations given together, all or nothing (see
// recordVaccinationBatch). Veterinarian only.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  return recordVaccinationBatch(auth, (await request.json()) as VaccinationBatchInput);
}

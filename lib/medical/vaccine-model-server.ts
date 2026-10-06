import { db } from "@/lib/db/client";
import { buildVaccineModel, type VaccineModel } from "@/lib/medical/vaccine-model";
import { toDropdownOption } from "@/lib/system-administration/serialize";

// The vaccine model for one animal's species, from the Species and
// Vaccine Type options (two queries, run together).
export async function loadVaccineModel(animalSpecies: string): Promise<VaccineModel> {
  const [species, vaccines] = await Promise.all([
    db.orm.DropdownOption.where({ category: "Species" }).all(),
    db.orm.DropdownOption.where({ category: "Vaccine Type" }).all(),
  ]);
  return buildVaccineModel([...species, ...vaccines].map(toDropdownOption), animalSpecies);
}

export function invalid(message: string) {
  return Response.json({ ok: false, reason: "not_applicable", message }, { status: 422 });
}

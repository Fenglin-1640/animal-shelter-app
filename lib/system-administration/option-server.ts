import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { parseAntigenList, validateVaccineMetadata } from "@/lib/medical/vaccine-model";
import type { DropdownOption } from "@/lib/system-administration/types";

// Server-side handling of the Vaccine Type metadata fields on Dropdown
// Options: validation against the Species options, and the column values
// to store (JSON lists, or null when empty).

export async function vaccineMetadataColumns(
  category: string,
  body: Partial<DropdownOption>,
): Promise<{ columns: { applicableSpecies?: string | null; coversAntigens?: string | null } } | { error: Response }> {
  const touches = "applicableSpecies" in body || "coversAntigens" in body;
  if (!touches) return { columns: {} };
  if (category !== "Vaccine Type") {
    return { error: NextResponse.json({ ok: false, reason: "invalid", message: "Only Vaccine Type options have applicable species and antigens." }, { status: 400 }) };
  }
  const species = await db.orm.DropdownOption.select("id").where({ category: "Species" }).all();
  const antigens = body.coversAntigens == null ? body.coversAntigens : parseAntigenList((body.coversAntigens as string[]).join(","));
  const problem = validateVaccineMetadata(body.applicableSpecies, antigens, new Set(species.map((s) => s.id)));
  if (problem) return { error: NextResponse.json({ ok: false, reason: "invalid", message: problem }, { status: 400 }) };
  const columns: { applicableSpecies?: string | null; coversAntigens?: string | null } = {};
  if ("applicableSpecies" in body) columns.applicableSpecies = body.applicableSpecies?.length ? JSON.stringify([...new Set(body.applicableSpecies)]) : null;
  if ("coversAntigens" in body) columns.coversAntigens = antigens?.length ? JSON.stringify(antigens) : null;
  return { columns };
}

export function describeOption(o: Partial<DropdownOption> & { value?: string }): string {
  const parts = [`value=${o.value ?? ""}`, `description=${o.description ?? ""}`];
  if (o.speciesId) parts.push(`species=${o.speciesId}`);
  if (o.isRetired !== undefined) parts.push(`retired=${o.isRetired ? "yes" : "no"}`);
  if (o.applicableSpecies?.length) parts.push(`applicableSpecies=${o.applicableSpecies.join("/")}`);
  if (o.coversAntigens?.length) parts.push(`covers=${o.coversAntigens.join("/")}`);
  return parts.join("; ");
}

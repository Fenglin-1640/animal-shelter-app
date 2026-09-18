import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toPhoto, toPhotoRowPatch } from "@/lib/photos/serialize";
import type { Photo } from "@/lib/photos/types";

// Generic patch - mirrors CouncilTransferSubmission's/IntakeRecord's
// PATCH routes. Call sites (setPrimaryPhoto, clearPrimaryPhoto) each
// patch a different subset of fields; business-rule checks (not_found,
// alt_text_required) stay client-side in lib/photos/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<Photo>;

  const updated = await db.orm.Photo.where({ id }).update(toPhotoRowPatch(patch));
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toPhoto(updated) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await db.orm.Photo.where({ id }).delete();
  if (!deleted) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

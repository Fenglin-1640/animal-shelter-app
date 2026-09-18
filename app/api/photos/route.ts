import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toPhoto } from "@/lib/photos/serialize";
import type { Photo } from "@/lib/photos/types";

export async function GET() {
  const rows = await db.orm.Photo.where({}).all();
  return NextResponse.json({ items: rows.map(toPhoto) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Photo;
  const created = await db.orm.Photo.create({
    id: body.id,
    animalId: body.animalId,
    fileName: body.fileName,
    fileSizeKB: body.fileSizeKB,
    dateTaken: body.dateTaken,
    takenByEmail: body.takenByEmail,
    takenByName: body.takenByName,
    useOnAdoptionListing: body.useOnAdoptionListing ? 1 : 0,
    altText: body.altText,
    uploadedAt: new Date(body.uploadedAt),
  });
  return NextResponse.json({ ok: true, item: toPhoto(created) });
}

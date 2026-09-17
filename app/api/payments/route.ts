import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionPayment } from "@/lib/payments/serialize";
import type { AdoptionPayment } from "@/lib/payments/types";

export async function GET() {
  const rows = await db.orm.AdoptionPayment.where({}).all();
  return NextResponse.json({ items: rows.map(toAdoptionPayment) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as AdoptionPayment;
  const created = await db.orm.AdoptionPayment.create({
    paymentId: body.paymentId,
    agreementId: body.agreementId,
    applicationId: body.applicationId,
    animalId: body.animalId,
    animalName: body.animalName,
    animalSpecies: body.animalSpecies,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    paymentDate: new Date(body.paymentDate),
    paymentStatus: body.paymentStatus,
    receiptNumber: body.receiptNumber ?? null,
    verifiedByEmail: body.verifiedByEmail ?? null,
    verifiedByName: body.verifiedByName ?? null,
    verifiedDate: body.verifiedDate ? new Date(body.verifiedDate) : null,
    failureReason: body.failureReason ?? null,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionPayment(created) });
}

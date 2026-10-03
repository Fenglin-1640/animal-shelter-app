import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionPayment } from "@/lib/payments/serialize";
import type { AdoptionPayment } from "@/lib/payments/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.AdoptionPayment.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toAdoptionPayment).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireRole(ADOPTER);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AdoptionPayment;
  // An Adopter can only pay against their own agreement.
  const agreement = await db.orm.AdoptionAgreement.where({ agreementId: body.agreementId }).first();
  if (!agreement || !isOwnRecord(auth, agreement.adopterEmail) || !isOwnRecord(auth, body.adopterEmail)) return forbidden();
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
    paymentDate: toTimestamptz(body.paymentDate),
    paymentStatus: body.paymentStatus,
    receiptNumber: body.receiptNumber ?? null,
    verifiedByEmail: body.verifiedByEmail ?? null,
    verifiedByName: body.verifiedByName ?? null,
    verifiedDate: toTimestamptz(body.verifiedDate ?? null),
    failureReason: body.failureReason ?? null,
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionPayment(created) });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ALL_ROLES } from "@/lib/auth/api-roles";

// My Profile's Contact Details form (self-service - no role check needed
// beyond being signed in, which every authenticated route in this
// prototype currently trusts the client for, same as before the API
// existed).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  // Users manage their own profile and password only.
  if (id !== auth.id) return forbidden();
  const body = await request.json();
  const title = String(body.title ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  const current = await db.orm.User.where({ id }).first();
  if (!current) {
    return NextResponse.json({ ok: false, reason: "not_found" });
  }

  await db.orm.User.where({ id }).update({ title, firstName, lastName, phone });
  return NextResponse.json({ ok: true });
}

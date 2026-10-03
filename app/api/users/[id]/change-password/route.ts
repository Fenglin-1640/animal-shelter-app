import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ALL_ROLES } from "@/lib/auth/api-roles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  // Users manage their own profile and password only.
  if (id !== auth.id) return forbidden();
  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  const current = await db.orm.User.where({ id }).first();
  if (!current || current.password !== currentPassword) {
    return NextResponse.json({ ok: false, reason: "incorrect_current_password" });
  }

  await db.orm.User.where({ id }).update({ password: newPassword });
  return NextResponse.json({ ok: true });
}

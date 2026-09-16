import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

// Used by refreshCurrentUser() to re-derive the signed-in user's own
// session (SessionUser shape, not DirectoryUser) after an action that may
// have changed their role/status - e.g. an Administrator transfer that
// demotes themselves.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const account = await db.orm.User.where({ id }).first();
  if (!account) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      title: account.title,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone,
      signUpAt: account.signUpAt.toISOString(),
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    },
  });
}

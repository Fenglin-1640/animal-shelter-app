import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/auth/server-session";

// Who the server session belongs to - the browser checks this on load so
// its stored user can't drift from the account the API is acting as
// (e.g. after signing in as someone else in another tab, an expired
// session, or deactivation).
export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  return NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
}

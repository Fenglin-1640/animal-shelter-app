import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/server-session";

// The account this browser's server session belongs to, in the same shape
// Sign In returns. The browser uses it on page load to restore (or, in a
// new tab, re-create) its signed-in user. 401 means there is no valid
// session - missing, expired, signed out, or the account is now Inactive
// or Locked - and is the only answer that signs the browser out.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ ok: true, user });
}

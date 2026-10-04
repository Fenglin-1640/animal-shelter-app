import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/server-session";

// The account this tab's session token belongs to, in the same shape Sign
// In returns, plus a renewed token when the current one is due for
// renewal. The browser uses it on page load to restore the tab's signed-in
// user, and at most hourly to keep the sliding session alive. 401 means
// there is no valid session - missing, expired, or the account is now
// Inactive or Locked - and is the only answer that signs the tab out.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  return NextResponse.json({ ok: true, user: session.user, ...(session.renewedToken ? { token: session.renewedToken } : {}) });
}

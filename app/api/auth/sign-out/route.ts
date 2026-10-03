import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/server-session";

// Ends the server session (clears the signed cookie set by Sign In).
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

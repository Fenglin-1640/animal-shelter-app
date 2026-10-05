import { NextResponse } from "next/server";
import { ALL_ROLES } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { loadRules } from "@/lib/files/server";

// The attachment rules in force (formats and size), for upload screens.
export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  return NextResponse.json({ ok: true, rules: await loadRules() });
}

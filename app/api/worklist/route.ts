import { NextResponse } from "next/server";
import { ALL_ROLES } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { buildWorklist } from "@/lib/process/worklist";

// The signed-in user's pending work in one batch: list flags/ordering,
// "Needs my action" items, sidebar counts and payments awaiting
// confirmation (lib/process/worklist.ts). Adopters only ever get their own
// applications; Council Officers only their own transfers.
export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  return NextResponse.json({ ok: true, ...(await buildWorklist(auth.role, auth.email)) });
}

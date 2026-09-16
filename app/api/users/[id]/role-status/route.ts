import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

// FR-UA-02: role/status rules - a single concurrent Active Administrator
// (auto-demoting the outgoing one to Shelter Staff Member as part of a
// transfer, PRD 4.1), and blocking the current Administrator from
// deactivating themselves. Audit log entries are written by the caller
// (lib/user-administration/directory-store.ts) since AuditLog stays a
// client-side/localStorage prototype feature for this pilot slice - this
// route returns enough detail (oldValue/newValue, any auto-demoted admin)
// for the caller to record them.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const newRole = String(body.newRole ?? "");
  const newStatus = body.newStatus === "Inactive" ? "Inactive" : "Active";
  const actingAdminEmail = String(body.actingAdminEmail ?? "").trim().toLowerCase();
  const actingAdminDisplayName = String(body.actingAdminDisplayName ?? "");

  const current = await db.orm.User.where({ id }).first();
  if (!current) {
    return NextResponse.json({ ok: false, reason: "not_found" });
  }

  const isSelf = current.email.toLowerCase() === actingAdminEmail;
  if (isSelf && current.role === "Administrator" && newStatus === "Inactive") {
    return NextResponse.json({ ok: false, reason: "cannot_deactivate_self_administrator" });
  }

  const becomingAdministrator = newRole === "Administrator" && current.role !== "Administrator";
  const now = new Date();
  let demoted: { email: string; displayName: string } | null = null;

  if (becomingAdministrator) {
    if (newStatus !== "Active") {
      return NextResponse.json({ ok: false, reason: "target_not_active_for_transfer" });
    }

    const activeAdmins = await db.orm.User.where({ role: "Administrator", status: "Active" }).all();
    const existingAdmin = activeAdmins.find((u) => u.id !== current.id);
    if (existingAdmin) {
      await db.orm.User.where({ id: existingAdmin.id }).update({
        role: "Shelter Staff Member",
        roleUpdatedBy: actingAdminDisplayName,
        roleUpdatedAt: now,
      });
      demoted = {
        email: existingAdmin.email,
        displayName: `${existingAdmin.title} ${existingAdmin.firstName} ${existingAdmin.lastName}`.trim(),
      };
    }
  }

  const oldValue = `role=${current.role}, status=${current.status}`;
  const newValue = `role=${newRole}, status=${newStatus}`;
  const patch: Record<string, unknown> = {};
  if (newRole !== current.role) {
    patch.role = newRole;
    patch.roleUpdatedBy = actingAdminDisplayName;
    patch.roleUpdatedAt = now;
  }
  if (newStatus !== current.status) {
    patch.status = newStatus;
    patch.statusUpdatedBy = actingAdminDisplayName;
    patch.statusUpdatedAt = now;
  }

  const changed = Object.keys(patch).length > 0;
  if (changed) {
    await db.orm.User.where({ id: current.id }).update(patch);
  }

  return NextResponse.json({ ok: true, changed, oldValue, newValue, demoted });
}

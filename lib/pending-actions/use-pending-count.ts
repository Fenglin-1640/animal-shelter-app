"use client";

import { useWorklist } from "@/lib/process/worklist-client";

// A nav item (RoleSidebar) reads its own pending count by label from the
// shared worklist (lib/process/worklist-client.ts: one GET /api/worklist
// per tab, refreshed every 20 s and on window focus). Returns 0 for any
// label with nothing pending, or while the worklist hasn't loaded -
// RoleSidebar only shows a badge for count > 0.
export function usePendingCount(label: string): number {
  return useWorklist()?.counts[label] ?? 0;
}

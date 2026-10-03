"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getJson } from "@/lib/shared/http";

// A nav item (RoleSidebar) subscribes to its own pending count by label.
// Every badge on the page asks GET /api/pending-counts (which answers for
// the signed-in user's session), so they share one request (lib/shared/http.ts) and the
// server returns only the counts (lib/pending-actions/counts.ts).
// Returns 0 for any label with no badge, or while the signed-in user is
// unknown - RoleSidebar only shows a badge for count > 0, so both cases
// render identically to "nothing pending".
export function usePendingCount(label: string): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getJson<{ counts?: Record<string, number> }>("/api/pending-counts").then((result) => {
      if (!cancelled) setCount(result.counts?.[label] ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [label, user]);

  return count;
}

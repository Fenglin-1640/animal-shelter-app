"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PENDING_ACTION_FETCHERS } from "@/lib/pending-actions/registry";

// A nav item (RoleSidebar) subscribes to its own pending count by label.
// Returns 0 for any label with no registered fetcher, or while the
// signed-in user is unknown - RoleSidebar only shows a badge for
// count > 0, so both cases render identically to "nothing pending".
export function usePendingCount(label: string): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetcher = PENDING_ACTION_FETCHERS[label];
    let cancelled = false;
    (fetcher && user ? fetcher(user) : Promise.resolve(0)).then((result) => {
      if (!cancelled) setCount(result);
    });
    return () => {
      cancelled = true;
    };
  }, [label, user]);

  return count;
}

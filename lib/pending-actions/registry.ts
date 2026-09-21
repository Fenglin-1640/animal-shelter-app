import type { SessionUser } from "@/lib/auth/auth-context";
import { listSubmittedTransfers } from "@/lib/council-transfers/store";
import { listLinkedTransferIds } from "@/lib/intake-records/store";
import { countAwaitingDecision } from "@/lib/applications/store";
import { countAwaitingPreReleaseCheck } from "@/lib/medical/store";
import { countPendingForAdopter } from "@/lib/meet-and-greets/store";
import { countPendingVerification } from "@/lib/payments/store";

export type PendingCountFetcher = (user: SessionUser) => Promise<number>;

// For the "Animal Intake" nav badge - a Submitted Council Transfer with
// no linked Intake Record yet. Lives here rather than in either store to
// avoid a circular import: lib/intake-records/store.ts already imports
// from lib/council-transfers/store.ts (acceptTransfer, getTransfer), so
// the reverse import would cycle.
async function countUnlinkedSubmittedTransfers(): Promise<number> {
  const [submitted, linkedIds] = await Promise.all([listSubmittedTransfers(), listLinkedTransferIds()]);
  return submitted.filter((t) => !linkedIds.has(t.id)).length;
}

// Maps a RoleSidebar/FUNCTION_HREFS nav label (lib/roles/function-links.ts)
// to a fetcher counting items concretely, individually actionable by the
// signed-in user right now. A nav item with no entry here never shows a
// badge (usePendingCount returns 0) - "pending" must be a well-defined,
// actionable state, not just "new data exists" on that screen. Extend
// this map (not the hook or NavItem) to add another badge.
export const PENDING_ACTION_FETCHERS: Partial<Record<string, PendingCountFetcher>> = {
  Adoptions: () => countPendingVerification(),
  "Adoption Applications": () => countAwaitingDecision(),
  "Animal Intake": () => countUnlinkedSubmittedTransfers(),
  "Pre-Release Checks": () => countAwaitingPreReleaseCheck(),
  "My Meet and Greets": (user) => countPendingForAdopter(user.email),
};

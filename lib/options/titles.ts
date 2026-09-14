import { getActiveValues } from "@/lib/system-administration/store";
import { buildSeedOptions } from "@/lib/system-administration/seed-options";

// Sourced from the FR-SA-01 dropdown option store (category "Title") so
// that retiring a Title there is reflected in Sign Up, My Profile and
// User Administration's Add User form.
export function getActiveTitleOptions(): string[] {
  return getActiveValues("Title");
}

// Pure, no localStorage access - safe to use as a component's initial
// render value on a page that isn't gated behind an auth-loading state
// (Sign Up), so server and client render the same thing on first paint.
// Call getActiveTitleOptions() in an effect afterwards to correct it.
const SEED_TITLE_OPTIONS = buildSeedOptions()
  .filter((o) => o.category === "Title")
  .map((o) => o.value);

export function getInitialTitleOptions(): string[] {
  return SEED_TITLE_OPTIONS;
}

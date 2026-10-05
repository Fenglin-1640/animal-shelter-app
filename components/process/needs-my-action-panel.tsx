"use client";

import Link from "next/link";
import { refreshWorklist, useWorklist, useWorklistFailed } from "@/lib/process/worklist-client";

// "Needs my action" on the home page: every item waiting on the signed-in
// role, each linking straight to where the action is taken. Refreshed with
// the shared worklist (every 20 s and on window focus).
export function NeedsMyActionPanel() {
  const worklist = useWorklist({ eager: true });
  const failed = useWorklistFailed();
  return (
    <section aria-labelledby="needs-my-action-heading" className="rounded-[12px] border border-border bg-surface p-5 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 id="needs-my-action-heading" className="flex items-center gap-2 text-lg font-bold text-text">
        Needs my action
        {worklist && worklist.items.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-page">
            {worklist.items.length}
          </span>
        )}
      </h2>
      {!worklist && failed ? (
        <p className="mt-2 text-sm text-text-muted">
          Couldn&apos;t load your pending items.{" "}
          <button type="button" onClick={() => void refreshWorklist()} className="font-semibold text-secondary underline underline-offset-2">
            Try again
          </button>
        </p>
      ) : !worklist ? (
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      ) : worklist.items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Nothing is waiting on you right now.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {worklist.items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 hover:bg-surface-active"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-text">
                  <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
                  {item.title}
                </span>
                <span className="text-xs font-semibold text-danger">{item.nextAction}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

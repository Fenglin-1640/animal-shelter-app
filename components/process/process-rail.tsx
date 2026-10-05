"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { StepState } from "@/lib/process/engine";

export interface RailStep {
  key: string;
  label: string;
  state: StepState;
  needsMe?: boolean;
  // Small secondary line under the label (Adopter wording).
  subtext?: string;
  // Tooltip lines; no tooltip when empty.
  tooltip?: string[];
}

export const RAIL_DOT: Record<StepState, string> = {
  not_started: "bg-process-not-started",
  waiting: "bg-process-waiting",
  in_progress: "bg-process-in-progress",
  done: "bg-process-done",
  blocked: "bg-process-blocked",
};

const LEGEND: { state: StepState; label: string }[] = [
  { state: "not_started", label: "Not started" },
  { state: "waiting", label: "Waiting" },
  { state: "in_progress", label: "In progress" },
  { state: "done", label: "Done" },
  { state: "blocked", label: "Blocked" },
];

const ACTIVE: StepState[] = ["waiting", "in_progress", "blocked"];

function CompactLegend({ showAction }: { showAction: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] leading-tight text-text-muted" aria-label="Process colour legend">
      {LEGEND.map(({ state, label }) => (
        <li key={state} className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${RAIL_DOT[state]}`} aria-hidden="true" />
          {label}
        </li>
      ))}
      {showAction && (
        <li className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
          Your action
        </li>
      )}
    </ul>
  );
}

// Thin line with a tiny arrowhead between consecutive nodes.
function Connector() {
  return (
    <svg aria-hidden="true" width="10" height="11" viewBox="0 0 10 11" className="ml-[3px] block text-text-muted opacity-50">
      <line x1="5" y1="0" x2="5" y2="8" stroke="currentColor" strokeWidth="1" />
      <path d="M2.5 6.5 L5 9.5 L7.5 6.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface TipState {
  key: string;
  top: number;
  right: number;
}

// The steps as a compact vertical list. Each node with a tooltip is
// focusable; its tooltip opens to the LEFT of the node on hover or focus,
// positioned against the viewport so the rail's own scroll area never
// clips it.
function RailList({ steps, idPrefix }: { steps: RailStep[]; idPrefix: string }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (key: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setTip({ key, top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 8 });
  };
  const hide = (key: string) => setTip((t) => (t?.key === key ? null : t));

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tip]);

  return (
    <ol className="flex flex-col" aria-label="Process steps">
      {steps.map((step, i) => {
        const tipId = `${idPrefix}-${step.key}-tip`;
        const hasTip = Boolean(step.tooltip?.length);
        const active = ACTIVE.includes(step.state);
        const tone = active ? "bg-surface font-semibold text-text" : "text-text-muted";
        return (
          <li key={step.key}>
            <div
              tabIndex={hasTip ? 0 : undefined}
              aria-describedby={hasTip ? tipId : undefined}
              onMouseEnter={hasTip ? (e) => show(step.key, e.currentTarget) : undefined}
              onMouseLeave={hasTip ? () => hide(step.key) : undefined}
              onFocus={hasTip ? (e) => show(step.key, e.currentTarget) : undefined}
              onBlur={hasTip ? () => hide(step.key) : undefined}
              className={`flex items-start gap-1.5 rounded-[6px] px-1 py-0.5 text-xs leading-4 outline-none focus-visible:ring-2 focus-visible:ring-focus ${tone}`}
            >
              <span className={`mt-[4px] inline-block h-2 w-2 shrink-0 rounded-full ${RAIL_DOT[step.state]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block">{step.label}</span>
                {step.subtext && <span className="block text-[11px] font-normal leading-tight text-text-muted">{step.subtext}</span>}
              </span>
              {step.needsMe && (
                <span className="mt-[5px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-danger" role="img" aria-label="Needs your action" />
              )}
            </div>
            {hasTip && (
              <span
                id={tipId}
                role="tooltip"
                hidden={tip?.key !== step.key}
                style={tip?.key === step.key ? { top: tip.top, right: tip.right } : undefined}
                className="pointer-events-none fixed z-50 w-56 -translate-y-1/2 rounded-[8px] border border-border bg-surface p-2 text-xs font-normal text-text shadow-lg"
              >
                {step.tooltip!.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            )}
            {i < steps.length - 1 && <Connector />}
          </li>
        );
      })}
    </ol>
  );
}

function RailBody({
  title,
  steps,
  idPrefix,
  headingId,
  showActionLegend,
  footer,
}: {
  title: string;
  steps: RailStep[] | null;
  idPrefix: string;
  headingId: string;
  showActionLegend: boolean;
  footer?: ReactNode;
}) {
  return (
    <>
      <h2 id={headingId} className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-text-muted">
        {title}
      </h2>
      {steps ? (
        <RailList steps={steps} idPrefix={idPrefix} />
      ) : (
        <div className="flex flex-col gap-2 px-1" aria-label={`Loading ${title.toLowerCase()}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-3 animate-pulse rounded bg-surface" />
          ))}
        </div>
      )}
      <div className="mt-auto border-t border-border pt-3">
        <CompactLegend showAction={showActionLegend} />
        {footer}
      </div>
    </>
  );
}

// The process as a narrow rail on the right: a sticky column at 1280 px
// and wider, otherwise a "Process" button (red dot when a step needs the
// viewer) that opens the same rail in a drawer, closed with Esc.
export function ProcessRail({
  title = "Process",
  steps,
  idPrefix,
  showActionLegend = true,
}: {
  title?: string;
  steps: RailStep[] | null;
  idPrefix: string;
  showActionLegend?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const needsMe = Boolean(steps?.some((s) => s.needsMe));

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <aside
        aria-labelledby={`${uid}-rail`}
        data-process-rail="desktop"
        className="sticky top-14 hidden h-[calc(100vh-56px)] w-[208px] shrink-0 flex-col overflow-y-auto border-l border-border bg-page px-3 py-4 xl:flex"
      >
        <RailBody title={title} steps={steps} idPrefix={`${idPrefix}-d`} headingId={`${uid}-rail`} showActionLegend={showActionLegend} />
      </aside>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text shadow-lg hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus xl:hidden"
      >
        {title}
        {needsMe && <span className="inline-block h-2 w-2 rounded-full bg-danger" role="img" aria-label="Needs your action" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-drawer`}
            data-process-rail="drawer"
            className="absolute right-0 top-0 flex h-full w-[240px] max-w-[85vw] flex-col overflow-y-auto border-l border-border bg-page px-3 py-4 shadow-xl"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="mb-2 self-end rounded-[8px] px-2 py-1 text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              Close
            </button>
            <RailBody title={title} steps={steps} idPrefix={`${idPrefix}-m`} headingId={`${uid}-drawer`} showActionLegend={showActionLegend} />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  addDaysISO,
  formatDate,
  formatDateTime,
  parseDisplayDate,
  parseDisplayDateTime,
  todayISO,
} from "@/lib/shared/dates";

// Text fields for dates ("DD/MM/YYYY") and dates with times
// ("DD/MM/YYYY HH:mm", 24-hour), with a calendar to pick from. They replace
// the browser's own date inputs, whose placeholder and picker follow the
// browser language. Values stay ISO: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".
// As with the browser inputs, onChange gets "" until the text is a whole,
// real date, and a date outside min/max is still passed on (and flagged).

type CommonProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // For the wrapper (the field and its calendar button), e.g. "w-fit".
  wrapperClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

// Digits typed so far, laid out as DD/MM/YYYY[ HH:mm]; separators appear
// once the next group starts, so deleting works naturally.
function mask(text: string, withTime: boolean): string {
  const digits = text.replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  const groups = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8), digits.slice(8, 10), digits.slice(10, 12)];
  let out = groups[0];
  if (digits.length > 2) out += `/${groups[1]}`;
  if (digits.length > 4) out += `/${groups[2]}`;
  if (digits.length > 8) out += ` ${groups[3]}`;
  if (digits.length > 10) out += `:${groups[4]}`;
  return out;
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Month grid (weeks start on Monday) with arrow-key navigation:
// arrows move a day or a week, Page Up/Down a month, Home/End to the
// start/end of the week, Enter or Space picks, Escape closes.
function Calendar({
  selected,
  min,
  max,
  onPick,
  onClose,
}: {
  selected: string;
  min?: string;
  max?: string;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const clamp = (d: string) => (min && d < min ? min : max && d > max ? max : d);
  const [focus, setFocus] = useState(() => clamp(selected || todayISO()));
  const gridRef = useRef<HTMLDivElement>(null);
  const [y, m] = [Number(focus.slice(0, 4)), Number(focus.slice(5, 7)) - 1];

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus]);

  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days before the 1st, Monday first
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => iso(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const outOfRange = (d: string) => Boolean((min && d < min) || (max && d > max));
  const shiftMonth = (n: number) => {
    const day = Number(focus.slice(8, 10));
    const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
    const target = new Date(Date.UTC(y, m + n, Math.min(day, last)));
    setFocus(iso(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const weekday = (new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => setFocus(addDaysISO(focus, -1)),
      ArrowRight: () => setFocus(addDaysISO(focus, 1)),
      ArrowUp: () => setFocus(addDaysISO(focus, -7)),
      ArrowDown: () => setFocus(addDaysISO(focus, 7)),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      Home: () => setFocus(addDaysISO(focus, -weekday)),
      End: () => setFocus(addDaysISO(focus, 6 - weekday)),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moves[e.key]();
    }
  };

  return (
    <div className="w-[17rem] p-3" onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), onClose())}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="h-8 w-8 rounded-[8px] border border-border text-text hover:bg-surface-active">
          &lsaquo;
        </button>
        <p className="text-sm font-semibold text-text" aria-live="polite">
          {MONTH_NAMES[m]} {y}
        </p>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="h-8 w-8 rounded-[8px] border border-border text-text hover:bg-surface-active">
          &rsaquo;
        </button>
      </div>
      <div ref={gridRef} role="grid" aria-label={`${MONTH_NAMES[m]} ${y}`} onKeyDown={onKeyDown} className="mt-2">
        <div role="row" className="grid grid-cols-7 text-center text-[11px] font-semibold text-text-muted">
          {WEEKDAY_NAMES.map((name) => (
            <span key={name} role="columnheader" aria-label={name} className="py-1">
              {name.slice(0, 2)}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <div key={row} role="row" className="grid grid-cols-7">
            {cells.slice(row * 7, row * 7 + 7).map((d, i) =>
              d ? (
                <span key={d} role="gridcell" aria-selected={d === selected}>
                  <button
                    type="button"
                    data-date={d}
                    tabIndex={d === focus ? 0 : -1}
                    disabled={outOfRange(d)}
                    aria-label={`${WEEKDAY_NAMES[i]} ${Number(d.slice(8, 10))} ${MONTH_NAMES[m]} ${y}`}
                    aria-current={d === todayISO() ? "date" : undefined}
                    onClick={() => onPick(d)}
                    className={`h-8 w-full rounded-[8px] text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-35 ${
                      d === selected ? "bg-primary font-semibold text-page" : d === todayISO() ? "border border-primary text-text" : "text-text hover:bg-surface-active"
                    }`}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                </span>
              ) : (
                <span key={`e${row}-${i}`} role="gridcell" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MaskedDateInput({ withTime, ...props }: CommonProps & { withTime: boolean }) {
  const { value, onChange, min, max, required, disabled, className = "", wrapperClassName = "", "aria-label": ariaLabel, "aria-describedby": describedBy } = props;
  const autoId = useId();
  const id = props.id ?? `date-${autoId}`;
  const toText = (v: string) => (withTime ? formatDateTime(v) : formatDate(v));
  const parse = (t: string) => (withTime ? parseDisplayDateTime(t) : parseDisplayDate(t));

  const [text, setText] = useState(() => toText(value));
  const [lastValue, setLastValue] = useState(value);
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A new value from outside (a reset or default) replaces the text.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== (parse(text) ?? "")) setText(toText(value));
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const format = withTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY";
  const complete = text.length === format.length;
  const parsed = parse(text);
  const datePart = parsed?.slice(0, 10) ?? "";
  const bounds = (v: string) => (withTime ? v : v.slice(0, 10));
  let error = "";
  if (text && (complete || touched) && !parsed) error = `Enter ${withTime ? "a date and time" : "a date"} as ${format}${withTime ? " (24-hour)" : ""}.`;
  else if (parsed && min && parsed < bounds(min)) error = `Must be on or after ${toText(min)}.`;
  else if (parsed && max && parsed > bounds(max)) error = `Must be on or before ${toText(max)}.`;
  else if (!text && required && touched) error = "This field is required.";

  const emit = (next: string) => {
    setText(next);
    onChange(parse(next) ?? "");
  };
  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };
  const pick = (date: string) => {
    // Picking a day keeps the time already entered (09:00 if none).
    const time = parsed?.slice(11, 16) || "09:00";
    emit(withTime ? formatDateTime(`${date}T${time}`) : formatDate(date));
    setOpen(false);
    inputRef.current?.focus();
  };

  const describedByIds = [`${id}-format`, error ? `${id}-error` : "", describedBy ?? ""].filter(Boolean).join(" ");
  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={format}
        value={text}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds}
        onChange={(e) => emit(mask(e.target.value, withTime))}
        onBlur={() => setTouched(true)}
        className={`${className} w-full pr-9`}
      />
      <span id={`${id}-format`} className="sr-only">
        Format {format}
        {withTime ? ", 24-hour time" : ""}.
      </span>
      <button
        ref={toggleRef}
        type="button"
        disabled={disabled}
        aria-label={withTime ? "Choose date (calendar)" : "Choose date"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-muted hover:bg-surface-active hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
      >
        <CalendarIcon />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose date" className="absolute left-0 top-full z-50 mt-1 rounded-[12px] border border-border bg-surface shadow-lg">
          <Calendar selected={datePart} min={min?.slice(0, 10)} max={max?.slice(0, 10)} onPick={pick} onClose={close} />
        </div>
      )}
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// value / min / max: "YYYY-MM-DD".
export function DateField(props: CommonProps) {
  return <MaskedDateInput {...props} withTime={false} />;
}

// value / min / max: "YYYY-MM-DDTHH:mm" (as the browser's datetime field gave).
export function DateTimeField(props: CommonProps) {
  return <MaskedDateInput {...props} withTime />;
}

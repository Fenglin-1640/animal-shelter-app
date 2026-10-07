// Dates and times as shown to users: Australian order, 24-hour clock, in
// Brisbane time (UTC+10, no daylight saving), whatever the browser's
// language or time zone. Values exchanged with the API stay ISO strings;
// these helpers only change how they are read and written in the UI.

const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A datetime without a zone (from a date-and-time field) is a wall-clock
// value already, so it is shown as entered.
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const pad = (n: number) => String(n).padStart(2, "0");

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

function partsOf(value: string): Parts | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) return { y: +dateOnly[1], m: +dateOnly[2], d: +dateOnly[3], hh: 0, mm: 0 };
  const local = LOCAL_DATETIME.exec(value);
  if (local) return { y: +local[1], m: +local[2], d: +local[3], hh: +local[4], mm: +local[5] };
  // Database timestamps ("2026-09-25 08:20:51.71+00") in a form every browser parses.
  const normalised = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2").replace(/([+-]\d{2})$/, "$1:00");
  const time = new Date(normalised).getTime();
  if (Number.isNaN(time)) return null;
  const b = new Date(time + BRISBANE_OFFSET_MS);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate(), hh: b.getUTCHours(), mm: b.getUTCMinutes() };
}

// "DD/MM/YYYY". Date-only values are calendar dates and are not shifted.
export function formatDate(value: string | null | undefined): string {
  const p = value ? partsOf(value) : null;
  return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : "";
}

// "DD/MM/YYYY HH:mm" (24-hour, Brisbane time); a date-only value shows the date alone.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const p = partsOf(value);
  if (!p) return "";
  return DATE_ONLY.test(value) ? formatDate(value) : `${pad(p.d)}/${pad(p.m)}/${p.y} ${pad(p.hh)}:${pad(p.mm)}`;
}

// Today's date in Brisbane as "YYYY-MM-DD".
export function todayISO(now = Date.now()): string {
  const b = new Date(now + BRISBANE_OFFSET_MS);
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`;
}

// A "YYYY-MM-DD" date moved by whole days.
export function addDaysISO(iso: string, days: number): string {
  const m = DATE_ONLY.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// The current Brisbane wall-clock time as "YYYY-MM-DDTHH:mm".
export function nowLocalDateTime(now = Date.now()): string {
  const b = new Date(now + BRISBANE_OFFSET_MS);
  return `${todayISO(now)}T${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

// An instant as Brisbane wall-clock time "YYYY-MM-DDTHH:mm" (for a date-and-time field).
export function toBrisbaneLocal(isoInstant: string): string {
  const time = new Date(isoInstant).getTime();
  return Number.isNaN(time) ? "" : nowLocalDateTime(time);
}

// A Brisbane wall-clock "YYYY-MM-DDTHH:mm" as an ISO instant ("" if invalid).
export function fromBrisbaneLocal(local: string): string {
  if (!LOCAL_DATETIME.test(local)) return "";
  const time = new Date(`${local.slice(0, 16)}:00+10:00`).getTime();
  return Number.isNaN(time) ? "" : new Date(time).toISOString();
}

// "DD/MM/YYYY" text -> "YYYY-MM-DD", or null if it isn't a real date.
export function parseDisplayDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

// "DD/MM/YYYY HH:mm" text -> "YYYY-MM-DDTHH:mm", or null.
export function parseDisplayDateTime(text: string): string | null {
  const m = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const date = parseDisplayDate(m[1]);
  const [hh, mm] = [+m[2], +m[3]];
  if (!date || hh > 23 || mm > 59) return null;
  return `${date}T${pad(hh)}:${pad(mm)}`;
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

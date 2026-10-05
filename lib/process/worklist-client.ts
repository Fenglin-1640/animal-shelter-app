"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import type { Worklist } from "@/lib/process/worklist";
import { DATA_CHANGED_EVENT, getJson } from "@/lib/shared/http";

// One shared poller per tab for GET /api/worklist: every subscriber
// (sidebar badges, list flags, "Needs my action" panels, payment popup)
// reads the same snapshot, refreshed every 20 s and whenever the window
// regains focus - one request at a time, however many components listen.
// The first load waits until the page has fetched its own data (it would
// otherwise compete with it), unless a component that is built around the
// worklist asks for it straight away (useWorklist({ eager: true })).

const REFRESH_MS = 20000;
const DEFERRED_FIRST_LOAD_MS = 1500;

let snapshot: Worklist | null = null;
let failed = false;
let firstLoadTimer: ReturnType<typeof setTimeout> | null = null;
let loading: Promise<void> | null = null;
let snapshotUserKey = "";
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let currentUserKey = "";

function emit() {
  for (const l of listeners) l();
}

export function refreshWorklist(): Promise<void> {
  const userKey = currentUserKey;
  if (!userKey) return Promise.resolve();
  if (firstLoadTimer) {
    clearTimeout(firstLoadTimer);
    firstLoadTimer = null;
  }
  loading = getJson<Worklist & { ok?: boolean }>("/api/worklist")
    .then((result) => {
      // Ignore a response for a user this tab is no longer signed in as.
      if (userKey !== currentUserKey) return;
      if (result.ok === false) {
        failed = true;
      } else {
        snapshot = result;
        snapshotUserKey = userKey;
        failed = false;
      }
      emit();
    })
    .catch(() => {
      failed = true;
      emit();
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

// Load the worklist now if it hasn't loaded and isn't loading - for list
// screens, right after their own data arrives (so the two don't compete).
export function ensureWorklist() {
  if (!snapshot && !loading && currentUserKey) void refreshWorklist();
}

// True once a load has failed and nothing newer has arrived (the panel
// shows a retry instead of loading forever).
export function useWorklistFailed(): boolean {
  return useSyncExternalStore(subscribe, () => failed && !snapshot, () => false);
}

function onFocus() {
  void refreshWorklist();
}

// A burst of writes (one action often makes several) triggers a single
// refresh shortly after the last one.
let changeTimer: ReturnType<typeof setTimeout> | null = null;
function onDataChanged() {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    void refreshWorklist();
  }, 400);
}

function start() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => void refreshWorklist(), REFRESH_MS);
  window.addEventListener("focus", onFocus);
  window.addEventListener(DATA_CHANGED_EVENT, onDataChanged);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("focus", onFocus);
    window.removeEventListener(DATA_CHANGED_EVENT, onDataChanged);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function useWorklist(options: { eager?: boolean } = {}): Worklist | null {
  const { user } = useAuth();
  const userKey = user ? `${user.id}:${user.role}` : "";
  const eager = Boolean(options.eager);
  useEffect(() => {
    if (userKey !== currentUserKey) {
      currentUserKey = userKey;
      snapshot = null;
      failed = false;
      if (firstLoadTimer) clearTimeout(firstLoadTimer);
      firstLoadTimer = null;
      emit();
    }
    if (!userKey || snapshot || loading) return;
    if (eager) {
      void refreshWorklist();
    } else if (!firstLoadTimer) {
      firstLoadTimer = setTimeout(() => {
        firstLoadTimer = null;
        void refreshWorklist();
      }, DEFERRED_FIRST_LOAD_MS);
    }
  }, [userKey, eager]);
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );
  return value && snapshotUserKey === userKey ? value : null;
}

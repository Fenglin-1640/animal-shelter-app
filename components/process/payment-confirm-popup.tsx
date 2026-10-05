"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorklist } from "@/lib/process/worklist-client";

const SHOWN_KEY = "asams-payment-popups-shown";

function readShown(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markShown(paymentId: string) {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set([...readShown(), paymentId])]));
  } catch {
    // Without storage the popup may show again after a refresh.
  }
}

// On the Staff/Administrator home: a popup for each payment an Adopter has
// made that is waiting for confirmation, shown once per payment per
// session (this tab). The payment stays in "Needs my action" until it is
// confirmed.
export function PaymentConfirmPopup() {
  const worklist = useWorklist({ eager: true });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [shown, setShown] = useState<string[] | null>(null);
  const confirmRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // sessionStorage is read after mount so the server render matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(readShown());
  }, []);

  const payment =
    shown === null
      ? undefined
      : worklist?.paymentsToConfirm.find((p) => !shown.includes(p.paymentId) && !dismissed.includes(p.paymentId));

  useEffect(() => {
    if (!payment) return;
    markShown(payment.paymentId);
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed((d) => [...d, payment.paymentId]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payment]);

  if (!payment) return null;
  const close = () => setDismissed((d) => [...d, payment.paymentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="payment-popup-title" className="w-full max-w-[440px] rounded-[12px] border border-border bg-surface p-6 shadow-lg">
        <h2 id="payment-popup-title" className="text-lg font-bold text-text">
          Payment received
        </h2>
        <p className="mt-2 text-sm text-text">
          {payment.adopterName} has completed payment for {payment.animalName}. Please confirm.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            ref={confirmRef}
            href={`/adoptions/${payment.applicationId}`}
            onClick={close}
            className="inline-flex h-9 items-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            Review and confirm
          </Link>
          <button type="button" onClick={close} className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

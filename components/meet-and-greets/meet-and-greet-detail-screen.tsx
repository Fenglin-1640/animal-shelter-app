"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { confirmAttendance, getMeetAndGreet, selectSlot } from "@/lib/meet-and-greets/store";
import { MEET_AND_GREET_STATUS_CATEGORY } from "@/lib/meet-and-greets/status";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Adopter"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Meet and Greet not found.</p>
      <Link
        href="/my-meet-and-greets"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to My Meet and Greets
      </Link>
    </div>
  );
}

function MeetAndGreetDetailContent({ meetAndGreetId, email }: { meetAndGreetId: string; email: string }) {
  const [meetAndGreet, setMeetAndGreet] = useState<MeetAndGreet | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getMeetAndGreet(meetAndGreetId).then((result) => {
      if (!cancelled) setMeetAndGreet(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [meetAndGreetId]);

  if (meetAndGreet === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!meetAndGreet) return <NotFound />;
  if (meetAndGreet.adopterEmail.toLowerCase() !== email.toLowerCase()) return <AccessDenied />;

  const refresh = async () => setMeetAndGreet((await getMeetAndGreet(meetAndGreetId)) ?? null);

  const handleSelectSlot = async (slotId: string) => {
    await selectSlot(meetAndGreetId, slotId);
    await refresh();
  };

  const handleConfirmAttendance = async () => {
    await confirmAttendance(meetAndGreetId);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/my-meet-and-greets"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to My Meet and Greets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">Meet and Greet with {meetAndGreet.animalName}</h1>
          <StatusChip
            label={meetAndGreet.status}
            category={MEET_AND_GREET_STATUS_CATEGORY[meetAndGreet.status]}
          />
        </div>
        <p className="mt-1 text-sm text-text-muted">{meetAndGreet.meetAndGreetId}</p>
      </div>

      {meetAndGreet.status === "Proposed" && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Choose a Time</h2>
          <p className="mt-1 text-sm text-text-muted">
            Shelter Staff have proposed the following options - select one to confirm.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {meetAndGreet.slotOptions.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 text-sm"
              >
                <span className="text-text">
                  {formatDateTime(slot.dateTime)} &middot; {slot.location}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectSlot(slot.id)}
                  className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90"
                >
                  Select
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(meetAndGreet.status === "Scheduled" ||
        meetAndGreet.status === "Compatible" ||
        meetAndGreet.status === "Incompatible") && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Appointment</h2>
          <p className="mt-2 text-sm text-text">
            {meetAndGreet.scheduledDate ? formatDateTime(meetAndGreet.scheduledDate) : ""}
          </p>
          <p className="text-sm text-text-muted">{meetAndGreet.location}</p>
          <p className="text-sm text-text-muted">{meetAndGreet.participants}</p>

          {meetAndGreet.status === "Scheduled" && (
            <div className="mt-4">
              {meetAndGreet.attendanceConfirmed ? (
                <StatusChip label="Attendance Confirmed" category="success" />
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmAttendance}
                  className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                >
                  Confirm Attendance
                </button>
              )}
            </div>
          )}

          {meetAndGreet.status === "Compatible" && (
            <p className="mt-4 text-sm text-text">
              Great news - this Meet and Greet was marked Compatible. Check My Agreements to
              continue.
            </p>
          )}
          {meetAndGreet.status === "Incompatible" && (
            <p className="mt-4 text-sm text-danger">
              This Meet and Greet was marked Incompatible: {meetAndGreet.outcomeReason}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function MeetAndGreetDetailScreen() {
  const { user } = useAuth();
  const params = useParams<{ meetAndGreetId: string }>();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <MeetAndGreetDetailContent meetAndGreetId={params.meetAndGreetId} email={user.email} />
    </AppShell>
  );
}

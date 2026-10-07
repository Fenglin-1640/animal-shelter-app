"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AccessDenied } from "@/components/access/access-denied";
import { AnimalStatusChips, AnimalThumb, MilestoneList, useTransferProgress } from "@/components/council-transfers/animal-progress";
import { AppShell } from "@/components/layout/app-shell";
import { TransferStatusRail } from "@/components/process/transfer-status";
import { useAuth } from "@/lib/auth/auth-context";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}

// Read-only summary of the animal created from one of the Council
// Officer's own transfers.
function SummaryContent({ transferId }: { transferId: string }) {
  const progress = useTransferProgress(transferId);
  const back = (
    <Link href={`/council-transfers/${encodeURIComponent(transferId)}`} className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline">
      &larr; Back to transfer {transferId}
    </Link>
  );
  if (progress === undefined) {
    return <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">Loading...</div>;
  }
  if (!progress) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <AccessDenied />
      </div>
    );
  }
  const animal = progress.animal;
  return (
    <div className="flex flex-col gap-6">
      <div>
        {back}
        <h1 className="mt-2 text-2xl font-bold text-text">{animal ? animal.name : "Animal"}</h1>
        <p className="mt-1 text-sm text-text-muted">From your transfer {transferId} &middot; {progress.transfer.foundLocation}</p>
      </div>
      {!animal ? (
        <section className="rounded-[12px] border border-border bg-surface p-6 text-sm text-text-muted">Awaiting intake by the shelter.</section>
      ) : (
        <>
          <section className="flex flex-wrap gap-6 rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <AnimalThumb animal={animal} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <AnimalStatusChips animal={animal} />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name" value={animal.name} />
                <Field label="Shelter ID" value={animal.shelterId} />
                <Field label="Species" value={animal.species} />
                <Field label="Breed" value={animal.breed} />
              </dl>
            </div>
          </section>
          <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <h2 className="text-lg font-bold text-text">Progress</h2>
            <MilestoneList progress={progress} />
          </section>
        </>
      )}
    </div>
  );
}

export function CouncilAnimalSummaryScreen() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  if (!user) return null;
  if (user.role !== "Council Animal Control Officer") {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }
  return (
    <AppShell rightPanel={<TransferStatusRail transferId={params.id} />}>
      <SummaryContent transferId={params.id} />
    </AppShell>
  );
}

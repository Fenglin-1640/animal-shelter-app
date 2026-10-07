import Link from "next/link";
import { AnimalThumb } from "@/components/council-transfers/animal-progress";
import { StatusChip } from "@/components/shared/status-chip";
import { CURRENT_STATUS_CATEGORY } from "@/lib/animals/status";
import { animalStatusLabel, type TransferAnimalSummary } from "@/lib/council-transfers/progress";
import { TRANSFER_STATUS_CATEGORY } from "@/lib/council-transfers/status";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import { TransferStatusSummary, type TransferStep } from "@/components/process/transfer-status";
import { formatDate } from "@/lib/shared/dates";

export function TransferCard({
  transfer,
  statusSteps,
  animal,
}: {
  transfer: CouncilTransferSubmission;
  statusSteps?: TransferStep[];
  // The animal created from this transfer (null: not admitted yet).
  animal?: TransferAnimalSummary | null;
}) {
  const isDraft = transfer.status === "Draft";

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text">
              {transfer.foundLocation || "(No location recorded)"}
            </h3>
            <p className="text-xs text-text-muted">{transfer.id}</p>
          </div>
          <StatusChip
            label={transfer.status}
            category={TRANSFER_STATUS_CATEGORY[transfer.status]}
          />
        </div>
        <p className="text-sm text-text">
          {transfer.animalDescription || "No animal description yet."}
        </p>
        <p className="text-sm text-text-muted">
          {transfer.submissionDate
            ? `Submitted ${formatDate(transfer.submissionDate)}`
            : `Last saved ${formatDate(transfer.updatedAt)}`}
          {" · "}
          {transfer.attachments.length} attachment
          {transfer.attachments.length === 1 ? "" : "s"}
        </p>
        {statusSteps && <TransferStatusSummary steps={statusSteps} />}
        {animal ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-border bg-page p-2">
            <AnimalThumb animal={animal} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{animal.name}</p>
              <p className="text-xs text-text-muted">Shelter ID {animal.shelterId}</p>
            </div>
            <StatusChip label={animalStatusLabel(animal.currentStatus)} category={CURRENT_STATUS_CATEGORY[animal.currentStatus]} />
          </div>
        ) : (
          !isDraft && animal === null && <p className="text-sm text-text-muted">Awaiting intake by the shelter</p>
        )}
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/council-transfers/${transfer.id}`}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          {isDraft ? "Continue Editing" : "View"}
        </Link>
      </div>
    </article>
  );
}

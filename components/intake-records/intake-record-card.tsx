import Link from "next/link";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { INTAKE_COMPLETENESS_CATEGORY } from "@/lib/intake-records/status";
import { isIntakeRecordComplete, type IntakeRecord } from "@/lib/intake-records/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function IntakeRecordCard({ record }: { record: IntakeRecord }) {
  const complete = isIntakeRecordComplete(record);
  const finalised = Boolean(record.finalisedAt);

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={record.species || "animal"} className="sm:w-32" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text">
              {record.animalName || record.species || "Species not yet recorded"}
              {record.sex ? ` · ${record.sex}` : ""}
            </h3>
            <p className="text-xs text-text-muted">
              {record.intakeId} &middot; Animal ID {record.animalId}
            </p>
          </div>
          <StatusChip
            label={finalised ? "Finalised" : complete ? "Complete" : "Incomplete"}
            category={
              finalised
                ? "complete"
                : INTAKE_COMPLETENESS_CATEGORY[complete ? "Complete" : "Incomplete"]
            }
          />
        </div>
        <p className="text-sm text-text-muted">
          {record.intakeSource || "Intake source not yet recorded"}
          {record.councilTransferSubmissionId ? ` (${record.councilTransferSubmissionId})` : ""}
        </p>
        <p className="text-sm text-text">
          {record.arrivalCircumstance || "No arrival circumstance recorded yet."}
        </p>
        <p className="text-sm text-text-muted">
          Created {formatDate(record.createdAt)} by {record.createdByName}
        </p>
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/intake-records/${record.intakeId}`}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          View
        </Link>
      </div>
    </article>
  );
}

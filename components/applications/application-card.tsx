import Link from "next/link";
import { AnimalThumbnail } from "@/components/shared/animal-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication } from "@/lib/applications/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function actionLabel(status: AdoptionApplication["applicationStatus"]): string {
  return status === "Draft" ? "Continue Application" : "View Application";
}

export function ApplicationCard({ application }: { application: AdoptionApplication }) {
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <AnimalThumbnail animalId={application.animalId} species={application.animalSpecies} className="w-full sm:w-32" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text">{application.animalName}</h3>
            <p className="text-xs text-text-muted">{application.applicationId}</p>
          </div>
          <StatusChip
            label={application.applicationStatus}
            category={APPLICATION_STATUS_CATEGORY[application.applicationStatus]}
          />
        </div>
        <p className="text-sm text-text-muted">
          {application.animalSpecies} &middot; {application.animalBreed}
        </p>
        <p className="text-sm text-text-muted">
          {application.submissionDate
            ? `Submitted ${formatDate(application.submissionDate)}`
            : "Not yet submitted"}
          {application.decisionDate ? ` · Decided ${formatDate(application.decisionDate)}` : ""}
        </p>
        {application.applicationStatus === "Rejected" && application.rejectionReason && (
          <p className="text-sm text-danger">{application.rejectionReason}</p>
        )}
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/my-applications/${application.applicationId}`}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          {actionLabel(application.applicationStatus)}
        </Link>
      </div>
    </article>
  );
}

import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdopterApplication } from "@/lib/applications/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function primaryAction(status: AdopterApplication["applicationStatus"]): {
  label: string;
  disabledReason: string;
} {
  switch (status) {
    case "Draft":
      return {
        label: "Continue Application",
        disabledReason: "Adoption Application editing is not built yet",
      };
    case "Approved":
      return {
        label: "Schedule Meet and Greet",
        disabledReason: "Meet and Greet scheduling is not built yet",
      };
    case "Finalised":
      return {
        label: "View Agreement",
        disabledReason: "Adoption Agreement pages are not built yet",
      };
    default:
      return {
        label: "View Details",
        disabledReason: "Application detail pages are not built yet",
      };
  }
}

export function ApplicationCard({ application }: { application: AdopterApplication }) {
  const action = primaryAction(application.applicationStatus);

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={application.animalSpecies} className="sm:w-32" />

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
        {application.nextStep && <p className="text-sm text-text">{application.nextStep}</p>}
      </div>

      <div className="flex items-start sm:items-center">
        <button
          type="button"
          disabled
          title={action.disabledReason}
          className="h-9 whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.label}
        </button>
      </div>
    </article>
  );
}

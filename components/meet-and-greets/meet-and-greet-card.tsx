import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { MEET_AND_GREET_STATUS_CATEGORY } from "@/lib/meet-and-greets/status";
import type { AdopterMeetAndGreet } from "@/lib/meet-and-greets/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function primaryAction(status: AdopterMeetAndGreet["status"]): {
  label: string;
  disabledReason: string;
} {
  if (status === "Scheduled") {
    return {
      label: "Confirm Attendance",
      disabledReason: "Attendance confirmation is not built yet",
    };
  }
  return {
    label: "View Details",
    disabledReason: "Meet and Greet detail pages are not built yet",
  };
}

export function MeetAndGreetCard({ meetAndGreet }: { meetAndGreet: AdopterMeetAndGreet }) {
  const action = primaryAction(meetAndGreet.status);

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={meetAndGreet.animalSpecies} className="w-full sm:w-32" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text">{meetAndGreet.animalName}</h3>
            <p className="text-xs text-text-muted">{meetAndGreet.meetAndGreetId}</p>
          </div>
          <StatusChip
            label={meetAndGreet.status}
            category={MEET_AND_GREET_STATUS_CATEGORY[meetAndGreet.status]}
          />
        </div>
        <p className="text-sm text-text-muted">{formatDateTime(meetAndGreet.scheduledDate)}</p>
        <p className="text-sm text-text-muted">{meetAndGreet.location}</p>
        <p className="text-sm text-text-muted">{meetAndGreet.participants}</p>
        {meetAndGreet.outcomeNotes && (
          <p className="text-sm text-text">{meetAndGreet.outcomeNotes}</p>
        )}
        {meetAndGreet.nextStep && (
          <p className="text-sm text-text">{meetAndGreet.nextStep}</p>
        )}
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

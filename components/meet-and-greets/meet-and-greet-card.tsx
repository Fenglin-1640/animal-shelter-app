import Link from "next/link";
import { AnimalThumbnail } from "@/components/shared/animal-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { MEET_AND_GREET_STATUS_CATEGORY } from "@/lib/meet-and-greets/status";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function MeetAndGreetCard({ meetAndGreet }: { meetAndGreet: MeetAndGreet }) {
  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <AnimalThumbnail animalId={meetAndGreet.animalId} species={meetAndGreet.animalSpecies} className="w-full sm:w-32" />

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
        <p className="text-sm text-text-muted">
          {meetAndGreet.status === "Proposed"
            ? "Choose from the proposed time slots"
            : meetAndGreet.scheduledDate
              ? formatDateTime(meetAndGreet.scheduledDate)
              : ""}
        </p>
        {meetAndGreet.location && <p className="text-sm text-text-muted">{meetAndGreet.location}</p>}
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/my-meet-and-greets/${meetAndGreet.meetAndGreetId}`}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}

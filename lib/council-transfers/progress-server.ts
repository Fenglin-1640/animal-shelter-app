import type { CurrentStatus, ListingStatus } from "@/lib/animals/types";
import { signedPhotoImageUrl } from "@/lib/auth/server-session";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import type { TransferMilestone, TransferProgress, TransferStep } from "@/lib/council-transfers/progress";
import { db } from "@/lib/db/client";

const PUBLISHED: CurrentStatus[] = ["Available For Adoption", "Application In Progress", "Awaiting Release", "inFollowUpPeriod", "Rehomed"];
const OUTCOMES: Partial<Record<CurrentStatus, string>> = {
  Rehomed: "Rehomed",
  "Reclaimed By Owner": "Reclaimed by owner",
  ReturnedToOwner: "Reclaimed by owner",
  "Unsuitable For Adoption": "Unsuitable for adoption",
  Archived: "Unsuitable for adoption",
};

// Database timestamps as ISO strings (date-only values pass through).
const iso = (value: string | null | undefined) => (value ? (value.length === 10 ? value : new Date(value).toISOString()) : undefined);
const earliest = (dates: (string | null | undefined)[]) =>
  iso(dates.filter((d): d is string => Boolean(d)).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]);

// Progress for a Council Officer's own transfers: the transfer steps, the
// linked animal's whitelisted summary and its milestones. Every table is
// read once for the whole batch (never per transfer), photos as metadata
// only. Callers must pass only transfers the officer submitted.
export async function loadTransferProgress(transfers: CouncilTransferSubmission[]): Promise<Map<string, TransferProgress>> {
  const transferIds = transfers.map((t) => t.id);
  const links = transferIds.length
    ? await db.orm.AnimalTransferLink.select("animalId", "councilTransferId").where((l) => l.councilTransferId.in(transferIds)).all()
    : [];
  const animalIds = links.map((l) => l.animalId);
  const none = Promise.resolve([]);
  const [animals, photos, clearances, applications, visits] = animalIds.length
    ? await Promise.all([
        db.orm.Animal.select("animalId", "name", "species", "breed", "shelterId", "currentStatus", "listingStatus", "statusUpdatedAt", "enteredAt")
          .where((a) => a.animalId.in(animalIds))
          .all(),
        db.orm.Photo.select("id", "animalId", "useOnAdoptionListing", "altText", "uploadedAt").where((p) => p.animalId.in(animalIds)).all(),
        db.orm.MedicalClearance.select("animalId", "issuedAt").where((c) => c.animalId.in(animalIds)).all(),
        // Only the date the adoption was finalised - nothing about the Adopter.
        db.orm.AdoptionApplication.select("animalId", "updatedAt")
          .where((a) => a.animalId.in(animalIds))
          .where({ applicationStatus: "Finalised" })
          .all(),
        db.orm.FollowUpVisit.select("animalId", "releaseDate", "completedAt").where((v) => v.animalId.in(animalIds)).all(),
      ])
    : await Promise.all([none, none, none, none, none]);

  const animalByTransfer = new Map(links.map((l) => [l.councilTransferId, animals.find((a) => a.animalId === l.animalId)]));
  const result = new Map<string, TransferProgress>();
  for (const t of transfers) {
    const a = animalByTransfer.get(t.id);
    const submitted = t.status !== "Draft";
    const received = t.status === "Accepted" || Boolean(a);
    const steps: TransferStep[] = [
      { label: "Submitted", state: submitted ? "done" : "in_progress", detail: submitted ? "Submitted to the shelter" : "Draft - not submitted yet", waitingOn: submitted ? undefined : "Council Officer" },
      {
        label: "Received by shelter",
        state: received ? "done" : submitted ? "waiting" : "not_started",
        detail: received ? "Received by the shelter" : "Waiting for the shelter",
        waitingOn: received || !submitted ? undefined : "Shelter Staff",
      },
    ];
    if (!a) {
      steps.push({ label: "In shelter care", state: received ? "in_progress" : "not_started", detail: received ? "Awaiting intake by the shelter" : "Not admitted yet", waitingOn: received ? "Shelter Staff" : undefined });
      result.set(t.id, { steps, animal: null, milestones: [], outcome: null });
      continue;
    }

    const status = a.currentStatus as CurrentStatus;
    const own = <T extends { animalId: string }>(rows: T[]) => rows.filter((r) => r.animalId === a.animalId);
    const animalPhotos = own(photos).sort((x, y) => y.useOnAdoptionListing - x.useOnAdoptionListing || new Date(x.uploadedAt).getTime() - new Date(y.uploadedAt).getTime());
    const visit = own(visits)[0];
    const adoptedAt = earliest(own(applications).map((x) => x.updatedAt));
    const outcomeLabel = OUTCOMES[status];
    const rehomedAt = status === "Rehomed" ? iso(visit?.completedAt ?? a.statusUpdatedAt) : undefined;
    let milestones: TransferMilestone[] = [
      { key: "received", label: "Received at shelter", reached: true, date: iso(a.enteredAt) },
      { key: "clearance", label: "Medical clearance", reached: own(clearances).length > 0, date: earliest(own(clearances).map((c) => c.issuedAt)) },
      { key: "published", label: "Published for adoption", reached: PUBLISHED.includes(status) || Boolean(adoptedAt) },
      { key: "adopted", label: "Adopted - awaiting release", reached: Boolean(adoptedAt), date: adoptedAt },
      { key: "follow_up", label: "Released - follow-up period", reached: Boolean(visit), date: visit?.releaseDate },
      { key: "rehomed", label: "Rehomed", reached: status === "Rehomed", date: rehomedAt },
    ];
    // An animal that left another way has no adoption milestones ahead.
    if (outcomeLabel && status !== "Rehomed") milestones = milestones.filter((m) => m.reached);
    const outcome = outcomeLabel ? { label: outcomeLabel, date: status === "Rehomed" ? rehomedAt : iso(a.statusUpdatedAt) } : null;

    // The rail continues with the milestones after "Received by shelter".
    const next = milestones.find((m) => !m.reached);
    for (const m of milestones.slice(1)) {
      steps.push({ label: m.label, state: m.reached ? "done" : m === next ? "in_progress" : "not_started", detail: m.reached ? "Reached" : m === next ? "In shelter care" : "Not yet" });
    }
    if (outcome && status !== "Rehomed") steps.push({ label: outcome.label, state: "done", detail: "Outcome" });

    const photo = animalPhotos[0];
    result.set(t.id, {
      steps,
      animal: {
        name: a.name,
        species: a.species,
        breed: a.breed,
        shelterId: a.shelterId,
        currentStatus: status,
        listingStatus: a.listingStatus as ListingStatus,
        thumbnailUrl: photo ? signedPhotoImageUrl(photo.id) : undefined,
        thumbnailAlt: photo?.altText || `Photo of ${a.name}`,
      },
      milestones,
      outcome,
    });
  }
  return result;
}

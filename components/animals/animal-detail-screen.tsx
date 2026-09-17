"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { EmptySubscreen } from "@/components/animals/empty-subscreen";
import { AppShell } from "@/components/layout/app-shell";
import { AttributeChip } from "@/components/shared/attribute-chip";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { Tabs } from "@/components/shared/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { getDisplayAge } from "@/lib/animals/age";
import { getAnimalById, updateAnimal } from "@/lib/animals/animal-store";
import { CURRENT_STATUS_CATEGORY, LISTING_STATUS_CATEGORY } from "@/lib/animals/status";
import { getActiveValues } from "@/lib/system-administration/store";
import type { Animal } from "@/lib/animals/types";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import { listApplicationsForAnimal } from "@/lib/applications/store";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication } from "@/lib/applications/types";
import { archiveUnsuitableAnimal, getActiveBehaviourProgram, listTemperamentAssessments } from "@/lib/behaviour/store";
import { OUTCOME_CATEGORY, PROGRAM_STATUS_CATEGORY } from "@/lib/behaviour/status";
import type { BehaviourProgram, TemperamentAssessment } from "@/lib/behaviour/types";
import { listChecksForApplication } from "@/lib/checks/store";
import type { CheckOutcome, SuitabilityCheck } from "@/lib/checks/types";
import { getLatestFollowUpVisitForAnimal } from "@/lib/follow-up-visits/store";
import { FOLLOW_UP_VISIT_STATUS_CATEGORY } from "@/lib/follow-up-visits/status";
import {
  getDesexingSchedule,
  getLatestPreReleaseCheck,
  getMedicalClearance,
  isFitForRelease,
  listHealthAssessments,
  listVaccinations,
} from "@/lib/medical/store";
import { DESEXING_STATUS_CATEGORY } from "@/lib/medical/status";
import type {
  DesexingSchedule,
  HealthAssessment,
  MedicalClearance,
  PreReleaseCheck,
  VaccinationRecord,
} from "@/lib/medical/types";
import { getPublishBlockers, publishAdoptionProfile, unpublishAdoptionProfile } from "@/lib/adoption-listings/publish";
import { getPrimaryPhoto, listPhotosForAnimal } from "@/lib/photos/store";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function checkOutcomeCategory(outcome: CheckOutcome) {
  if (outcome === "Pass") return "success" as const;
  if (outcome === "Pending") return "neutral" as const;
  return "attention" as const;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}

function InfoGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">{heading}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function AnimalNotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <p className="mt-1 text-sm text-text-muted">
        It may have been archived, or the link is incorrect.
      </p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function AnimalDetailContent({
  animal: initialAnimal,
  role,
  email,
  displayName,
}: {
  animal: Animal;
  role: Role;
  email: string;
  displayName: string;
}) {
  const [animal, setAnimal] = useState(initialAnimal);

  const [showEditAdoption, setShowEditAdoption] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [breedInput, setBreedInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [temperamentSelection, setTemperamentSelection] = useState<Set<string>>(new Set());
  const temperamentOptions = getActiveValues("Temperament");

  const [fitForRelease, setFitForRelease] = useState(false);
  const [publishBlockers, setPublishBlockers] = useState<string[]>([]);
  const [healthAssessments, setHealthAssessments] = useState<HealthAssessment[]>([]);
  const [medicalClearance, setMedicalClearance] = useState<MedicalClearance | undefined>(undefined);
  const [desexing, setDesexing] = useState<DesexingSchedule | undefined>(undefined);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [latestPreReleaseCheck, setLatestPreReleaseCheck] = useState<PreReleaseCheck | undefined>(undefined);
  const [latestBehaviour, setLatestBehaviour] = useState<TemperamentAssessment | undefined>(undefined);
  const [activeProgram, setActiveProgram] = useState<BehaviourProgram | undefined>(undefined);
  const [proposedApplications, setProposedApplications] = useState<AdoptionApplication[]>([]);
  const [checksByApplication, setChecksByApplication] = useState<Record<string, SuitabilityCheck[]>>({});

  useEffect(() => {
    let cancelled = false;
    isFitForRelease(animal.animalId).then((result) => {
      if (!cancelled) setFitForRelease(result);
    });
    getPublishBlockers(animal.animalId).then((result) => {
      if (!cancelled) setPublishBlockers(result);
    });
    listHealthAssessments(animal.animalId).then((result) => {
      if (!cancelled) setHealthAssessments(result);
    });
    getMedicalClearance(animal.animalId).then((result) => {
      if (!cancelled) setMedicalClearance(result);
    });
    getDesexingSchedule(animal.animalId).then((result) => {
      if (!cancelled) setDesexing(result);
    });
    listVaccinations(animal.animalId).then((result) => {
      if (!cancelled) setVaccinations(result);
    });
    getLatestPreReleaseCheck(animal.animalId).then((result) => {
      if (!cancelled) setLatestPreReleaseCheck(result);
    });
    listTemperamentAssessments(animal.animalId).then((result) => {
      if (!cancelled) setLatestBehaviour(result[0]);
    });
    getActiveBehaviourProgram(animal.animalId).then((result) => {
      if (!cancelled) setActiveProgram(result);
    });
    listApplicationsForAnimal(animal.animalId).then(async (applications) => {
      if (cancelled) return;
      const proposed = applications.filter((a) => a.applicationStatus !== "Draft");
      setProposedApplications(proposed);
      const checksEntries = await Promise.all(
        proposed.map(async (a) => [a.applicationId, await listChecksForApplication(a.applicationId)] as const),
      );
      if (!cancelled) setChecksByApplication(Object.fromEntries(checksEntries));
    });
    return () => {
      cancelled = true;
    };
  }, [animal]);

  const handleOpenEditAdoption = () => {
    setFeeInput(animal.adoptionFee?.toString() ?? "");
    setBreedInput(animal.breed === "Unknown" ? "" : animal.breed);
    setDescriptionInput(animal.generalDescription);
    setTemperamentSelection(new Set(animal.temperaments));
    setShowEditAdoption(true);
  };

  const handleSaveAdoptionDetails = async () => {
    const fee = feeInput.trim() ? Number(feeInput) : undefined;
    await updateAnimal(animal.animalId, {
      adoptionFee: fee != null && !Number.isNaN(fee) ? fee : undefined,
      breed: breedInput.trim() || "Unknown",
      generalDescription: descriptionInput,
      temperaments: Array.from(temperamentSelection),
    });
    setAnimal((await getAnimalById(animal.animalId)) ?? animal);
    setShowEditAdoption(false);
  };

  const handleArchive = async () => {
    const result = await archiveUnsuitableAnimal(animal.animalId, email, displayName);
    if (result.ok) setAnimal((await getAnimalById(animal.animalId)) ?? animal);
  };

  const handlePublish = async () => {
    const result = await publishAdoptionProfile(animal.animalId, email, displayName);
    if (result.ok) setAnimal((await getAnimalById(animal.animalId)) ?? animal);
  };

  const handleUnpublish = async () => {
    const result = await unpublishAdoptionProfile(animal.animalId, email, displayName);
    if (result.ok) setAnimal((await getAnimalById(animal.animalId)) ?? animal);
  };

  const photos = listPhotosForAnimal(animal.animalId);
  const followUpVisit = getLatestFollowUpVisitForAnimal(animal.animalId);
  const primaryPhoto = getPrimaryPhoto(animal.animalId);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/animals"
        className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
      >
        &larr; Back to Animals
      </Link>

      <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
        <PlaceholderThumbnail species={animal.species} altText={primaryPhoto?.altText} className="w-full sm:w-48" />

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">{animal.name}</h1>
          <p className="text-sm text-text-muted">{animal.shelterId}</p>
          <p className="mt-1 text-sm text-text-muted">
            {animal.species} &middot; {animal.breed} &middot; {getDisplayAge(animal)}
          </p>
          <p className="mt-2 text-sm text-text">{animal.generalDescription}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusChip
              label={animal.currentStatus}
              category={CURRENT_STATUS_CATEGORY[animal.currentStatus]}
            />
            <StatusChip
              label={`Listing: ${animal.listingStatus}`}
              category={LISTING_STATUS_CATEGORY[animal.listingStatus]}
            />
            <AttributeChip label={animal.species} />
            <AttributeChip label={animal.sex} />
            {animal.temperaments.map((temperament) => (
              <AttributeChip key={temperament} label={temperament} />
            ))}
          </div>
        </div>
      </div>

      <InfoGroup heading="Identity">
        <InfoField label="Animal ID" value={animal.animalId} />
        <InfoField label="Breed" value={animal.breed} />
        <InfoField label="Breed Description" value={animal.breedDescription} />
        <InfoField label="Sex" value={animal.sex} />
        <InfoField
          label="Date of Birth"
          value={animal.dateOfBirth ? formatDate(animal.dateOfBirth) : "Unknown"}
        />
        <InfoField
          label="Estimated Age"
          value={animal.dateOfBirth ? "N/A (date of birth known)" : (animal.estimatedAge ?? "Unknown")}
        />
        <InfoField label="Coat Colour" value={animal.coatColour} />
        <InfoField label="Coat Markings" value={animal.coatMarkings} />
        <InfoField
          label="Microchip Number"
          value={animal.microchipNumber ?? "No chip recorded"}
        />
        {["Administrator", "Shelter Staff Member"].includes(role) && (
          <div className="sm:col-span-2">
            <Link
              href={`/animals/${animal.animalId}/scan-microchip`}
              className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Scan Microchip
            </Link>
          </div>
        )}
      </InfoGroup>

      <InfoGroup heading="Adoption">
        <InfoField
          label="Adoption Fee"
          value={animal.adoptionFee != null ? `$${animal.adoptionFee}` : "Not applicable"}
        />
        <InfoField label="Temperaments" value={animal.temperaments.join(", ")} />
        <InfoField label="Listing Status" value={animal.listingStatus} />
        <InfoField label="Status Updated" value={formatDateTime(animal.statusUpdatedAt)} />
        {animal.linkedPerson && (
          <InfoField label={animal.linkedPerson.role} value={animal.linkedPerson.name} />
        )}
        {["Administrator", "Shelter Staff Member"].includes(role) && !showEditAdoption && (
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleOpenEditAdoption}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Edit Adoption Details
            </button>
          </div>
        )}
        {["Administrator", "Shelter Staff Member"].includes(role) && showEditAdoption && (
          <div className="sm:col-span-2 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
            <p className="text-xs text-text-muted">
              Breed, Adoption Fee, Temperaments and General Description have no dedicated intake
              step (Finalise Intake leaves Breed as &quot;Unknown&quot; and Temperaments/Adoption
              Fee unset) - this is the minimal edit surface needed to fill in FR-LIST-01&apos;s
              Publish prerequisites, not a general Animal Profile editor.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-breed" className="text-xs font-semibold text-text-muted">
                  Breed
                </label>
                <input
                  id="edit-breed"
                  type="text"
                  value={breedInput}
                  onChange={(e) => setBreedInput(e.target.value)}
                  className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-fee" className="text-xs font-semibold text-text-muted">
                  Adoption Fee
                </label>
                <input
                  id="edit-fee"
                  type="number"
                  min="0"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-description" className="text-xs font-semibold text-text-muted">
                General Description
              </label>
              <textarea
                id="edit-description"
                rows={2}
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-muted">Temperaments</span>
              <div className="flex flex-wrap gap-2">
                {temperamentOptions.map((option) => (
                  <label key={option} className="flex items-center gap-1.5 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={temperamentSelection.has(option)}
                      onChange={() =>
                        setTemperamentSelection((prev) => {
                          const next = new Set(prev);
                          if (next.has(option)) next.delete(option);
                          else next.add(option);
                          return next;
                        })
                      }
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveAdoptionDetails}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowEditAdoption(false)}
                className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {["Administrator", "Shelter Staff Member"].includes(role) &&
          animal.listingStatus === "Pre-Listing" && (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishBlockers.length > 0}
                title={
                  publishBlockers.length > 0
                    ? `Not ready to publish: ${publishBlockers.join(" ")}`
                    : undefined
                }
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Publish Adoption Profile
              </button>
              {publishBlockers.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-text-muted">
                  {publishBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        {["Administrator", "Shelter Staff Member"].includes(role) &&
          animal.listingStatus === "Current" && (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleUnpublish}
                className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Withdraw Listing
              </button>
            </div>
          )}
      </InfoGroup>

      <InfoGroup heading="Lifecycle">
        <InfoField label="Current Status" value={animal.currentStatus} />
        <InfoField label="Entered Shelter" value={formatDateTime(animal.enteredAt)} />
        <InfoField label="Last Modified" value={formatDateTime(animal.lastModifiedAt)} />
        <InfoField label="Intake Source" value={animal.intakeSource} />
        {animal.currentStatus === "Under Assessment" && (
          <div className="sm:col-span-2">
            <Link
              href={`/animals/${animal.animalId}/adoption-fitness`}
              className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Review Adoption Fitness
            </Link>
          </div>
        )}
        {["Administrator", "Shelter Staff Member"].includes(role) &&
          (animal.currentStatus === "On Statutory Hold" ||
            animal.currentStatus === "Reclaimed By Owner") && (
            <div className="sm:col-span-2">
              <Link
                href={`/animals/${animal.animalId}/statutory-hold`}
                className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Manage Statutory Hold
              </Link>
            </div>
          )}
        {["Administrator", "Shelter Staff Member"].includes(role) &&
          animal.currentStatus === "Unsuitable For Adoption" && (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleArchive}
                className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Archive Record
              </button>
            </div>
          )}
      </InfoGroup>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <Tabs
          label={`${animal.name}'s records`}
          tabs={[
            {
              id: "photos",
              label: "Photos",
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip
                      label={`${photos.length} Photo${photos.length === 1 ? "" : "s"}`}
                      category={photos.length > 0 ? "success" : "neutral"}
                    />
                    <StatusChip
                      label={primaryPhoto ? "Public Photo Selected" : "No Public Photo Selected"}
                      category={primaryPhoto ? "success" : "neutral"}
                    />
                  </div>
                  <div>
                    <Link
                      href={`/animals/${animal.animalId}/photos`}
                      className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                    >
                      Open Photos
                    </Link>
                  </div>
                </div>
              ),
            },
            {
              id: "medical",
              label: "Medical History",
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip
                      label={`${healthAssessments.length} Health Assessment${healthAssessments.length === 1 ? "" : "s"}`}
                      category={healthAssessments.length > 0 ? "success" : "neutral"}
                    />
                    <StatusChip
                      label={`${vaccinations.length} Vaccination${vaccinations.length === 1 ? "" : "s"}`}
                      category={vaccinations.length > 0 ? "success" : "neutral"}
                    />
                    <StatusChip
                      label={desexing ? `Desexing: ${desexing.status}` : "Desexing Not Scheduled"}
                      category={
                        desexing
                          ? DESEXING_STATUS_CATEGORY[desexing.status]
                          : "neutral"
                      }
                    />
                    <StatusChip
                      label={medicalClearance ? "Medical Clearance Issued" : "Medical Clearance Not Issued"}
                      category={medicalClearance ? "success" : "neutral"}
                    />
                  </div>
                  <div>
                    <Link
                      href={`/animals/${animal.animalId}/medical`}
                      className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                    >
                      Open Medical Record
                    </Link>
                  </div>
                </div>
              ),
            },
            {
              id: "behaviour",
              label: "Behavioural Assessment",
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip
                      label={
                        latestBehaviour
                          ? `Latest outcome: ${latestBehaviour.outcome}`
                          : "No assessment yet"
                      }
                      category={latestBehaviour ? OUTCOME_CATEGORY[latestBehaviour.outcome] : "neutral"}
                    />
                    {activeProgram && (
                      <StatusChip
                        label={`Behaviour Program: ${activeProgram.status}`}
                        category={PROGRAM_STATUS_CATEGORY[activeProgram.status]}
                      />
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/animals/${animal.animalId}/behaviour`}
                      className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                    >
                      Open Behaviour Record
                    </Link>
                  </div>
                </div>
              ),
            },
            ...(animal.currentStatus === "Awaiting Release" ||
            animal.currentStatus === "Under Treatment" ||
            animal.currentStatus === "inFollowUpPeriod" ||
            animal.currentStatus === "Rehomed" ||
            latestPreReleaseCheck
              ? [
                  {
                    id: "pre-release",
                    label: "Pre-Release Check",
                    content: (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusChip
                            label={
                              fitForRelease
                                ? "Fit for Release"
                                : latestPreReleaseCheck
                                  ? latestPreReleaseCheck.fitnessResult
                                  : "Not yet checked"
                            }
                            category={
                              fitForRelease
                                ? "success"
                                : latestPreReleaseCheck?.fitnessResult === "Health Concern"
                                  ? "attention"
                                  : "neutral"
                            }
                          />
                        </div>
                        <div>
                          <Link
                            href={`/animals/${animal.animalId}/pre-release-check`}
                            className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                          >
                            Open Pre-Release Check
                          </Link>
                        </div>
                      </div>
                    ),
                  },
                ]
              : []),
            ...(followUpVisit
              ? [
                  {
                    id: "follow-up-visit",
                    label: "Follow-Up Visit",
                    content: (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusChip
                            label={followUpVisit.status}
                            category={FOLLOW_UP_VISIT_STATUS_CATEGORY[followUpVisit.status]}
                          />
                        </div>
                        <div>
                          <Link
                            href={`/animals/${animal.animalId}/follow-up-visit`}
                            className="inline-flex h-9 items-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                          >
                            Open Follow-Up Visit
                          </Link>
                        </div>
                      </div>
                    ),
                  },
                ]
              : []),
            {
              id: "suitability",
              label: "Proposed Adopter Suitability",
              content:
                proposedApplications.length === 0 ? (
                  <EmptySubscreen description="No adoption applications have been submitted for this animal yet." />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {proposedApplications.map((application) => {
                      const checks = checksByApplication[application.applicationId] ?? [];
                      return (
                        <li
                          key={application.applicationId}
                          className="rounded-[12px] border border-border bg-page p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-text">{application.adopterName}</span>
                            <StatusChip
                              label={application.applicationStatus}
                              category={APPLICATION_STATUS_CATEGORY[application.applicationStatus]}
                            />
                          </div>
                          {application.submissionDate && (
                            <p className="mt-1 text-xs text-text-muted">
                              Submitted {formatDate(application.submissionDate)}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {checks.map((check) => (
                              <StatusChip
                                key={check.checkId}
                                label={`${check.checkType}: ${check.outcome}`}
                                category={checkOutcomeCategory(check.outcome)}
                              />
                            ))}
                          </div>
                          <div className="mt-2">
                            <Link
                              href={`/adoption-applications/${application.applicationId}`}
                              className="text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
                            >
                              Open Application
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ),
            },
          ]}
        />
      </section>
    </div>
  );
}

function AnimalDetailLoader({
  animalId,
  role,
  email,
  displayName,
}: {
  animalId: string;
  role: Role;
  email: string;
  displayName: string;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    evaluatePreListingEligibility(animalId)
      .then(() => getAnimalById(animalId))
      .then((result) => {
        if (!cancelled) setAnimal(result ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading animal...
      </div>
    );
  }

  if (!animal) {
    return <AnimalNotFound />;
  }

  return (
    <AnimalDetailContent
      animal={animal}
      role={role}
      email={email}
      displayName={displayName}
    />
  );
}

export function AnimalDetailScreen() {
  const { user } = useAuth();
  const params = useParams<{ animalId: string }>();
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
      <AnimalDetailLoader
        animalId={params.animalId}
        role={user.role}
        email={user.email}
        displayName={user.displayName}
      />
    </AppShell>
  );
}

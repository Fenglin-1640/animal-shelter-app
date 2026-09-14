"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { EmptySubscreen } from "@/components/animals/empty-subscreen";
import { AppShell } from "@/components/layout/app-shell";
import { AttributeChip } from "@/components/shared/attribute-chip";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { Tabs } from "@/components/shared/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { getDisplayAge } from "@/lib/animals/age";
import { getAnimalById } from "@/lib/animals/animal-store";
import { CURRENT_STATUS_CATEGORY, LISTING_STATUS_CATEGORY } from "@/lib/animals/status";
import type { Animal } from "@/lib/animals/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
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

function AnimalDetailContent({ animal, role }: { animal: Animal; role: Role }) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/animals"
        className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
      >
        &larr; Back to Animals
      </Link>

      <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
        <PlaceholderThumbnail species={animal.species} className="sm:w-48" />

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
      </InfoGroup>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <Tabs
          label={`${animal.name}'s records`}
          tabs={[
            {
              id: "photos",
              label: "Photos",
              content:
                animal.photos && animal.photos.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {animal.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center gap-3 rounded-[12px] border border-border bg-page p-3"
                      >
                        <PlaceholderThumbnail species={animal.species} className="w-20" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">{photo.fileName}</p>
                          <p className="text-xs text-text-muted">{photo.fileSizeKB} KB</p>
                          <p className="text-xs text-text-muted">
                            Uploaded {formatDateTime(photo.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <p className="col-span-full text-xs text-text-muted">
                      Photo metadata only is stored in this prototype; no file content is uploaded to a
                      server. Full photo management (captions, selecting the public listing photo) is not
                      built yet.
                    </p>
                  </div>
                ) : (
                  <EmptySubscreen
                    description="No photos uploaded yet. Photo management will be available once Animal Intake is built."
                    action={{ label: "Upload Photo", disabledReason: "Photo upload is not built yet" }}
                  />
                ),
            },
            {
              id: "medical",
              label: "Medical History",
              content: (
                <EmptySubscreen
                  description="No medical history recorded yet. Medical records will populate once Medical features are built."
                  upcoming={["Health Assessments", "Treatments", "Vaccinations", "Desexing"]}
                />
              ),
            },
            {
              id: "behaviour",
              label: "Behavioural Assessment",
              content: (
                <EmptySubscreen
                  description="No temperament assessments recorded yet. Behaviour records will populate once Behaviour Assessment features are built."
                  upcoming={["Temperament Assessments", "Behaviour Program"]}
                />
              ),
            },
            {
              id: "suitability",
              label: "Proposed Adopter Suitability",
              content: (
                <EmptySubscreen description="No adoption applications have been submitted for this animal yet. Suitability check summaries will appear here once Adoption Applications are built." />
              ),
            },
          ]}
        />
      </section>
    </div>
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

  const animal = getAnimalById(params.animalId);

  return (
    <AppShell>
      {animal ? <AnimalDetailContent animal={animal} role={user.role} /> : <AnimalNotFound />}
    </AppShell>
  );
}

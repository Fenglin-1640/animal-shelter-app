"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { getLatestMicrochipImplant, listLookupsForAnimal, performScan } from "@/lib/microchip/store";
import type { MicrochipImplantTask } from "@/lib/microchip/implant";
import { LOOKUP_RESULT_CATEGORY } from "@/lib/microchip/status";
import type { MicrochipLookup } from "@/lib/microchip/types";
import type { Role } from "@/lib/roles/roles";
import { formatDateTime } from "@/lib/shared/dates";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function ResultMessage({ lookup, implant }: { lookup: MicrochipLookup; implant: MicrochipImplantTask | undefined }) {
  if (lookup.result === "Timeout") {
    return (
      <p className="text-sm text-text">
        The National Pet Registry did not respond in time. The attempt was recorded - use Retry
        to try again.
      </p>
    );
  }
  if (lookup.result === "No Chip") {
    return (
      <div className="flex flex-col gap-1 text-sm text-text">
        <p>No chip was found - recorded as No Chip.</p>
        {implant?.status === "Pending" ? (
          <p>
            Microchip number <span className="font-mono font-semibold">{implant.assignedNumber}</span> has been assigned
            and a Veterinarian has been asked to implant it.{" "}
            <Link href={`/animals/${lookup.animalId}/microchip-implant`} className="font-semibold text-secondary underline underline-offset-2 hover:no-underline">
              View implant task
            </Link>
          </p>
        ) : implant?.status === "Completed" ? (
          <p>Microchip {implant.assignedNumber} has since been implanted.</p>
        ) : null}
      </div>
    );
  }
  if (lookup.result === "No Match") {
    return (
      <p className="text-sm text-text">
        No registered owner was found for this microchip number.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-sm text-text">
      <p>A registered owner was found:</p>
      <p className="font-semibold">{lookup.ownerContact?.name}</p>
      <p className="text-text-muted">{lookup.ownerContact?.phone}</p>
      <p className="text-text-muted">{lookup.ownerContact?.address}</p>
      <p className="mt-1 text-sm text-text">
        A Statutory Hold has been started automatically.{" "}
        <Link
          href={`/animals/${lookup.animalId}/statutory-hold`}
          className="font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          View Statutory Hold
        </Link>
      </p>
    </div>
  );
}

function ScanMicrochipContent({
  animalId,
  email,
  displayName,
}: {
  animalId: string;
  email: string;
  displayName: string;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [lookups, setLookups] = useState<MicrochipLookup[]>([]);
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [implant, setImplant] = useState<MicrochipImplantTask | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then(async (result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (!result) return;
      const [lookupResult, implantResult] = await Promise.all([listLookupsForAnimal(animalId), getLatestMicrochipImplant(animalId)]);
      if (cancelled) return;
      setLookups(lookupResult);
      setImplant(implantResult);
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const lastLookup = lookups[0];

  const handleScan = async () => {
    setIsScanning(true);
    const result = await performScan(animalId, microchipNumber, email, displayName);
    setIsScanning(false);
    if (result.ok) {
      const [lookupResult, animalResult, implantResult] = await Promise.all([
        listLookupsForAnimal(animalId),
        getAnimalById(animalId),
        getLatestMicrochipImplant(animalId),
      ]);
      setLookups(lookupResult);
      setAnimal(animalResult ?? null);
      setImplant(implantResult);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">Scan Microchip</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Current microchip on record: {animal.microchipNumber ?? "No chip recorded"}
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Enter Scanned Number</h2>
        <p className="mt-1 text-sm text-text-muted">
          Enter the microchip number read by the physical scanner. Leave blank if the scanner
          found no chip.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="microchipNumber" className="text-sm font-semibold text-text">
              Microchip Number
            </label>
            <input
              id="microchipNumber"
              type="text"
              inputMode="numeric"
              value={microchipNumber}
              onChange={(e) => setMicrochipNumber(e.target.value)}
              disabled={isScanning}
              placeholder="e.g. 985141000111111"
              className="h-10 w-64 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isScanning
              ? "Contacting National Pet Registry..."
              : lastLookup?.result === "Timeout"
                ? "Retry"
                : "Scan"}
          </button>
        </div>

        {lastLookup && !isScanning && (
          <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-border bg-page p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                label={lastLookup.result}
                category={LOOKUP_RESULT_CATEGORY[lastLookup.result]}
              />
              <span className="text-xs text-text-muted">{formatDateTime(lastLookup.performedAt)}</span>
            </div>
            <ResultMessage lookup={lastLookup} implant={implant} />
          </div>
        )}
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Lookup History</h2>
        {lookups.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No scans have been recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {lookups.map((lookup) => (
              <li
                key={lookup.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-text">
                    {lookup.microchipNumber || "(no number entered)"}
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    &middot; by {lookup.performedByName} &middot; {formatDateTime(lookup.performedAt)}
                  </span>
                </div>
                <StatusChip label={lookup.result} category={LOOKUP_RESULT_CATEGORY[lookup.result]} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ScanMicrochipScreen() {
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
      <ScanMicrochipContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
      />
    </AppShell>
  );
}

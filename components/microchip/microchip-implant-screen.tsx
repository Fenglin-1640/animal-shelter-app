"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { AntibodyOverrideModal } from "@/components/medical/antibody-override-modal";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import {
  getDesexingSchedule,
  listVaccinations,
  recordDesexingExemption,
  recordVaccination,
  scheduleDesexing,
} from "@/lib/medical/store";
import type { DesexingSchedule, VaccinationRecord } from "@/lib/medical/types";
import { completeMicrochipImplant, getLatestMicrochipImplant } from "@/lib/microchip/store";
import type { MicrochipImplantTask } from "@/lib/microchip/implant";
import type { Role } from "@/lib/roles/roles";
import { getActiveValues } from "@/lib/system-administration/store";

// Care team can open the page; only a Veterinarian records the session.
const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

type DesexingChoice = "schedule" | "Exempt (Species)" | "Already Desexed (Pre-Intake)";

const inputClass =
  "h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function Section({ title, done, children }: { title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-text">{title}</h2>
        {done && <StatusChip label="Recorded" category="success" />}
      </div>
      {children}
    </section>
  );
}

function MicrochipImplantContent({ animalId, email, displayName, canAct }: { animalId: string; email: string; displayName: string; canAct: boolean }) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [task, setTask] = useState<MicrochipImplantTask | undefined>(undefined);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [desexing, setDesexing] = useState<DesexingSchedule | undefined>(undefined);
  const [vaccineTypeOptions, setVaccineTypeOptions] = useState<string[]>([]);

  const [implantConfirmed, setImplantConfirmed] = useState(false);
  const [vaccineType, setVaccineType] = useState("");
  const [administrationDate, setAdministrationDate] = useState(todayDate());
  const [doseOrChipId, setDoseOrChipId] = useState("");
  const [nextBoosterDueDate, setNextBoosterDueDate] = useState("");
  const [desexingChoice, setDesexingChoice] = useState<DesexingChoice>("schedule");
  const [scheduledDate, setScheduledDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Antigens a current antibody check already covers, while the Vet is
  // asked whether to vaccinate anyway.
  const [antibodyAntigens, setAntibodyAntigens] = useState<string[] | null>(null);

  const load = async () => {
    const [animalResult, taskResult, vaccinationResult, desexingResult] = await Promise.all([
      getAnimalById(animalId),
      getLatestMicrochipImplant(animalId),
      listVaccinations(animalId),
      getDesexingSchedule(animalId),
    ]);
    return { animalResult, taskResult, vaccinationResult, desexingResult };
  };

  const apply = (r: Awaited<ReturnType<typeof load>>) => {
    setAnimal(r.animalResult ?? null);
    setTask(r.taskResult);
    setVaccinations(r.vaccinationResult);
    setDesexing(r.desexingResult);
  };

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (!cancelled) apply(r);
    });
    getActiveValues("Vaccine Type").then((values) => {
      if (!cancelled) setVaccineTypeOptions(values);
    });
    return () => {
      cancelled = true;
    };
    // load/apply only close over animalId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId]);

  if (animal === undefined) {
    return <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">Loading...</div>;
  }
  if (!animal) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-text">Animal not found.</p>
      </div>
    );
  }

  const pending = task?.status === "Pending";
  const needsVaccination = vaccinations.length === 0;
  const needsDesexing = !desexing;
  const vaccinationReady = !needsVaccination || (vaccineType && administrationDate && doseOrChipId.trim());
  const desexingReady = !needsDesexing || desexingChoice !== "schedule" || Boolean(scheduledDate);
  const canComplete = canAct && pending && implantConfirmed && vaccinationReady && desexingReady && !saving;

  // One session: vaccination and desexing are saved first (each audited),
  // then the implant task completes on the server, which sets the
  // animal's microchip number and completes the Microchip Check task.
  const handleComplete = async (override?: { reason: string; note: string }) => {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      if (needsVaccination) {
        const result = await recordVaccination(
          animalId,
          {
            vaccineType,
            administrationDate,
            doseOrChipId: doseOrChipId.trim(),
            nextBoosterDueDate,
            antibodyOverrideReason: override?.reason,
            antibodyOverrideNote: override?.note,
          },
          email,
          displayName,
        );
        // A current antibody check covers this vaccine: ask first, then
        // run the session again with the chosen reason.
        if (!result.ok && result.reason === "antibodies_present" && "antigens" in result) {
          setAntibodyAntigens(result.antigens);
          return;
        }
        if (!result.ok) throw new Error("The vaccination could not be saved.");
      }
      setAntibodyAntigens(null);
      if (needsDesexing) {
        const result =
          desexingChoice === "schedule"
            ? await scheduleDesexing(animalId, scheduledDate, email, displayName)
            : await recordDesexingExemption(animalId, desexingChoice, email, displayName);
        if (!result.ok) throw new Error("The desexing record could not be saved.");
      }
      const completed = await completeMicrochipImplant(task.id);
      if (!completed.ok) throw new Error("The microchip implant could not be recorded.");
      await evaluatePreListingEligibility(animalId, { email, name: displayName });
      apply(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      apply(await load());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/animals/${animalId}`} className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline">
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">Microchip Implant</h1>
          {task && <StatusChip label={task.status === "Pending" ? "Awaiting implant" : "Implanted"} category={task.status === "Pending" ? "progress" : "success"} />}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId} &middot; {animal.species}
        </p>
      </div>

      {!task ? (
        <p className="rounded-[12px] border border-border bg-surface p-6 text-sm text-text-muted">
          No microchip implant has been requested for {animal.name}. A request is created when Scan Microchip finds no chip.
        </p>
      ) : !pending ? (
        <section role="status" className="rounded-[12px] border border-border bg-surface p-6 text-sm text-text">
          <p className="font-semibold">Microchip {task.assignedNumber} implanted.</p>
          {task.completedAt && (
            <p className="mt-1 text-text-muted">
              Recorded by {task.completedByName} on {formatDateTime(task.completedAt)}. The Microchip Check is complete.
            </p>
          )}
          <Link href={`/animals/${animalId}/medical`} className="mt-3 inline-block font-semibold text-secondary underline underline-offset-2 hover:no-underline">
            Open Medical Record
          </Link>
        </section>
      ) : (
        <>
          <Section title="1. Implant microchip" done={false}>
            <p className="mt-2 text-sm text-text">
              Assigned microchip number: <span className="font-mono text-base font-semibold">{task.assignedNumber}</span>
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Requested by {task.createdByName} on {formatDateTime(task.createdAt)}. Implant a chip carrying exactly this number.
            </p>
            {canAct && (
              <label className="mt-4 flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={implantConfirmed} onChange={(e) => setImplantConfirmed(e.target.checked)} className="h-4 w-4" />
                I have implanted microchip {task.assignedNumber} and scanned it to confirm it reads correctly.
              </label>
            )}
          </Section>

          <Section title="2. Vaccination" done={!needsVaccination}>
            {!needsVaccination ? (
              <p className="mt-2 text-sm text-text-muted">
                Already recorded: {vaccinations[0].vaccineType} on {formatDate(vaccinations[0].administrationDate)}.
              </p>
            ) : canAct ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="imp-vac-type" className="text-xs font-semibold text-text-muted">Vaccine Type</label>
                  <select id="imp-vac-type" value={vaccineType} onChange={(e) => setVaccineType(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {vaccineTypeOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="imp-vac-date" className="text-xs font-semibold text-text-muted">Administration Date</label>
                  <input id="imp-vac-date" type="date" value={administrationDate} max={todayDate()} onChange={(e) => setAdministrationDate(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="imp-vac-dose" className="text-xs font-semibold text-text-muted">Dose or Chip ID</label>
                  <input id="imp-vac-dose" type="text" value={doseOrChipId} onChange={(e) => setDoseOrChipId(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="imp-vac-booster" className="text-xs font-semibold text-text-muted">Next Booster Due Date</label>
                  <input id="imp-vac-booster" type="date" value={nextBoosterDueDate} onChange={(e) => setNextBoosterDueDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Not yet recorded.</p>
            )}
          </Section>

          <Section title="3. Desexing" done={!needsDesexing}>
            {!needsDesexing ? (
              <p className="mt-2 text-sm text-text-muted">
                Already recorded: {desexing.status}
                {desexing.status === "Scheduled" ? ` for ${formatDate(desexing.scheduledDate)}` : ""}.
              </p>
            ) : canAct ? (
              <fieldset className="mt-4 flex flex-col gap-2 text-sm text-text">
                <legend className="sr-only">Desexing</legend>
                <label className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="desexing" checked={desexingChoice === "schedule"} onChange={() => setDesexingChoice("schedule")} />
                  Schedule desexing on
                  <input
                    type="date"
                    aria-label="Desexing date"
                    value={scheduledDate}
                    min={todayDate()}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      setDesexingChoice("schedule");
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="desexing" checked={desexingChoice === "Exempt (Species)"} onChange={() => setDesexingChoice("Exempt (Species)")} />
                  Exempt (Species)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="desexing" checked={desexingChoice === "Already Desexed (Pre-Intake)"} onChange={() => setDesexingChoice("Already Desexed (Pre-Intake)")} />
                  Already Desexed (Pre-Intake)
                </label>
              </fieldset>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Not yet recorded.</p>
            )}
          </Section>

          {antibodyAntigens && (
            <AntibodyOverrideModal
              animalName={animal.name}
              antigens={antibodyAntigens}
              saving={saving}
              onCancel={() => setAntibodyAntigens(null)}
              onConfirm={(reason, note) => void handleComplete({ reason, note })}
            />
          )}

          {error && (
            <p role="alert" className="rounded-[12px] border border-danger bg-danger/10 px-3 py-2 text-sm text-text">
              {error}
            </p>
          )}

          {canAct ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={!canComplete}
                className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Complete implant session"}
              </button>
              <span className="text-xs text-text-muted">Saves the implant, vaccination and desexing together and completes the Microchip Check.</span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Waiting on Veterinarian to implant the microchip.</p>
          )}
        </>
      )}
    </div>
  );
}

export function MicrochipImplantScreen() {
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
      <MicrochipImplantContent animalId={params.animalId} email={user.email} displayName={user.displayName} canAct={user.role === "Veterinarian"} />
    </AppShell>
  );
}

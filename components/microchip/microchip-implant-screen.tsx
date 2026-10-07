"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { VaccinationCheckForm, type VaccinationCheckDraft } from "@/components/medical/vaccination-check-form";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import {
  getDesexingSchedule,
  getVaccineModel,
  listVaccinationChecks,
  listVaccinationTasks,
  recordDesexingExemption,
  recordVaccinationCheck,
  scheduleDesexing,
} from "@/lib/medical/store";
import type { DesexingSchedule } from "@/lib/medical/types";
import type { VaccinationCheck, VaccinationTask } from "@/lib/medical/vaccination-check";
import type { VaccineModel } from "@/lib/medical/vaccine-model";
import { PendingVaccinationsPanel } from "@/components/medical/pending-vaccinations-panel";
import { completeMicrochipImplant, getLatestMicrochipImplant } from "@/lib/microchip/store";
import type { MicrochipImplantTask } from "@/lib/microchip/implant";
import type { Role } from "@/lib/roles/roles";
import { formatDate, formatDateTime, todayISO } from "@/lib/shared/dates";
import { DateField } from "@/components/shared/date-field";

// Care team can open the page; only a Veterinarian records the session.
const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

type DesexingChoice = "schedule" | "Exempt (Species)" | "Already Desexed (Pre-Intake)";

const inputClass =
  "h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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
  const [checks, setChecks] = useState<VaccinationCheck[]>([]);
  const [tasks, setTasks] = useState<VaccinationTask[]>([]);
  const [model, setModel] = useState<VaccineModel | null>(null);
  const [desexing, setDesexing] = useState<DesexingSchedule | undefined>(undefined);

  const [implantConfirmed, setImplantConfirmed] = useState(false);
  const [checkDraft, setCheckDraft] = useState<VaccinationCheckDraft>({ input: null, outcome: "" });
  const [desexingChoice, setDesexingChoice] = useState<DesexingChoice>("schedule");
  const [scheduledDate, setScheduledDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [animalResult, taskResult, checkResult, desexingResult, vaccinationTasks] = await Promise.all([
      getAnimalById(animalId),
      getLatestMicrochipImplant(animalId),
      listVaccinationChecks(animalId),
      getDesexingSchedule(animalId),
      listVaccinationTasks(animalId),
    ]);
    const modelResult = animalResult ? await getVaccineModel(animalResult.species) : null;
    return { animalResult, taskResult, checkResult, desexingResult, vaccinationTasks, modelResult };
  };

  const apply = (r: Awaited<ReturnType<typeof load>>) => {
    setAnimal(r.animalResult ?? null);
    setTask(r.taskResult);
    setChecks(r.checkResult);
    setDesexing(r.desexingResult);
    setTasks(r.vaccinationTasks);
    setModel(r.modelResult);
  };

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (!cancelled) apply(r);
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
  const latestCheck = checks[0];
  const needsCheck = !latestCheck;
  const needsDesexing = !desexing;
  const checkReady = !needsCheck || Boolean(checkDraft.input);
  const desexingReady = !needsDesexing || desexingChoice !== "schedule" || Boolean(scheduledDate);
  const canComplete = canAct && pending && implantConfirmed && checkReady && desexingReady && !saving;

  // One session: the vaccination check (which turns what's missing into
  // pending vaccinations) and desexing are saved first (each audited), then
  // the implant task completes on the server, which sets the animal's
  // microchip number and completes the Microchip Check task.
  const handleComplete = async () => {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      if (needsCheck && checkDraft.input) {
        const result = await recordVaccinationCheck(animalId, checkDraft.input);
        if (!result.ok) throw new Error(result.message ?? "The vaccination check could not be saved.");
      }
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
        <section className="rounded-[12px] border border-border bg-surface p-6 text-sm text-text">
          <p role="status" className="font-semibold">Microchip {task.assignedNumber} implanted.</p>
          {task.completedAt && (
            <p className="mt-1 text-text-muted">
              Recorded by {task.completedByName} on {formatDateTime(task.completedAt)}. The Microchip Check is complete.
            </p>
          )}
          {latestCheck && <p className="mt-1 text-text-muted">Vaccination check: {latestCheck.outcome}.</p>}
          {model && (
            <PendingVaccinationsPanel animalId={animalId} animalName={animal.name} model={model} tasks={tasks} canAct={canAct} onChanged={() => void load().then(apply)} />
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

          <Section title="2. Vaccination Check" done={!needsCheck}>
            {latestCheck ? (
              <>
                <p className="mt-2 text-sm text-text-muted">
                  Already recorded on {formatDate(latestCheck.checkDate)}: {latestCheck.outcome}.
                </p>
                {model && (
                  <PendingVaccinationsPanel animalId={animalId} animalName={animal.name} model={model} tasks={tasks} canAct={canAct} onChanged={() => void load().then(apply)} />
                )}
              </>
            ) : canAct ? (
              <>
                <p className="mt-1 text-sm text-text-muted">
                  Record what {animal.name} is already covered for. Anything not covered becomes a pending vaccination to give later.
                </p>
                <VaccinationCheckForm animalId={animalId} species={animal.species} mode="embedded" onChange={setCheckDraft} />
              </>
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
                  <DateField
                    aria-label="Desexing date"
                    value={scheduledDate}
                    min={todayISO()}
                    onChange={(value) => {
                      setScheduledDate(value);
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
              <span className="text-xs text-text-muted">
                Saves the implant, vaccination check and desexing together and completes the Microchip Check.
              </span>
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

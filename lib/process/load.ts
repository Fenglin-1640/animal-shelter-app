import { toAssessmentTask, toFitnessReview } from "@/lib/adoption-fitness/serialize";
import { toAdoptionAgreement } from "@/lib/agreements/serialize";
import { toAnimal } from "@/lib/animals/serialize";
import { toAdoptionApplication } from "@/lib/applications/serialize";
import { toTemperamentAssessment } from "@/lib/behaviour/serialize";
import { toSuitabilityCheck } from "@/lib/checks/serialize";
import { db } from "@/lib/db/client";
import { toFollowUpVisit } from "@/lib/follow-up-visits/serialize";
import {
  toDesexingSchedule,
  toHealthAssessment,
  toMedicalClearance,
  toPreReleaseCheck,
  toVaccinationRecord,
} from "@/lib/medical/serialize";
import { toMeetAndGreet } from "@/lib/meet-and-greets/serialize";
import { toMicrochipLookup } from "@/lib/microchip/serialize";
import { toAdoptionPayment } from "@/lib/payments/serialize";
import type { AnimalRecords } from "@/lib/process/engine";
import { toStatutoryHold } from "@/lib/statutory-hold/serialize";

// Server-side loader for the process engine: every table it needs is
// read ONCE (all in parallel), then grouped by animal - never a query per
// animal. Photos are read as metadata only (no image data).
//
// animalId narrows every query to one animal (the per-animal tracker);
// without it, every animal is loaded (worklist, lists, badges).
export async function loadAnimalRecords(animalId?: string): Promise<Map<string, AnimalRecords>> {
  const by = animalId ? { animalId } : {};
  const [
    animals,
    tasks,
    lookups,
    vaccinations,
    desexing,
    health,
    clearances,
    temperament,
    fitness,
    holds,
    photos,
    applications,
    meetAndGreets,
    agreements,
    payments,
    preRelease,
    followUps,
    implants,
  ] = await Promise.all([
    db.orm.Animal.where(by).all(),
    db.orm.AssessmentTask.where(by).all(),
    db.orm.MicrochipLookup.where(by).all(),
    db.orm.VaccinationRecord.where(by).all(),
    db.orm.DesexingSchedule.where(by).all(),
    db.orm.HealthAssessment.where(by).all(),
    db.orm.MedicalClearance.where(by).all(),
    db.orm.TemperamentAssessment.where(by).all(),
    db.orm.FitnessReview.where(by).all(),
    db.orm.StatutoryHold.where(by).all(),
    db.orm.Photo.select("animalId", "useOnAdoptionListing").where(by).all(),
    db.orm.AdoptionApplication.where(by).all(),
    db.orm.MeetAndGreet.where(by).all(),
    db.orm.AdoptionAgreement.where(by).all(),
    db.orm.AdoptionPayment.where(by).all(),
    db.orm.PreReleaseCheck.where(by).all(),
    db.orm.FollowUpVisit.where(by).all(),
    db.orm.MicrochipImplantTask.select("animalId", "status", "assignedNumber", "createdAt").where(by).all(),
  ]);
  // Checks hang off applications, not animals.
  const appIds = new Set(applications.map((a) => a.applicationId));
  const checks = animalId
    ? (await Promise.all([...appIds].map((applicationId) => db.orm.SuitabilityCheck.where({ applicationId }).all()))).flat()
    : await db.orm.SuitabilityCheck.where({}).all();

  const group = <R extends { animalId: string }, T>(rows: R[], map: (row: R) => T) => {
    const out = new Map<string, T[]>();
    for (const row of rows) {
      const list = out.get(row.animalId) ?? [];
      list.push(map(row));
      out.set(row.animalId, list);
    }
    return out;
  };
  const g = {
    tasks: group(tasks, toAssessmentTask),
    lookups: group(lookups, toMicrochipLookup),
    vaccinations: group(vaccinations, toVaccinationRecord),
    desexing: group(desexing, toDesexingSchedule),
    health: group(health, toHealthAssessment),
    clearances: group(clearances, toMedicalClearance),
    temperament: group(temperament, toTemperamentAssessment),
    fitness: group(fitness, toFitnessReview),
    holds: group(holds, toStatutoryHold),
    applications: group(applications, toAdoptionApplication),
    meetAndGreets: group(meetAndGreets, toMeetAndGreet),
    agreements: group(agreements, toAdoptionAgreement),
    payments: group(payments, toAdoptionPayment),
    preRelease: group(preRelease, toPreReleaseCheck),
    followUps: group(followUps, toFollowUpVisit),
  };
  // The latest implant task per animal.
  const latestImplant = new Map<string, { status: "Pending" | "Completed"; assignedNumber: string; createdAt: string }>();
  for (const t of implants) {
    const current = latestImplant.get(t.animalId);
    if (!current || new Date(t.createdAt) > new Date(current.createdAt)) {
      latestImplant.set(t.animalId, { status: t.status === "Completed" ? "Completed" : "Pending", assignedNumber: t.assignedNumber, createdAt: t.createdAt });
    }
  }
  const primaryPhoto = new Set(photos.filter((p) => p.useOnAdoptionListing === 1).map((p) => p.animalId));
  const checksByApp = new Map<string, ReturnType<typeof toSuitabilityCheck>[]>();
  for (const c of checks) {
    if (!appIds.has(c.applicationId)) continue;
    const list = checksByApp.get(c.applicationId) ?? [];
    list.push(toSuitabilityCheck(c));
    checksByApp.set(c.applicationId, list);
  }

  const result = new Map<string, AnimalRecords>();
  for (const row of animals) {
    const id = row.animalId;
    const animalApps = g.applications.get(id) ?? [];
    result.set(id, {
      animal: toAnimal(row),
      tasks: g.tasks.get(id) ?? [],
      lookups: g.lookups.get(id) ?? [],
      implant: latestImplant.get(id) ?? null,
      vaccinations: g.vaccinations.get(id) ?? [],
      desexing: g.desexing.get(id)?.[0] ?? null,
      healthAssessments: g.health.get(id) ?? [],
      clearances: g.clearances.get(id) ?? [],
      temperamentAssessments: g.temperament.get(id) ?? [],
      behaviourPrograms: [],
      fitnessReview: g.fitness.get(id)?.[0] ?? null,
      holds: g.holds.get(id) ?? [],
      hasPrimaryPhoto: primaryPhoto.has(id),
      applications: animalApps,
      checks: animalApps.flatMap((a) => checksByApp.get(a.applicationId) ?? []),
      meetAndGreets: g.meetAndGreets.get(id) ?? [],
      agreements: g.agreements.get(id) ?? [],
      payments: g.payments.get(id) ?? [],
      documentCounts: Object.fromEntries(animalApps.map((a) => [a.applicationId, a.documents.length])),
      preReleaseChecks: g.preRelease.get(id) ?? [],
      followUpVisits: g.followUps.get(id) ?? [],
    });
  }
  return result;
}

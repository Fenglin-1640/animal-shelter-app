"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ProcessRail } from "@/components/process/process-rail";
import { toRailSteps, type TrackerStep } from "@/components/process/process-tracker";
import { getIntakeRecord } from "@/lib/intake-records/store";
import { useWorklist } from "@/lib/process/worklist-client";
import { getJson } from "@/lib/shared/http";

// The animal's journey as a rail beside every animal page (Administrator,
// Shelter Staff, Veterinarian). Re-fetched on navigation between the
// animal's pages and whenever the shared worklist refreshes - every 20 s,
// on window focus, and right after an action (refreshWorklist()).
export function AnimalProcessTracker({ animalId }: { animalId: string }) {
  const [steps, setSteps] = useState<TrackerStep[] | null>(null);
  const pathname = usePathname();
  const worklist = useWorklist();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getJson<{ ok?: boolean; steps?: TrackerStep[] }>(`/api/process/animals/${encodeURIComponent(animalId)}`).then((result) => {
        if (!cancelled) setSteps(result.ok !== false && result.steps ? result.steps : []);
      });
    // Start once the browser is idle, so the tracker doesn't compete with
    // the page's own data requests.
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => void load(), { timeout: 800 }) : null;
    const fallback = idle === null ? setTimeout(() => void load(), 200) : null;
    return () => {
      cancelled = true;
      if (idle !== null) window.cancelIdleCallback(idle);
      if (fallback) clearTimeout(fallback);
    };
  }, [animalId, pathname, worklist]);

  if (steps && steps.length === 0) return null;
  return <ProcessRail steps={steps ? toRailSteps(steps) : null} idPrefix={`animal-${animalId}`} />;
}

// The intake record's animal journey (the record page lives outside /animals).
export function IntakeAnimalRail({ intakeId }: { intakeId: string }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getIntakeRecord(intakeId).then((record) => {
      if (!cancelled) setAnimalId(record?.animalId ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [intakeId]);
  return animalId ? <AnimalProcessTracker animalId={animalId} /> : null;
}

"use client";

import { useEffect, useState } from "react";
import { ApplicationJourney, type TrackerStep } from "@/components/process/process-tracker";
import { useWorklist } from "@/lib/process/worklist-client";
import { getJson } from "@/lib/shared/http";

// The Adopter's "application journey": where their application is and who
// it's with, refreshed with the shared worklist (every 20 s and on focus).
export function ApplicationJourneySection({ applicationId }: { applicationId: string }) {
  const [steps, setSteps] = useState<TrackerStep[] | null>(null);
  const worklist = useWorklist();
  useEffect(() => {
    let cancelled = false;
    getJson<{ ok?: boolean; steps?: TrackerStep[] }>(`/api/process/applications/${encodeURIComponent(applicationId)}`).then((result) => {
      if (!cancelled) setSteps(result.ok !== false && result.steps ? result.steps : []);
    });
    return () => {
      cancelled = true;
    };
  }, [applicationId, worklist]);
  if (steps && steps.length === 0) return null;
  return (
    <section aria-labelledby="journey-heading" className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 id="journey-heading" className="mb-3 text-lg font-bold text-text">Application journey</h2>
      {steps ? <ApplicationJourney steps={steps} /> : <p className="text-sm text-text-muted">Loading...</p>}
    </section>
  );
}

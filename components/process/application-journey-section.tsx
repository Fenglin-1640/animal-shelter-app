"use client";

import { useEffect, useState } from "react";
import { ProcessRail } from "@/components/process/process-rail";
import { toAdopterRailSteps, type TrackerStep } from "@/components/process/process-tracker";
import { useWorklist } from "@/lib/process/worklist-client";
import { getJson } from "@/lib/shared/http";

// The Adopter's "application journey" as a rail beside the application:
// where it is and who it's with, refreshed with the shared worklist
// (every 20 s and on focus).
export function ApplicationJourneyRail({ applicationId }: { applicationId: string }) {
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
  return <ProcessRail title="Application journey" steps={steps ? toAdopterRailSteps(steps) : null} idPrefix={`app-${applicationId}`} />;
}

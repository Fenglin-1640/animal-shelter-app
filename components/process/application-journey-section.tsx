"use client";

import { useEffect, useState } from "react";
import { ProcessRail } from "@/components/process/process-rail";
import { toAdopterRailSteps, toRailSteps, type TrackerStep } from "@/components/process/process-tracker";
import { getMeetAndGreet } from "@/lib/meet-and-greets/store";
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

// The same journey for Shelter Staff, Administrators and Veterinarians
// beside the application page, with the role tooltips and a red dot where
// the viewer must act.
export function StaffApplicationRail({ applicationId }: { applicationId: string }) {
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
  return <ProcessRail title="Application" steps={steps ? toRailSteps(steps) : null} idPrefix={`staff-app-${applicationId}`} />;
}

// The Adopter's journey beside a Meet and Greet, found from its application.
export function MeetAndGreetJourneyRail({ meetAndGreetId }: { meetAndGreetId: string }) {
  const [applicationId, setApplicationId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMeetAndGreet(meetAndGreetId).then((mg) => {
      if (!cancelled) setApplicationId(mg?.applicationId ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [meetAndGreetId]);
  return applicationId ? <ApplicationJourneyRail applicationId={applicationId} /> : null;
}

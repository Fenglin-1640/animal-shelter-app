import type { StatusCategory } from "@/lib/shared/status-category";
import type { MeetAndGreetStatus } from "@/lib/meet-and-greets/types";

export const MEET_AND_GREET_STATUS_CATEGORY: Record<MeetAndGreetStatus, StatusCategory> = {
  Proposed: "caution",
  Scheduled: "progress",
  Compatible: "success",
  Incompatible: "attention",
};

// FR-REL-02 / PRD 8.3 FollowUpVisit ("回访类型、日期、责任人和结果").
//
// PRD's opening sentence ("放行时 Staff 确认 care instructions 已提供，并记录
// releaseDate 和 receivingAdopter") describes a Release event that
// immediately, in the same action, creates the FollowUpVisit ("随后...
// 创建 FollowUpVisit"). Rather than modelling Release as a separate
// entity that would only ever have a 1:1 relationship with the
// FollowUpVisit it triggers, this prototype folds the release fields
// directly onto the FollowUpVisit record created at that moment -
// matching the established pattern of not inventing a standalone entity
// when the PRD's own data dictionary (8.3) doesn't list one.
export type FollowUpType = "Phone Call" | "Home Visit";
export type FollowUpVisitStatus = "Scheduled" | "Completed";

// PRD names "welfare outcome" without defining its values (same gap as
// FR-PAY-01's paymentStatus) - invented here and disclosed in the UI.
export type WelfareOutcome = "Settling Well" | "Concerns Noted" | "Unable to Contact Adopter";

export interface FollowUpVisit {
  followUpVisitId: string;
  animalId: string;
  animalName: string;
  applicationId: string;
  adopterEmail: string;
  adopterName: string;
  // Release fields (FR-REL-02 opening sentence)
  careInstructionsProvided: boolean;
  releaseDate: string;
  receivingAdopter: string;
  releasedByEmail: string;
  releasedByName: string;
  // FollowUpVisit fields proper
  targetDate: string;
  followUpType: FollowUpType;
  assignedStaffEmail: string;
  assignedStaffName: string;
  status: FollowUpVisitStatus;
  outcome?: WelfareOutcome;
  outcomeNotes: string;
  completedByEmail?: string;
  completedByName?: string;
  completedAt?: string;
  createdAt: string;
}

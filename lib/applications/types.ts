import type { Species } from "@/lib/animals/types";
import type { AdopterProfile } from "@/lib/adopter-profile/types";

// PRD 8.2 AdoptionApplication.applicationStatus, matching System
// Administration's seeded, systemLocked "Application Status" category
// (lib/system-administration/seed-options.ts) - hardcoded here per the
// established pattern for systemLocked dropdown values.
export type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "On Hold"
  | "Approved"
  | "Rejected"
  | "Finalised";

// "系统提交申请时保存快照，后续修改 Profile 不得改变已提交版本" - a full copy of the
// Adopter's profile at the moment of submission, never touched again
// even if the Adopter later edits their live Profile.
export type AdopterProfileSnapshot = AdopterProfile;

// Metadata only - no real file storage backend, same pattern as Council
// Transfer/Intake/Photo attachments.
export interface ApplicationDocument {
  id: string;
  fileName: string;
  fileSizeKB: number;
  uploadedAt: string;
}

export interface AdoptionApplication {
  applicationId: string;
  adopterEmail: string;
  adopterName: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  animalBreed: string;
  // Locked in at submitApplication() - see prisma/contract.prisma.
  adoptionFee?: number;
  motivationStatement: string;
  documents: ApplicationDocument[];
  profileSnapshot?: AdopterProfileSnapshot;
  applicationStatus: ApplicationStatus;
  submissionDate?: string;
  decisionDate?: string;
  decisionByEmail?: string;
  decisionByName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

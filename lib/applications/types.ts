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

// The application keeps each document's metadata. Files uploaded through
// /api/files (stored: true) have their content stored separately and are
// downloaded through that route; older entries are metadata only.
export interface ApplicationDocument {
  id: string;
  fileName: string;
  fileSizeKB: number;
  uploadedAt: string;
  contentType?: string;
  stored?: boolean;
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
  // Shelter Staff asked the Adopter for more documents or information
  // during review; infoRespondedAt is when the Adopter last uploaded a
  // document after that (see isWaitingOnAdopter()).
  infoRequestMessage?: string;
  infoRequestedAt?: string;
  infoRequestedByName?: string;
  infoRespondedAt?: string;
}

// The application is with the Adopter: Staff asked for more documents or
// information and nothing has been uploaded since.
export function isWaitingOnAdopter(app: Pick<AdoptionApplication, "infoRequestedAt" | "infoRespondedAt" | "applicationStatus">): boolean {
  if (!app.infoRequestedAt) return false;
  if (!["Submitted", "Under Review", "On Hold"].includes(app.applicationStatus)) return false;
  return !app.infoRespondedAt || new Date(app.infoRespondedAt).getTime() < new Date(app.infoRequestedAt).getTime();
}

// The Adopter answered the latest request (uploaded since it was made).
export function hasNewAdopterResponse(app: Pick<AdoptionApplication, "infoRequestedAt" | "infoRespondedAt">): boolean {
  return Boolean(app.infoRequestedAt && app.infoRespondedAt && new Date(app.infoRespondedAt).getTime() >= new Date(app.infoRequestedAt).getTime());
}

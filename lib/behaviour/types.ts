// FR-BEH-01/02.
export type BehaviourOutcome =
  | "Suitable for Adoption"
  | "Requires Behaviour Modification"
  | "Unsuitable for Public Adoption";

export const BEHAVIOUR_OUTCOMES: BehaviourOutcome[] = [
  "Suitable for Adoption",
  "Requires Behaviour Modification",
  "Unsuitable for Public Adoption",
];

// PRD does not define a scale for socialisationScore; a 1-5 integer
// scale is a prototype interpretation, disclosed in the UI.
export interface TemperamentAssessment {
  id: string;
  animalId: string;
  handlingResponse: string;
  reactionToStrangers: string;
  foodBehaviour: string;
  interactionWithOtherAnimals: string;
  socialisationScore: number;
  observations: string;
  recommendations: string;
  assessmentDate: string;
  assessorEmail: string;
  assessorName: string;
  followUpRequired: boolean;
  reassessmentDate?: string;
  outcome: BehaviourOutcome;
  createdAt: string;
  // Set when this assessment is itself a Behaviour Program reassessment,
  // rather than a first-time assessment.
  programReassessmentOf?: string;
}

export type BehaviourProgramStatus =
  | "Active"
  | "Completed - Suitable"
  | "Completed - Permanently Unsuitable";

export interface BehaviourProgram {
  id: string;
  animalId: string;
  triggeringAssessmentId: string;
  status: BehaviourProgramStatus;
  createdAt: string;
  resolvedAt?: string;
}

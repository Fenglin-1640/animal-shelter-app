// Role names and function groupings mirror PRD docs/PRD.md section 5.2 exactly.
export const ROLES = [
  "Administrator",
  "Shelter Staff Member",
  "Veterinarian",
  "Council Animal Control Officer",
  "Adopter",
] as const;

export type Role = (typeof ROLES)[number];

export interface FunctionEntry {
  label: string;
  description: string;
}

export interface RoleFunctions {
  administration: FunctionEntry[];
  user: FunctionEntry[];
}

const staffUserFunctions: FunctionEntry[] = [
  {
    label: "Animal Intake",
    description: "Review council transfers and create formal intake records.",
  },
  {
    label: "Animals",
    description: "View animal profiles, lifecycle status and photos.",
  },
  {
    label: "Behaviour Assessments",
    description: "Record temperament results and behaviour program progress.",
  },
  {
    label: "Adoption Applications",
    description: "Run suitability checks and decide application outcomes.",
  },
  {
    label: "Adoptions",
    description: "Manage agreements, payments and finalisation.",
  },
  {
    label: "Follow Up Visits",
    description: "Track post-release welfare checks.",
  },
];

export const ROLE_FUNCTIONS: Record<Role, RoleFunctions> = {
  Administrator: {
    administration: [
      {
        label: "User Administration",
        description: "Manage user roles, status and account lifecycle.",
      },
      {
        label: "System Administration",
        description: "Maintain dropdown options and system rule configuration.",
      },
      {
        label: "Audit Log",
        description: "Review immutable records of system activity.",
      },
      {
        label: "Retention and Backup Status",
        description: "Check retention policy and backup job status.",
      },
    ],
    user: staffUserFunctions,
  },
  "Shelter Staff Member": {
    administration: [],
    user: staffUserFunctions,
  },
  Veterinarian: {
    administration: [],
    user: [
      {
        label: "Animals",
        description: "View animal profiles, lifecycle status and photos.",
      },
      {
        label: "Medical Work Queue",
        description: "Health assessments, treatment, vaccination and desexing.",
      },
      {
        label: "Pre-Release Checks",
        description: "Confirm animals are fit for release to an adopter.",
      },
    ],
  },
  "Council Animal Control Officer": {
    administration: [],
    user: [
      {
        label: "New Council Transfer",
        description: "Submit a council transfer with supporting documents.",
      },
      {
        label: "My Transfers",
        description: "View the status of transfers you have submitted.",
      },
    ],
  },
  Adopter: {
    administration: [],
    user: [
      {
        label: "Adoption Listings",
        description: "Browse animals currently available for adoption.",
      },
      {
        label: "My Adopter Profile",
        description: "Maintain your household and contact details.",
      },
      {
        label: "My Applications",
        description: "Track the status of your adoption applications.",
      },
      {
        label: "My Meet and Greets",
        description: "View scheduled and past meet and greet visits.",
      },
      {
        label: "My Agreements",
        description: "Review and sign adoption agreements.",
      },
      {
        label: "My Follow Up Visits",
        description: "View welfare check-ins scheduled after your animal is released.",
      },
    ],
  },
};

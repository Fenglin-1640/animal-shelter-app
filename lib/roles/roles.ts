// Role names and function groupings mirror PRD docs/PRD.md section 5.2, with
// two deliberate omissions: PRD 5.2 also lists "Behaviour Assessments" for
// Shelter Staff Member/Administrator and "Medical Work Queue" for
// Veterinarian, but neither ever got a standalone top-level screen built -
// there's no matching route in lib/roles/function-links.ts's FUNCTION_HREFS,
// so both rendered as dead, silently-inert nav items/Landing Screen cards
// (no href, no onClick, no error - just did nothing on click). The
// underlying functionality is fully built and reachable per-animal instead
// (Behavioural Assessment tab at /animals/{animalId}/behaviour, Medical
// History tab at /animals/{animalId}/medical), so these two labels were
// removed rather than left as no-op stubs or built out as redundant
// shelter-wide dashboards.
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
  {
    label: "Archive Search",
    description: "Search Archived animal records (read-only).",
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
        label: "Vet Workbench",
        description: "Microchip implants, vaccinations, desexing and clearances waiting on you.",
      },
      {
        label: "Animals",
        description: "View animal profiles, lifecycle status and photos.",
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

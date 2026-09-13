import type { Role } from "@/lib/roles/roles";

// The 5 demo accounts and shared password from docs/PRD.md section 4.2.
// Prototype only: there is no backend, so credentials live in client code.
export interface DemoAccount {
  email: string;
  password: string;
  role: Role;
  status: "Active" | "Inactive";
  displayName: string;
}

export const DEMO_PASSWORD = "Demo123!";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@asams.demo",
    password: DEMO_PASSWORD,
    role: "Administrator",
    status: "Active",
    displayName: "Administrator Demo",
  },
  {
    email: "staff@asams.demo",
    password: DEMO_PASSWORD,
    role: "Shelter Staff Member",
    status: "Active",
    displayName: "Shelter Staff Demo",
  },
  {
    email: "vet@asams.demo",
    password: DEMO_PASSWORD,
    role: "Veterinarian",
    status: "Active",
    displayName: "Veterinarian Demo",
  },
  {
    email: "council@asams.demo",
    password: DEMO_PASSWORD,
    role: "Council Animal Control Officer",
    status: "Active",
    displayName: "Council Officer Demo",
  },
  {
    email: "adopter@asams.demo",
    password: DEMO_PASSWORD,
    role: "Adopter",
    status: "Active",
    displayName: "Adopter Demo",
  },
];

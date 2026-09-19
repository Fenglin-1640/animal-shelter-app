import type { Role } from "@/lib/roles/roles";

// The 5 demo accounts and shared password from docs/PRD.md section 4.2.
// Real credentials now live in the database (User model, seeded from
// this list by prisma/seed.ts) - this array itself is just the seed
// source and the reference list shown on the Sign In screen.
export interface DemoAccount {
  userId: string;
  email: string;
  password: string;
  role: Role;
  status: "Active" | "Inactive";
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  signUpAt: string;
}

export const DEMO_PASSWORD = "Demo123!";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    userId: "U-DEMO-ADMIN",
    email: "admin@asams.demo",
    password: DEMO_PASSWORD,
    role: "Administrator",
    status: "Active",
    title: "Ms",
    firstName: "Priya",
    lastName: "Sharma",
    phone: "+61 2 5550 1001",
    signUpAt: "2024-01-08T09:00:00.000Z",
  },
  {
    userId: "U-DEMO-STAFF",
    email: "staff@asams.demo",
    password: DEMO_PASSWORD,
    role: "Shelter Staff Member",
    status: "Active",
    title: "Mr",
    firstName: "Daniel",
    lastName: "Lee",
    phone: "+61 2 5550 1002",
    signUpAt: "2024-01-08T09:00:00.000Z",
  },
  {
    userId: "U-DEMO-VET",
    email: "vet@asams.demo",
    password: DEMO_PASSWORD,
    role: "Veterinarian",
    status: "Active",
    title: "Dr",
    firstName: "Sarah",
    lastName: "Nguyen",
    phone: "+61 2 5550 1003",
    signUpAt: "2024-01-08T09:00:00.000Z",
  },
  {
    userId: "U-DEMO-COUNCIL",
    email: "council@asams.demo",
    password: DEMO_PASSWORD,
    role: "Council Animal Control Officer",
    status: "Active",
    title: "Mr",
    firstName: "Marcus",
    lastName: "Chen",
    phone: "+61 2 5550 1004",
    signUpAt: "2024-01-08T09:00:00.000Z",
  },
  {
    userId: "U-DEMO-ADOPTER",
    email: "adopter@asams.demo",
    password: DEMO_PASSWORD,
    role: "Adopter",
    status: "Active",
    title: "Ms",
    firstName: "Jordan",
    lastName: "Taylor",
    phone: "+61 2 5550 1005",
    signUpAt: "2024-01-08T09:00:00.000Z",
  },
];

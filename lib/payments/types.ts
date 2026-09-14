import type { Species } from "@/lib/animals/types";

// FR-PAY-01 / PRD 8.2 AdoptionPayment. paymentStatus values aren't
// PRD-seeded (System Administration's "Payment Method" category covers
// only the method, not a status enum) - a disclosed prototype-scope
// choice: Pending (Adopter has initiated the simulated payment, Staff
// has not yet verified it), Cleared (Staff verified funds received) and
// Failed (Staff marked the attempt unsuccessful, e.g. a declined card).
export type PaymentStatus = "Pending" | "Cleared" | "Failed";

export interface AdoptionPayment {
  paymentId: string;
  agreementId: string;
  applicationId: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  adopterEmail: string;
  adopterName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  paymentStatus: PaymentStatus;
  receiptNumber?: string;
  verifiedByEmail?: string;
  verifiedByName?: string;
  verifiedDate?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

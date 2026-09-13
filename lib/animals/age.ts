import type { Animal } from "@/lib/animals/types";

// FR-AN-01: age is calculated from dateOfBirth when known, never
// hand-maintained; estimatedAge is shown only when the DOB is unknown.
export function getDisplayAge(animal: Pick<Animal, "dateOfBirth" | "estimatedAge">): string {
  if (animal.dateOfBirth) {
    const dob = new Date(animal.dateOfBirth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      years -= 1;
    }
    if (years < 1) {
      const months =
        (now.getFullYear() - dob.getFullYear()) * 12 +
        (now.getMonth() - dob.getMonth());
      return `${Math.max(months, 0)} mo`;
    }
    return `${years} yr${years === 1 ? "" : "s"}`;
  }
  return animal.estimatedAge ?? "Age unknown";
}

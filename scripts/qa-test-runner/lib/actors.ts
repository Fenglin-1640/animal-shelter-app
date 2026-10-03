// Actor identities used across the workflow - matches the Guide sheet's
// "Demo role" table. Store functions take the acting user's email and
// displayName as explicit parameters, and the API routes also require a
// signed-in session with an allowed role - so each step calls
// actAs(actor.email) (lib/fetch-shim.ts) before acting as that role.
export const COUNCIL = { email: "council@asams.demo", name: "Mr Marcus Chen" };
export const STAFF = { email: "staff@asams.demo", name: "Mr Daniel Lee" };
export const VET = { email: "vet@asams.demo", name: "Dr Sarah Nguyen" };
export const ADMIN = { email: "admin@asams.demo", name: "Ms Priya Sharma" };

// Password the adopters phase signs the synthetic Adopter accounts up with
// (the animal workflow signs in with it to act as them).
export const QA_ADOPTER_PASSWORD = "QaTest123!";

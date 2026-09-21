// Actor identities used across the workflow - matches the Guide sheet's
// "Demo role" table. Every store function takes the acting user's email
// and displayName as explicit parameters (see AGENTS.md/session notes:
// there is no session/cookie requirement at the store or API layer), so
// "acting as a role" here just means passing the right identity through.
export const COUNCIL = { email: "council@asams.demo", name: "Mr Marcus Chen" };
export const STAFF = { email: "staff@asams.demo", name: "Mr Daniel Lee" };
export const VET = { email: "vet@asams.demo", name: "Dr Sarah Nguyen" };
export const ADMIN = { email: "admin@asams.demo", name: "Ms Priya Sharma" };

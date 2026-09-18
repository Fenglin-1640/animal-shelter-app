# Prisma 8 in this project

The installed `prisma` CLI (8.0.0-rc.15) is **not** the classic
`schema.prisma` + `PrismaClient` tool. It's Prisma's new "Developer
Platform" CLI, built around a *contract* instead of a schema, and it has
no `prisma generate` / `prisma migrate dev` commands at all - see
`prisma --help`.

## What's different here

- **No `datasource`/`generator` blocks.** `prisma/contract.prisma` is just
  `model` blocks. The database connection lives in `prisma.config.ts`
  instead.
- **`prisma orm init --target`** only offers `postgres` and `mongodb`.
  SQLite isn't wired into the guided wizard, but the `@prisma/orm-sqlite`
  package is real and published - this project uses it directly
  (`prisma.config.ts` + `lib/db/client.ts`), just hand-assembled instead
  of scaffolded.
- **Commands:** `prisma contract emit` (regenerate `contract.json`/
  `contract.d.ts` from `contract.prisma`) and `prisma db update` (apply
  the contract to the live database) replace `migrate dev`/`db push`.
  `npm run db:update` runs both. Both `contract.json`/`contract.d.ts` and
  `migrations/` are committed to git (like a lockfile - see the
  Prisma-authored `prisma-8.md` quick reference this CLI can regenerate
  via `prisma orm init`).
- **Query API is a fluent builder, not classic `PrismaClient` methods:**
  `db.orm.User.create({ ...fields })` (flat fields, no `data:` wrapper),
  `db.orm.User.where({ email }).first()` / `.all()` (there's no top-level
  `findMany()`), `.where({ id }).update({ ...patch })`,
  `.where({ id }).delete()`, and `db.orm.User.upsert({ create, update,
  conflictOn? })` (`conflictOn` defaults to the primary key).
- **The sqlite runtime wants `path`, not a `file:` URL:**
  `sqlite({ contractJson, path: "./prisma/dev.db" })`. `lib/db/client.ts`
  strips the `file:` prefix from `DATABASE_URL` for this reason.
- Primary keys need to be `String @id` (no `@default(autoincrement())`) -
  an `Int @id @default(autoincrement())` column failed `prisma db update`
  against sqlite in this rc build (`MIGRATION.RUNNER_FAILED`). This
  project's ids were already string-based (`U-XXXXXX`, matching the
  pre-database `generateAccountId()` helper), so it wasn't a real
  constraint here.
- **Adding a model requires a full dev server restart, not just a file
  edit.** `lib/db/client.ts` reads `contract.json` once at module load and
  caches the client on `globalThis` so it survives Fast Refresh (the
  classic `globalThis.prisma` trick) - but that means a `next dev`
  process that was already running when you add a model to
  `contract.prisma` keeps querying the *old* contract it loaded at
  startup, even after `npm run db:update` and even after Turbopack
  recompiles the edited route files. Symptom: `TypeError: Cannot read
  properties of undefined (reading 'where')` on `db.orm.<NewModel>`.
  Fix: stop and restart `next dev` after every `contract.prisma` change.
- **The `Boolean` field type isn't supported by this SQL PSL provider.**
  `prisma contract emit` fails with `CONTRACT.SOURCE_LOAD_FAILED` /
  `PSL_UNSUPPORTED_FIELD_TYPE` on any `Boolean` field. Use `Int` (0/1)
  instead and convert in the serializer (see
  `lib/medical/serialize.ts`'s `urgentTreatmentRequired`/
  `furtherTreatmentRequired`).
- **This isn't a Prisma quirk, but bit us because of the async cascade:**
  `if (!someNowAsyncFunction(id))` type-checks cleanly and is always
  `false` - negating a `Promise` object, not its resolved value. `tsc`
  only catches a missed `await` when the Promise is later used somewhere
  its shape doesn't match (assigned to typed state, a property accessed
  on it, etc.) - a bare truthiness check slips through silently. Found
  two real instances this way after the Medical slice (both in
  lib/adoption-listings/{publish,pre-listing}.ts, checking
  `getMedicalClearance()`) - `grep -rn "if (!\(get\|is\|has\|list\)" `
  across the whole repo is a fast way to audit for this after converting
  any store to async.

## Commands

```bash
npm run db:emit     # contract.prisma -> contract.json/contract.d.ts
npm run db:update    # db:emit, then apply the contract to prisma/dev.db
npm run db:seed      # recreate the PRD 4.2 demo accounts + PRD 12.1 seed animals
```

`prisma/dev.db` is gitignored (local dev only, per-checkout).

## Models

- `User` - see lib/auth/, lib/user-administration/.
- `Animal` - see lib/animals/. Mirrored 1:1 from lib/animals/types.ts's
  `Animal` interface; `temperaments` is JSON-encoded, `linkedPerson` is
  flattened into `linkedPersonRole`/`linkedPersonName` columns (see
  lib/animals/serialize.ts).
- `HealthAssessment`, `TreatmentEvent`, `VaccinationRecord`,
  `DesexingSchedule`, `MedicalClearance`, `PreReleaseCheck` - see
  lib/medical/. One model per event kind, mirrored from
  lib/medical/types.ts. System-generated timestamps (`createdAt`,
  `issuedAt`, `completedAt`) are `DateTime`; user-entered/free dates
  (`assessmentDate`, `administrationDate`, etc.) stay `String`, same
  reasoning as Animal's `dateOfBirth`. See lib/medical/serialize.ts.
- `TemperamentAssessment`, `BehaviourProgram` - see lib/behaviour/.
  Mirrored from lib/behaviour/types.ts; `followUpRequired` is Int (0/1),
  same reasoning as Medical's boolean fields. See
  lib/behaviour/serialize.ts.
- `StatutoryHold` - see lib/statutory-hold/. Mirrored from
  lib/statutory-hold/types.ts; `ownerContact` is flattened into 3
  columns, same reasoning as Animal's `linkedPerson`. Every date field
  is system-generated (all `DateTime`) - unlike Medical/Behaviour, there
  are no user-entered dates here. See lib/statutory-hold/serialize.ts.
- `AdoptionApplication` - see lib/applications/. Mirrored from
  lib/applications/types.ts; `documents` (array) and `profileSnapshot`
  (a whole nested object, read/written wholesale, never queried
  field-by-field) are both JSON-encoded into single `String` columns -
  unlike the flattened-column treatment given to Animal's
  `linkedPerson`/StatutoryHold's `ownerContact`, which are small and
  fixed-shape enough to be worth individual columns. See
  lib/applications/serialize.ts.
- `SuitabilityCheck` - see lib/checks/. Mirrored from
  lib/checks/types.ts; one row per check per application (3 per
  application, auto-created on submission).
- `MeetAndGreet` - see lib/meet-and-greets/. Mirrored from
  lib/meet-and-greets/types.ts; `slotOptions` (array of small
  {id, dateTime, location} objects, always read/written as a whole) is
  JSON-encoded, same reasoning as AdoptionApplication.documents.
  `scheduledDate` stays a plain String, not DateTime - it's copied
  verbatim from whichever slotOptions entry the Adopter picks, and
  those are themselves user-entered datetime-local strings, same
  reasoning as Medical/Behaviour's user-entered date fields.
  `attendanceConfirmed` is Int (0/1), same reasoning as
  HealthAssessment's boolean fields. See
  lib/meet-and-greets/serialize.ts.
- `AdoptionAgreement`, `AdoptionPayment` - see lib/agreements/,
  lib/payments/. Mirrored from lib/agreements/types.ts and
  lib/payments/types.ts; neither has any nested objects or arrays (no
  JSON-encoded columns, unlike MeetAndGreet/AdoptionApplication), so
  every field is a plain column. `isSigned` is Int (0/1), same
  reasoning as MeetAndGreet's attendanceConfirmed.
  generatedAt/signedDate/paymentDate/verifiedDate are all
  system-generated timestamps (set to `now` when the action happens),
  so all are DateTime. See lib/agreements/serialize.ts and
  lib/payments/serialize.ts.
- `FollowUpVisit` - see lib/follow-up-visits/. Mirrored from
  lib/follow-up-visits/types.ts; no nested objects/arrays, same
  "every field a plain column" shape as AdoptionAgreement/
  AdoptionPayment. releaseDate/targetDate stay plain Strings - both
  are user-entered values from a date-picker input, same reasoning as
  Medical/Behaviour's user-entered date fields.
  careInstructionsProvided is Int (0/1), same reasoning as
  AdoptionAgreement's isSigned. completedAt is a system-generated
  timestamp (set to `now` when the visit is completed), so it's
  DateTime. See lib/follow-up-visits/serialize.ts.
- `CouncilTransferSubmission` - see lib/council-transfers/. Mirrored
  from lib/council-transfers/types.ts; `attachments` (array of small
  {id, documentType, fileName, fileSizeKB, uploadedAt} objects, always
  read/written as a whole) is JSON-encoded, same reasoning as
  AdoptionApplication.documents. `submissionDate` is a
  system-generated timestamp (set to `now` when submitted), so it's
  DateTime. See lib/council-transfers/serialize.ts.
- `IntakeRecord` - see lib/intake-records/. Mirrored from
  lib/intake-records/types.ts; `photos` is JSON-encoded, same
  reasoning as CouncilTransferSubmission.attachments.
  `registeredOwnerContact` is flattened into 3 columns, same "one
  small object" reasoning as Animal.linkedPerson. `arrivalDateTime`
  stays a plain String, not DateTime - it's a user-entered value from
  a datetime-local input, same reasoning as MeetAndGreet.scheduledDate.
  `finalisedAt` is a system-generated timestamp (set to `now` when
  Finalise Intake runs), so it's DateTime. See
  lib/intake-records/serialize.ts.
- `Photo` - see lib/photos/. Mirrored from lib/photos/types.ts.
  `dateTaken` stays a plain String, not DateTime - it's a user-entered
  value from a date-picker input, same reasoning as Medical/
  Behaviour's user-entered date fields. `useOnAdoptionListing` is Int
  (0/1), same reasoning as AdoptionAgreement's isSigned. First model
  in this migration whose store needs a real delete
  (`db.orm.Photo.where({ id }).delete()`) - see
  app/api/photos/[id]/route.ts's DELETE handler. See
  lib/photos/serialize.ts.
- `AdopterProfile` - see lib/adopter-profile/. Mirrored from
  lib/adopter-profile/types.ts. Keyed by the account's email
  (lowercased) rather than a generated id - there is exactly one
  profile per Adopter. `preferredSpecies` is JSON-encoded, same
  reasoning as AdoptionApplication.documents.
  `landlordPermission`/`hasExistingPets`/`refereeConsent` are Int
  (0/1), same reasoning as AdoptionAgreement's isSigned.
  `refereeConsentAt` is a system-generated timestamp (set to `now` the
  moment consent is first given), so it's DateTime, unlike every other
  field here which is free-editable text from the Adopter's own form.
  The demo Adopter's seed profile moved from a runtime
  `SEED_PROFILES` fallback in lib/adopter-profile/store.ts into
  prisma/seed.ts (`npm run db:seed`), matching how Users/Animals are
  seeded - any other Adopter with no saved row yet still falls back to
  `EMPTY_ADOPTER_PROFILE` at read time, since (unlike Users/Animals)
  not every Adopter account has a profile row pre-provisioned. See
  lib/adopter-profile/serialize.ts.
- `AuditLogEntry` - see lib/audit/. Mirrored from lib/audit/types.ts.
  Every field a plain column, same shape as AdoptionAgreement/
  AdoptionPayment. `timestamp` is a system-generated timestamp (set to
  `now` the moment the entry is written), so it's DateTime.
  Immutability (BR-013's "应用界面不提供修改或删除 AuditLog 的功能") is enforced
  the same way it always was, before or after this migration:
  `app/api/audit-log/route.ts` has no PATCH/DELETE handler, and
  `lib/audit/store.ts` exposes only a write and two read functions -
  nothing in the database layer itself is what makes this table
  append-only, the API surface is. Initially left off this migration
  under a mistaken "stays local by design" label, conflating
  BR-013's immutability requirement (no edit/delete exposed) with a
  storage-location decision the PRD never actually made - corrected
  once questioned, since a shared audit trail is precisely the kind of
  data this migration exists to centralize. See lib/audit/serialize.ts.
- `DropdownOption` - see lib/system-administration/. Mirrored from
  lib/system-administration/types.ts (FR-SA-01). Every field a plain
  column - `speciesId` is a small enum-like string, not worth its own
  JSON encoding or relation. `isRetired`/`systemLocked` are Int (0/1),
  same reasoning as AdoptionAgreement's isSigned. The ~116 PRD-seeded
  options (lib/system-administration/seed-options.ts) are seeded via
  `npm run db:seed`, not a runtime localStorage-empty fallback - same
  precedent as Users/Animals/AdopterProfile. See
  lib/system-administration/serialize.ts.
- `SystemSettings` - see lib/system-administration/settings-store.ts.
  Mirrored from lib/system-administration/settings-types.ts (FR-SA-02).
  A singleton row (`id` is always the literal `"system-settings"`,
  matching the `entityId` every writeAuditLog call for this domain
  already used) - there is exactly one rule-configuration record for
  the whole shelter, unlike DropdownOption's many-rows-per-category
  shape. `allowedAttachmentTypes` (a small array of strings) is
  JSON-encoded, same reasoning as AdoptionApplication.documents.
- `MicrochipLookup` - see lib/microchip/. Mirrored from
  lib/microchip/types.ts (FR-MC-01). Immutable ("不可删除" - never edited
  or deleted once created) - no PATCH/DELETE route, no update/delete
  export, same pattern as AuditLogEntry. `ownerContact` is flattened
  into 3 columns, same reasoning as Animal.linkedPerson.
  `performedAt` is a system-generated timestamp, so it's DateTime.
- Still not the last domain: `lib/adoption-fitness/store.ts`
  (AssessmentTask/FitnessReview) still reads/writes localStorage for
  real (confirmed by grepping for `localStorage.`, not just a comment
  mentioning the word, immediately before writing this note - see the
  AdopterProfile/AuditLog entry above about not repeating a "this is
  the last one" claim without checking each time).
  `lib/notifications/read-state-store.ts` (per-user notification
  read/unread flags) is the same shape and a plausible next candidate,
  but is arguably closer to a per-device UI preference than shared
  domain data - worth a judgment call, not an automatic migration.
  `lib/auth/auth-context.tsx` (session token) and
  `lib/theme/theme-context.tsx` (light/dark preference) are genuinely
  per-device/session state and out of scope on their own terms, not by
  oversight.

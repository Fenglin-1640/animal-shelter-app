# Prisma 8 in this project

The installed `prisma` CLI (8.0.0-rc.15) is **not** the classic
`schema.prisma` + `PrismaClient` tool. It's Prisma's new "Developer
Platform" CLI, built around a *contract* instead of a schema, and it has
no `prisma generate` / `prisma migrate dev` commands at all - see
`prisma --help`.

## Migration status: complete

The localStorage -> Prisma/SQLite migration is done. Every domain-data
store listed under Models below now lives in the database; there is no
remaining feature data still read from or written to localStorage.
`lib/auth/auth-context.tsx` (sessionStorage session token) and
`lib/theme/theme-context.tsx` (localStorage theme preference) are the
only `localStorage`/`sessionStorage` usages left in the codebase, and
both are genuinely per-device/session state rather than shared domain
data, so they are correctly out of scope, not oversights.

**Database target: Neon Postgres, not SQLite.** The project moved off
`prisma/dev.db` to a Neon Postgres database (`DATABASE_URL` in
`.env.development.local`, gitignored). `prisma.config.ts` and
`lib/db/client.ts` now use `@prisma/orm-postgres`, not
`@prisma/orm-sqlite` - the sqlite-specific notes below are kept for
history/contrast but no longer describe this project's actual setup.
See "Postgres-specific gotchas" below for what changed.

Verified with a final full-app regression pass across all 5 roles
(Administrator, Shelter Staff Member, Veterinarian, Council Animal
Control Officer, Adopter) and every route in the app: `tsc --noEmit`
and `eslint .` clean, zero server errors and zero 404s. The one issue
that pass turned up - stale "localStorage data" copy on the Retention
and Backup Status export screen, left over from before the migration -
has been fixed.

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

## Postgres-specific gotchas

- **`DateTime` columns are `Temporal`-backed by default, and this
  Node version has no global `Temporal`.** On the `postgres` target,
  `DateTime` compiles to a native `timestamptz` codec that reads/writes
  `Temporal.Instant` (not `Date`, not a string) and throws
  `RUNTIME.TEMPORAL_UNAVAILABLE` on first use without a polyfill. Rather
  than convert every read/write site to `Temporal.Instant` and every
  serializer to call `.toString()`, every `DateTime` field in
  `contract.prisma` is authored as `TimestamptzString(6)` instead - a
  branded-string codec that reads/writes PostgreSQL's own text directly,
  matching what every store/serializer in this codebase already assumed
  (`Date`-typed row fields, `.toISOString()` in, plain ISO strings out).
  `lib/db/temporal.ts`'s `toTimestamptz()` casts a plain `string` to the
  branded type at every `db.orm.<Model>.create()`/`.update()` call site
  that writes one of these columns - required because the brand isn't
  structurally satisfied by a bare `string`, unlike the read side (a
  branded string widens to `string` with no cast needed, so
  `*Row` interfaces just declare these fields as `string`).
- **`db.orm.<Model>` is namespaced on Postgres, unlike SQLite.**
  SQLite's contract declares one synthetic `__unbound__` namespace,
  which `@prisma/orm-sqlite` flattens onto `.orm` directly
  (`db.orm.Animal`). Postgres has real schemas, so the contract declares
  an actual `public` namespace and `@prisma/orm-postgres`'s `.orm` stays
  namespaced (`client.orm.public.Animal`) - every store in this codebase
  was written against the flat shape, so `lib/db/client.ts` re-derives
  `db.orm` as `client.orm.public` once instead of touching every call
  site.
- **Changing a `DateTime`-family column's codec (e.g. Temporal ->
  TimestamptzString) via `prisma db update` can fail at postcheck even
  when the underlying native SQL type is already correct** - seen
  consistently in this rc build even after matching the target
  precision to what was already on disk. On an empty/dev database, the
  reliable fix is `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
  (via a one-off script using `pg` directly) so the next `db update`
  plans pure `CREATE TABLE`, not `ALTER TYPE`.
- **This CLI's `prisma.config.ts` (`dotenv/config`) only loads `.env`,
  not `.env.development.local`/`.env.local`** - Next.js's own
  convention, which only `next dev`/`next build` apply automatically.
  Both `prisma.config.ts` and `lib/db/client.ts` (the latter for plain
  `tsx` scripts like `prisma/seed.ts` and the QA runner, which import
  `lib/db/client.ts` directly, bypassing Next.js entirely) load
  `.env.development.local`, `.env.local`, then `.env` explicitly, in
  that precedence order, via `dotenv`'s `path` array.

## Commands

```bash
npm run db:emit     # contract.prisma -> contract.json/contract.d.ts
npm run db:update    # db:emit, then apply the contract to the DATABASE_URL database
npm run db:seed      # recreate the PRD 4.2 demo accounts + PRD 12.1 seed animals
```

`DATABASE_URL` (the Neon Postgres connection string) lives in
`.env.development.local`, gitignored (per-checkout, not shared).

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
  fixed-shape enough to be worth individual columns. `adoptionFee`
  (nullable) is the Animal's fee locked in at submission - what
  AdoptionPayment charges. See lib/applications/serialize.ts.
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
  Finalise Intake runs), so it's DateTime. `breed`, `adoptionFee`,
  `temperaments` (JSON-encoded) and `generalDescription` are captured
  at intake and copied onto the Animal by Finalise Intake; all four are
  nullable so intake records created before they existed stay valid.
  See lib/intake-records/serialize.ts.
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
- `AssessmentTask` - see lib/adoption-fitness/. Mirrored from
  lib/adoption-fitness/types.ts (FR-INT-04). `markedAt` is a
  system-generated timestamp, so it's DateTime.
- `FitnessReview` - see lib/adoption-fitness/. Keyed by `animalId` -
  there is exactly one joint Fitness Review per Animal, no separate
  identity of its own, same "singleton keyed by the owning record"
  shape as AdopterProfile (keyed by email). Every field maps directly
  onto the domain type, no flattening or JSON-encoding needed.
  `staffConfirmedAt`/`vetConfirmedAt` are system-generated timestamps,
  so both are DateTime. See lib/adoption-fitness/serialize.ts.
  `vetConfirmationNote` records how the Vet half was set ("Confirmed
  together with Medical Clearance") or why it was withdrawn.
- `MicrochipImplantTask` - see lib/microchip/implant.ts and
  app/api/microchip-implants. Created when Scan Microchip finds no chip;
  `assignedNumber` is unique (15 digits, prefix 036). Written only by
  its two routes, each in a transaction with its AuditLog entry.
- `AntibodyCheck` - see lib/medical/antibodies.ts and
  app/api/medical/antibody-checks. Titre results; `expiryDate` is
  optional. `VaccinationRecord.antibodyOverrideReason`/`antibodyOverrideNote`
  record why a vaccine was given despite a current Protective check.
- `StoredFile` / `StoredFileChunk` - see lib/files/ and app/api/files.
  Uploaded application documents: metadata row plus base64 chunks of at
  most 2 MB (id `<fileId>:<index>`); `completedAt` is set when every
  chunk has arrived.
- `NotificationReadOverride` - see lib/notifications/read-state-store.ts.
  Per-account "mark as read" overrides for the Notifications screen
  (FR-NOT-01); each `NotificationItem` already carries its own
  `defaultRead`, so only accounts that have flipped a given
  notification get a row here. `id` is the synthetic
  `${email}:${notificationId}`, same "natural string id, upsert
  instead of a separate create/update split" shape as DropdownOption's
  ids. `isRead` is Int (0/1), same reasoning as AdoptionAgreement's
  isSigned. Decided as a judgment call rather than an oversight - this
  is closer to a per-device UI flag than shared domain data, but since
  it does need to be shared across whichever device/browser an account
  signs in from (not just the one that flipped it), it belongs here
  rather than in localStorage. See lib/notifications/serialize.ts.
  Re-grepped for real `localStorage.`/`sessionStorage.` calls
  immediately before writing this note (not relying on a past
  session's summary - see the AdopterProfile/AuditLog entries above):
  this was genuinely the last real domain-data store.
  `lib/auth/auth-context.tsx` (session token) and
  `lib/theme/theme-context.tsx` (light/dark preference) remain
  correctly out of scope, as genuinely per-device/session state.

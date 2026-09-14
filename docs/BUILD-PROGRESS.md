# Build Progress

Tracks implementation status for every functional requirement in `docs/PRD.md` section 6 (FR-AUTH-01 through FR-REL-02). Status reflects the actual code in the repository, not intent or planning.

**Status definitions**

- **Done** — the FR's core described capability is functionally implemented (even against mock/local data with no real backend), including its primary user actions.
- **In Progress** — some real UI/logic exists addressing part of the FR (e.g. a read-only view of the data it describes), but its core action(s) are not implemented yet.
- **Not Started** — no code in the repository addresses this FR.

**How to keep this current**: after finishing a module, update its row's Status and Notes here, and include this file's diff in that module's commit.

_Last updated: 2026-09-14, after adding Scan Microchip (FR-MC-01)._

## Summary

| Status | Count |
|---|---|
| Done | 12 |
| In Progress | 5 |
| Not Started | 17 |
| **Total** | **34** |

## 6.1 Authentication and Landing Screen

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-AUTH-01 | 注册与登录 | P0 | Done | `/sign-up` and `/sign-in` implemented against a mock `AuthProvider` (`lib/auth/auth-context.tsx`): unique/valid email, 6-failure lockout, `lastLoginAt` updates, Inactive/Locked messaging. No real backend — accounts persist in `localStorage`/`sessionStorage`. |
| FR-AUTH-02 | 角色化 Landing Screen | P0 | Done | Landing Screen (`components/landing`) renders per-role Administration/User Functions from `lib/roles/roles.ts`; unauthorized entries hidden; direct-URL access to gated pages returns Access Denied (`components/access`). |

## 6.2 User Administration

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-UA-01 | 用户列表与详情 | P0 | Done | `/user-administration` (`components/user-administration`) lists all users (Title/Name/Role/Status) in a compact table with search/role/status filters and Add User; a detail drawer shows Sign Up Date Time, Last Login, Role/Status Updated By and At, and Lock status. Merges `DEMO_ACCOUNTS` + Sign-Up-created accounts via `lib/user-administration/directory-store.ts`. |
| FR-UA-02 | 角色与状态维护 | P0 | Done | All 7 acceptance criteria implemented: Administrator-only gate; Role select (Vet/Council/Staff/Administrator/Adopter); Status select (Active/Inactive only, Locked handled by a separate Unlock action); every role/status change records actor+timestamp+old/new; a second concurrent Active Administrator is prevented by auto-demoting the outgoing one; assigning Administrator requires a confirm dialog ("Confirm Transfer"); the current Administrator's own row can't be set Inactive. Also required moving failed-login lockout from per-tab sessionStorage to a persistent `lib/auth/lockout-store.ts` so it's visible/unlockable across sessions. |

## 6.3 System Administration

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-SA-01 | 下拉选项维护 | P0 | Done | `/system-administration` (`components/system-administration`) is a full Read/Create/Update/Soft-Delete UI over all 13 PRD 6.3 categories (116 seeded options total: `lib/system-administration/seed-options.ts`), each with category/value/description/speciesId(Breed)/isRetired/createdAt/updatedAt (`lib/system-administration/store.ts`, localStorage). Retired options are excluded from new-record pickers but stay listed (with a Retired chip) so historical records keep their original value. `systemLocked` blocks retiring the Administrator role and every value the app's own TypeScript types already hardcode (Species, Sex, Application Status, Check Type/Outcome, Follow Up Type) — the Retire action is disabled with an explanatory tooltip. `lib/options/titles.ts` and `lib/options/breeds.ts` (previously static) now read from this store, so retiring a Title or Breed is reflected live in Sign Up, My Profile, User Administration's Add User form, and the Animals filter panel; retiring a non-Administrator role also removes it from Add User's role picker. |
| FR-SA-02 | 规则配置 | P1 | Not Started | No configuration screen for holding period, reminder days, attachment rules, or agreement template version. |

## 6.4 Council Transfer 与正式入库

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-INT-01 | Council Transfer Submission | P0 | Done | `/new-council-transfer` and `/my-transfers` (`components/council-transfers`) let a Council Officer create, save as Draft, edit and Submit a transfer (source, arrival circumstance, found location, preliminary animal description, plus real file attachments — file metadata only, no backend to store content, disclosed in the UI). All 4 acceptance criteria met: own-record-only view/edit via an ownership check; read-only after Submit with a status chip (Submitted and Accepted both demonstrated live; Returned for Information is a reachable type with no reject action built yet); no cross-links to unrelated Animal/Adopter/Behaviour/Medical records; and criterion 4 (Staff accepting a transfer links it to a formal IntakeRecord) is satisfied as a side effect of linking in FR-INT-02 — creating or editing an Intake Record with a Council Transfer reference calls `acceptTransfer()` (`lib/council-transfers/store.ts`), verified end-to-end. |
| FR-INT-02 | Create Intake Record | P0 | Done | `/animal-intake` (`components/intake-records`) lists pending Submitted Council Transfers (Staff sees all officers', not just their own) each with a "Create Intake Record" action, plus existing Intake Records with search/completeness filter. `/intake-records/new` (optionally pre-filled via `?transferId=`) and `/intake-records/[intakeId]` (`components/intake-records/intake-record-form-screen.tsx`) implement all 9 required fields (arrivalCircumstance, arrivalDateTime, intakeSource, surrenderingPartyName-or-council-reference, species, estimatedAge-or-dateOfBirth, sex, coatColour, coatMarkings) with system-generated unique `intakeId`/`animalId` and a live Complete/Incomplete indicator. Gated to Administrator/Shelter Staff Member per PRD section 9. Saving is incremental (no block on incompleteness), since only the not-yet-built Finalise Intake action (FR-INT-03) is meant to gate on completeness, not creation itself. |
| FR-INT-03 | Animal Profile 初始化 | P0 | Done | Finalise Intake (`finaliseIntake()` in `lib/intake-records/store.ts`, wired to a "Finalise Intake" button on `/intake-records/[intakeId]`) creates a real `Animal` record with `currentStatus = Under Assessment`, `listingStatus = Not Fit`, and `enteredAt`/`lastModifiedAt` set to the current timestamp, then persists it (`lib/animals/animal-store.ts`, merged with the static PRD 12.1 seed animals everywhere Animals are read/listed). Both required gates are enforced and surfaced as an item-by-item unmet-conditions list (updated live as Staff edits the form): at least one photo uploaded (a new metadata-only `Animal.photos`/intake `photos` field, mirroring the Council Transfer attachment pattern — no file content stored), and, when `intakeSource = Council Transfer`, the linked transfer having at least one supporting document. Once finalised, the Intake Record becomes read-only (`finalisedAt` set, re-finalising blocked) and links to the new Animal Profile, whose Photos tab now shows the uploaded photo metadata read-only. Not persisted: a separate `MedicalRecord` shell, since no Medical feature yet reads or displays one — scoped out as having no observable effect. `animalName` was added to `IntakeRecord` beyond FR-INT-02's literal 9-field list, since `Animal.name` is used throughout the rest of the UI. Verified end-to-end via Playwright (photo-gate, council-document-gate, read-only-after-finalise, idempotency, Animals list/detail integration), zero console/page errors. |
| FR-INT-04 | 并行评估与 Review Adoption Fitness | P0 | Done | Finalise Intake (FR-INT-03) now also creates 3 parallel `AssessmentTask` records (Microchip Check, Temperament Assessment, Health Assessment; `lib/adoption-fitness/store.ts`, wired into `finaliseIntake()`), lazily backfilled for the static PRD 12.1 seed animals on first view. `/animals/[animalId]/adoption-fitness` (`components/adoption-fitness`, reached via a "Review Adoption Fitness" link on the Animal Profile's Lifecycle group while `currentStatus = Under Assessment`) implements BR-016: Review Adoption Fitness is gated until all 3 tasks reach "Continuable", lists blockers item-by-item (per-task, plus an unresolved Statutory Hold check against `currentStatus`), and records the joint confirmation - separate "Confirm as Shelter Staff Member" and "Confirm as Veterinarian" actions, each role-gated and blocked while blockers remain, becoming read-only once both are recorded. Scope note: recording each task's full real-world result is FR-MC-01/02 (Scan Microchip), FR-MED-01 (Health Assessment) and FR-BEH-01 (Temperament Assessment) - "Mark Continuable" was an explicitly-disclosed, role-gated stand-in that only tracked readiness for this gate (same pattern as FR-INT-03's metadata-only photo capture standing in for full FR-AN-02). Now that FR-MC-01 is built, the Microchip Check task is completed for real via Scan Microchip instead, which supersedes its stand-in; Health Assessment and Temperament Assessment still use the stand-in pending FR-MED-01/FR-BEH-01. Confirming Review Adoption Fitness does not itself change `currentStatus`/`listingStatus` - no PRD text ties a transition to it (PRD 12.1's Ruby stays Under Assessment/Pre-Listing even once Vet-cleared); that remains Publish Adoption Profile's (FR-LIST-01) job. Verified end-to-end via Playwright (task role-gating, live blocker list, dual confirmation ordering, read-only after completion, Adopter access denied), zero console/page errors. |

## 6.5 Animal Profile 与照片

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-AN-01 | Animal Profile | P0 | In Progress | `/animals` and `/animals/[animalId]` (`components/animals`) display every listed field (Identity/Adoption/Lifecycle groups, calculated-vs-estimated age per the DOB rule) against the 10 static seed animals plus any Animal created via Finalise Intake (FR-INT-03, `lib/animals/animal-store.ts`). Read-only only — no direct create/edit UI (Animal creation happens only through Finalise Intake), and not yet linked to a real Medical/Behaviour pipeline. |
| FR-AN-02 | Photos | P0 | Not Started | The Photos subscreen tab is an honest empty-state placeholder only; no upload, primary-photo selection, or altText handling. |

## 6.6 Microchip 与 Statutory Hold

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-MC-01 | Scan Microchip | P0 | Done | `/animals/[animalId]/scan-microchip` (`components/microchip`, reached from a "Scan Microchip" link on the Animal Profile's Identity group and from the Microchip Check row on Review Adoption Fitness) lets Staff enter a scanned number and creates an immutable `MicrochipLookup` record (`lib/microchip/store.ts`) via a simulated National Pet Registry (`lib/microchip/mock-registry.ts`) supporting all 4 required outcomes using the PRD 12.2 seed numbers: Owner Match (returns Jordan Smith's contact details - phone/address are prototype-invented, matching the style of other demo contact data), No Match, No Chip (submitting no number) and Timeout (an 8-second simulated delay, a clear message, and Retry). A non-empty definitive result (Owner Match/No Match) writes the number back onto `Animal.microchipNumber` (new `updateAnimal()` override-overlay in `lib/animals/animal-store.ts`, mirroring the directory-override pattern, since the 10 seed animals are static imports). Any definitive result (not Timeout) marks the FR-INT-04 Microchip Check task Continuable, superseding that task's generic "Mark Continuable" stand-in. Gated to Administrator/Shelter Staff Member per FR-MC-01's "Staff" actor. Scope boundary (disclosed in the UI): linking the owner to the IntakeRecord, calculating/creating the Statutory Hold, reminders, and reclamation are FR-MC-02, not built yet - an Owner Match result is recorded and displayed but has no further effect. Verified end-to-end via Playwright (all 4 outcomes, microchip number write-back, Fitness task integration, Timeout/Retry timing, role gating), zero console/page errors. |
| FR-MC-02 | Owner Match 与法定留置 | P0 | Not Started | No Statutory Hold creation/reminder/reclamation logic. Bella's mock "Registered Owner" is static display data only, not a real lookup result. |

## 6.7 Medical and Veterinary Management

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-MED-01 | Health Assessment | P0 | Not Started | Medical History subscreen tab is an empty-state placeholder only. |
| FR-MED-02 | Treatment and Recovery | P0 | Not Started | No treatment event recording or recovery reassessment flow. |
| FR-MED-03 | Vaccination、Desexing 与 Medical Clearance | P0 | Not Started | No vaccination/desexing recording or Medical Clearance issuance. |

## 6.8 Behaviour Assessment Management

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-BEH-01 | Temperament Assessment | P0 | Not Started | Behavioural Assessment subscreen tab is an empty-state placeholder only. |
| FR-BEH-02 | Behaviour Program 与复评 | P0 | Not Started | No Behaviour Program creation or reassessment flow. |

## 6.9 Adoption Listing

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-LIST-01 | Publish Adoption Profile | P0 | Not Started | No Publish/unpublish action. `listingStatus` on seed animals is static, not derived from a real publish workflow or its prerequisite checks. |
| FR-LIST-02 | Browse and Filter | P0 | Done | `/adoption-listings` implements the full spec: only `listingStatus = Current` animals, exactly the 8 permitted public fields via a distinct `PublicListing` type, Species/Breed/Sex/Temperament filters, and name-or-Shelter-ID search. |

## 6.10 Adopter Profile 与 Adoption Application

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-ADP-01 | Adopter Profile | P0 | Done | `/my-adopter-profile` (`components/adopter-profile`) is a fully functional, validated self-service form covering every listed field (household, ownership/landlord permission, pets, environment, hours alone, preferred species, referee + consent), persisted per-account in `localStorage`. Adopter-only, gated like the other My screens. Note: the snapshot-on-submit rule ("后续修改 Profile 不得改变已提交版本") can't be demonstrated yet since Submit Adoption Application (FR-APP-01) doesn't exist to take the snapshot. |
| FR-APP-01 | Submit Adoption Application | P0 | In Progress | `/my-applications` shows the Adopter's own application records and status (mock data). Submitting a new application or editing a Draft is not implemented; "Apply Now" on Adoption Listings is a disabled placeholder. |

## 6.11 Application Assessment

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-CHK-01 | 三项 SuitabilityCheck | P0 | Not Started | No SuitabilityCheck creation or Staff-side check-completion UI. |
| FR-CHK-02 | Approve or Reject | P0 | Not Started | No Staff-side decision workflow. The Adopter-facing status/rejection reason shown in My Applications is static mock data, not a result of a real decision action. |

## 6.12 Meet and Greet

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-MG-01 | Schedule and Conduct Meet and Greet | P0 | In Progress | `/my-meet-and-greets` shows the Adopter's own visits and compatibility outcome (mock data). Staff scheduling and the Adopter's attendance confirmation are disabled placeholders. |

## 6.13 Agreement、Payment 与 Finalisation

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-AGR-01 | Adoption Agreement | P0 | In Progress | `/my-agreements` shows the Adopter's own agreements, both Pending Signature and Signed states (mock data). Staff generation and Adopter online signing are disabled placeholders. |
| FR-PAY-01 | Adoption Payment | P0 | Not Started | No payment screen exists yet, for either Adopter or Staff. |
| FR-FIN-01 | Finalise Adoption Record | P0 | Not Started | No Finalise action or its prerequisite checks (Meet and Greet/Agreement/Payment). |

## 6.14 Pre-Release、Release 与 Follow Up

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-REL-01 | Conduct Pre-Release Check | P0 | Not Started | No Pre-Release Check screen (Veterinarian's "Pre-Release Checks" nav entry is still inert). |
| FR-REL-02 | Release and Follow Up | P0 | Not Started | No Release action or FollowUpVisit creation/completion flow. |

## 6.15 Notifications、Audit 与 Records

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-AUD-01 | Immutable AuditLog | P1 | Not Started | No AuditLog exists; no write action in the app currently records one. |
| FR-NOT-01 | Notifications | P1 | In Progress | `/notifications` (`components/notifications`) implements the full list UI (search/filter/sort/paginate/mark-as-read) covering all 9 event types, role-scoped. All 9 notification types are static mock data — no real event actually generates one yet, since the underlying features (Intake, Medical, Behaviour, Applications, Backup jobs) aren't built. |
| FR-REC-01 | Archive、Search 与 Export | P1 | Not Started | No Archive search or AuditLog/statistics export exists. |

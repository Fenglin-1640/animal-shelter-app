# Build Progress

Tracks implementation status for every functional requirement in `docs/PRD.md` section 6 (FR-AUTH-01 through FR-REL-02). Status reflects the actual code in the repository, not intent or planning.

**Status definitions**

- **Done** — the FR's core described capability is functionally implemented (even against mock/local data with no real backend), including its primary user actions.
- **In Progress** — some real UI/logic exists addressing part of the FR (e.g. a read-only view of the data it describes), but its core action(s) are not implemented yet.
- **Not Started** — no code in the repository addresses this FR.

**How to keep this current**: after finishing a module, update its row's Status and Notes here, and include this file's diff in that module's commit.

_Last updated: 2026-09-14, after adding Council Transfer Submission (FR-INT-01)._

## Summary

| Status | Count |
|---|---|
| Done | 7 |
| In Progress | 6 |
| Not Started | 21 |
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
| FR-INT-01 | Council Transfer Submission | P0 | In Progress | `/new-council-transfer` and `/my-transfers` (`components/council-transfers`) let a Council Officer create, save as Draft, edit and Submit a transfer (source, arrival circumstance, found location, preliminary animal description, plus real file attachments via a Document Type sourced from System Administration — file metadata only, no backend to store content, and this is disclosed in the UI). Meets acceptance criteria 1-3: own-record-only view/edit via an ownership check, read-only after Submit with a status chip (Submitted; Accepted/Returned for Information are reachable types but nothing sets them yet), and no cross-links to unrelated Animal/Adopter/Behaviour/Medical records. Criterion 4 (Staff accepting a transfer and linking it to a formal IntakeRecord) is Staff-side and depends on FR-INT-02, not built. |
| FR-INT-02 | Create Intake Record | P0 | Not Started | No Intake Record creation flow; Staff's "Animal Intake" nav entry is still inert. |
| FR-INT-03 | Animal Profile 初始化 | P0 | Not Started | No Finalise Intake action. All Animal records are static PRD 12.1 seed data, not created through an intake workflow. |
| FR-INT-04 | 并行评估与 Review Adoption Fitness | P0 | Not Started | No Microchip/Temperament/Health task creation or Review Adoption Fitness screen. |

## 6.5 Animal Profile 与照片

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-AN-01 | Animal Profile | P0 | In Progress | `/animals` and `/animals/[animalId]` (`components/animals`) display every listed field (Identity/Adoption/Lifecycle groups, calculated-vs-estimated age per the DOB rule) against the 10 static seed animals. Read-only only — no create/edit, and not yet linked to a real Intake/Medical/Behaviour pipeline. |
| FR-AN-02 | Photos | P0 | Not Started | The Photos subscreen tab is an honest empty-state placeholder only; no upload, primary-photo selection, or altText handling. |

## 6.6 Microchip 与 Statutory Hold

| FR | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| FR-MC-01 | Scan Microchip | P0 | Not Started | No microchip scan/lookup UI or mock National Pet Registry service. |
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

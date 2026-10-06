// API permission matrix: signs in as each seeded demo account and checks
// which roles each route admits, plus record-ownership rules. Every write
// probe here is one that must be refused, so nothing is written on a
// passing run. Usage (against a running app with the seed data):
//   npm run test:permissions            (http://localhost:3000)
//   BASE=https://... npm run test:permissions
const BASE = process.env.BASE ?? "http://localhost:3000";
const ACCOUNTS = {
  Administrator: "admin@asams.demo",
  "Shelter Staff Member": "staff@asams.demo",
  Veterinarian: "vet@asams.demo",
  "Council Animal Control Officer": "council@asams.demo",
  Adopter: "adopter@asams.demo",
};
const ROLES = Object.keys(ACCOUNTS);
const A = "Administrator", S = "Shelter Staff Member", V = "Veterinarian", C = "Council Animal Control Officer", D = "Adopter";

let failures = 0, checks = 0;
function expect(label, cond, detail = "") {
  checks++;
  if (!cond) { failures++; console.log(`FAIL ${label}${detail ? " - " + detail : ""}`); }
}

async function signIn(email) {
  const r = await fetch(`${BASE}/api/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Demo123!" }) });
  const body = await r.json();
  return { cookie: `Bearer ${body.token}`, user: body.user };
}
const call = (cookie, method, path, body) =>
  fetch(BASE + path, { method, headers: { ...(cookie ? { authorization: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });

// GET endpoints and which roles may read them.
const READS = {
  "/api/animals": ROLES, "/api/animals/A-0001": ROLES, "/api/photos": ROLES, "/api/applications": ROLES,
  "/api/pending-counts": ROLES, "/api/notification-read-overrides": ROLES,
  "/api/agreements": [A, S, V, D], "/api/payments": [A, S, V, D], "/api/meet-and-greets": [A, S, V, D],
  "/api/follow-up-visits": [A, S, V, D], "/api/checks": [A, S, V, D],
  "/api/adopter-profiles": [A, S, D], "/api/council-transfers": [A, S, C],
  "/api/intake-records": [A, S], "/api/assessment-tasks": [A, S, V], "/api/fitness-reviews": [A, S, V],
  "/api/statutory-holds": [A, S, V], "/api/microchip-lookups": [A, S, V], "/api/system-settings": [A, S, V],
  "/api/medical/health-assessments": [A, S, V], "/api/medical/vaccinations": [A, S, V], "/api/medical/clearances": [A, S, V],
  "/api/medical/desexing-schedules": [A, S, V], "/api/medical/pre-release-checks": [A, S, V], "/api/medical/treatment-events": [A, S, V],
  "/api/behaviour/temperament-assessments": [A, S, V], "/api/behaviour/programs": [A, S, V],
  "/api/audit-log": [A], "/api/users": [A],
  "/api/worklist": ROLES, "/api/process/animals/A-0006": [A, S, V], "/api/process/transfers": [C],
  "/api/microchip-implants": [A, S, V], "/api/microchip-implants?status=Pending": [A, S, V],
  "/api/medical/antibody-checks": [A, S, V], "/api/medical/antibody-checks?animalId=A-0006": [A, S, V], "/api/assessment-tasks?animalId=A-0006": [A, S, V],
  "/api/files/rules": ROLES,
  "/api/medical/vaccination-checks": [A, S, V], "/api/medical/vaccination-checks?animalId=A-0006": [A, S, V],
  "/api/medical/vaccination-tasks": [A, S, V], "/api/medical/vaccination-tasks?animalId=A-0006": [A, S, V],
};
// Write probes that must be refused for the listed roles (bodies are
// harmless placeholders; the guard rejects before any write).
const FORBIDDEN_WRITES = [
  ["POST", "/api/medical/vaccinations", [A, S, C, D]],
  ["POST", "/api/medical/clearances", [A, S, C, D]],
  ["PATCH", "/api/medical/desexing-schedules/X", [A, S, C, D]],
  ["POST", "/api/medical/pre-release-checks", [A, S, C, D]],
  ["POST", "/api/behaviour/temperament-assessments", [V, C, D]],
  ["POST", "/api/photos", [V, C, D]],
  ["DELETE", "/api/photos/X", [V, C, D]],
  ["PATCH", "/api/animals/A-0001", [V, C, D]],
  ["POST", "/api/animals", [V, C, D]],
  ["POST", "/api/animals/A-0001/status", [C, D]],
  ["POST", "/api/intake-records", [V, C, D]],
  ["POST", "/api/intake-records/finalise", [V, C, D]],
  ["POST", "/api/microchip-lookups", [V, C, D]],
  ["POST", "/api/statutory-holds", [V, C, D]],
  ["POST", "/api/follow-up-visits", [A, V, C, D]],
  ["PATCH", "/api/payments/X", [V, C, D]],
  ["POST", "/api/agreements", [V, C, D]],
  ["POST", "/api/meet-and-greets", [V, C, D]],
  ["PATCH", "/api/checks/X", [V, C, D]],
  ["POST", "/api/council-transfers", [A, S, V, D]],
  ["POST", "/api/users", [S, V, C, D]],
  ["PATCH", "/api/users/U-DEMO-STAFF/role-status", [S, V, C, D]],
  ["POST", "/api/users/U-DEMO-STAFF/unlock", [S, V, C, D]],
  ["POST", "/api/dropdown-options", [S, V, C, D]],
  ["POST", "/api/system-settings", [S, V, C, D]],
  ["POST", "/api/applications", [A, S, V, C]],
  ["POST", "/api/payments", [A, S, V, C]],
  ["POST", "/api/checks", [A, S, V, C]],
  ["POST", "/api/adopter-profiles", [A, S, V, C]],
  ["POST", "/api/fitness-reviews", [V, C, D]],
  ["POST", "/api/microchip-implants", [V, C, D]],
  ["POST", "/api/medical/antibody-checks", [A, S, C, D]],
  ["POST", "/api/medical/vaccination-checks", [A, S, C, D]],
  ["POST", "/api/medical/vaccination-tasks/X/waive", [A, S, C, D]],
  ["POST", "/api/microchip-implants/X/complete", [A, S, C, D]],
  ["GET", "/api/audit-log", [S, V, C, D]],
];

(async () => {
  const sessions = {};
  for (const role of ROLES) sessions[role] = await signIn(ACCOUNTS[role]);

  // 1. Anonymous: everything 401 except the public endpoints.
  for (const path of Object.keys(READS)) {
    const r = await call(null, "GET", path);
    expect(`anonymous GET ${path} -> 401`, r.status === 401, `got ${r.status}`);
  }
  expect("anonymous GET /api/dropdown-options -> 200", (await call(null, "GET", "/api/dropdown-options")).status === 200);
  expect("forged token rejected", (await call("Bearer U-DEMO-ADMIN.9999999999.forged", "GET", "/api/users")).status === 401);
  const adminTok = (await signIn(ACCOUNTS[A])).cookie.slice(7);
  expect("legacy cookie alone does not authenticate", (await fetch(BASE + "/api/users", { headers: { cookie: `asams_session=${adminTok}` } })).status === 401);
  expect("malformed Authorization rejected", (await fetch(BASE + "/api/users", { headers: { authorization: adminTok } })).status === 401);

  // 2. Read matrix.
  for (const [path, allowed] of Object.entries(READS)) {
    for (const role of ROLES) {
      const r = await call(sessions[role].cookie, "GET", path);
      const want = allowed.includes(role) ? 200 : 403;
      expect(`${role} GET ${path} -> ${want}`, r.status === want, `got ${r.status}`);
    }
  }

  // 3. Forbidden writes.
  for (const [method, path, roles] of FORBIDDEN_WRITES) {
    for (const role of roles) {
      const r = await call(sessions[role].cookie, method, path, method === "DELETE" || method === "GET" ? undefined : {});
      expect(`${role} ${method} ${path} -> 403`, r.status === 403, `got ${r.status}`);
    }
  }

  // 4. Ownership and projection.
  const adopter = sessions[D].cookie, council = sessions[C].cookie, staff = sessions[S].cookie;
  const json = async (cookie, path) => (await call(cookie, "GET", path)).json();
  const allApps = (await json(staff, "/api/applications")).items;
  const myApps = (await json(adopter, "/api/applications")).items;
  expect("Adopter sees only own applications", myApps.every((a) => a.adopterEmail.toLowerCase() === "adopter@asams.demo") && myApps.length === allApps.filter((a) => a.adopterEmail.toLowerCase() === "adopter@asams.demo").length, `${myApps.length} of ${allApps.length}`);
  expect("Council sees no applications", (await json(council, "/api/applications")).items.length === 0);
  for (const path of ["/api/agreements", "/api/payments", "/api/meet-and-greets", "/api/follow-up-visits"]) {
    const items = (await json(adopter, path)).items;
    expect(`Adopter ${path} only own`, items.every((i) => i.adopterEmail.toLowerCase() === "adopter@asams.demo"), `${items.length} items`);
  }
  const myAppIds = new Set(myApps.map((a) => a.applicationId));
  const myChecks = (await json(adopter, "/api/checks")).items;
  expect("Adopter checks only on own applications", myChecks.every((c) => myAppIds.has(c.applicationId)), `${myChecks.length} checks`);
  const profiles = (await json(adopter, "/api/adopter-profiles?email=someone@else.com")).items;
  expect("Adopter profile query forced to own email", profiles.every((p) => p.email === "adopter@asams.demo"), JSON.stringify(profiles.map((p) => p.email)));
  const transfers = (await json(council, "/api/council-transfers")).items;
  expect("Council sees only own transfers", transfers.every((t) => t.submittedByEmail.toLowerCase() === "council@asams.demo"), `${transfers.length}`);
  const staffAnimals = (await json(staff, "/api/animals")).animals;
  const adopterAnimals = (await json(adopter, "/api/animals")).animals;
  expect("Staff animals include internal fields", staffAnimals.some((a) => a.microchipNumber || a.linkedPerson));
  expect("Adopter animals have no microchip/linked person/intake source", adopterAnimals.every((a) => !a.microchipNumber && !a.linkedPerson && !a.intakeSource));
  expect("Council animal detail is public projection", (await json(council, "/api/animals/A-0006")).animal.microchipNumber === undefined);
  const staffPhotos = (await json(staff, "/api/photos")).items;
  const adopterPhotos = (await json(adopter, "/api/photos")).items;
  expect("Adopter sees only public photos", adopterPhotos.every((p) => p.useOnAdoptionListing) && adopterPhotos.length === staffPhotos.filter((p) => p.useOnAdoptionListing).length, `${adopterPhotos.length}/${staffPhotos.length}`);
  const nonPublic = staffPhotos.find((p) => !p.useOnAdoptionListing && p.imageUrl);
  if (nonPublic) expect("Adopter list never hands out a non-public image URL", !adopterPhotos.some((p) => p.id === nonPublic.id));
  const withImage = staffPhotos.find((p) => p.imageUrl);
  if (withImage) {
    expect("Signed image URL loads without a session", (await fetch(BASE + withImage.imageUrl)).status === 200);
    const bare = withImage.imageUrl.split("?")[0];
    expect("Unsigned image URL refused", (await fetch(BASE + bare)).status === 403);
    expect("Tampered image signature refused", (await fetch(BASE + withImage.imageUrl.replace(/sig=./, (m) => m.endsWith("A") ? "sig=B" : "sig=A"))).status === 403);
    const other = staffPhotos.find((p) => p.id !== withImage.id);
    if (other) expect("Signature for one photo does not open another", (await fetch(BASE + withImage.imageUrl.replace(encodeURIComponent(withImage.id), encodeURIComponent(other.id)))).status === 403);
  }
  const overrides = (await json(adopter, "/api/notification-read-overrides")).items;
  expect("Read overrides only own", overrides.every((o) => o.email === "adopter@asams.demo"));
  const counts = await json(adopter, "/api/pending-counts?role=Administrator&email=admin@asams.demo");
  expect("pending-counts ignores spoofed role/email", JSON.stringify(Object.keys(counts.counts)) === JSON.stringify(["My Meet and Greets"]), JSON.stringify(counts));

  // 5. Ownership-checked writes (all must be refused).
  const otherApp = allApps.find((a) => a.adopterEmail.toLowerCase() !== "adopter@asams.demo");
  if (otherApp) {
    expect("Adopter cannot patch someone else's application", (await call(adopter, "PATCH", `/api/applications/${otherApp.applicationId}`, { motivationStatement: "x" })).status === 403);
  }
  const ownNonDraft = myApps.find((a) => a.applicationStatus !== "Draft");
  if (ownNonDraft) expect("Adopter cannot patch own submitted application", (await call(adopter, "PATCH", `/api/applications/${ownNonDraft.applicationId}`, { applicationStatus: "Approved" })).status === 403);
  expect("Adopter cannot create an application for someone else", (await call(adopter, "POST", "/api/applications", { adopterEmail: "other@example.com" })).status === 403);
  expect("Adopter cannot save someone else's profile", (await call(adopter, "POST", "/api/adopter-profiles", { email: "other@example.com" })).status === 403);
  const otherAgreement = (await json(staff, "/api/agreements")).items.find((a) => a.adopterEmail.toLowerCase() !== "adopter@asams.demo");
  if (otherAgreement) expect("Adopter cannot sign someone else's agreement", (await call(adopter, "PATCH", `/api/agreements/${otherAgreement.agreementId}`, { isSigned: true })).status === 403);
  const otherMg = (await json(staff, "/api/meet-and-greets")).items.find((m) => m.adopterEmail.toLowerCase() !== "adopter@asams.demo");
  if (otherMg) expect("Adopter cannot change someone else's Meet and Greet", (await call(adopter, "PATCH", `/api/meet-and-greets/${otherMg.meetAndGreetId}`, { attendanceConfirmed: true })).status === 403);
  expect("Adopter cannot mark read for someone else", (await call(adopter, "POST", "/api/notification-read-overrides", { email: "admin@asams.demo", notificationId: "x", isRead: true })).status === 403);
  expect("User cannot edit another user's profile", (await call(adopter, "PATCH", "/api/users/U-DEMO-STAFF/profile", { firstName: "x" })).status === 403);
  expect("User cannot change another user's password", (await call(adopter, "POST", "/api/users/U-DEMO-STAFF/change-password", {})).status === 403);
  expect("Non-admin cannot read another user", (await call(staff, "GET", "/api/users/U-DEMO-ADMIN")).status === 403);
  expect("User can read self", (await call(staff, "GET", `/api/users/${sessions[S].user.id}`)).status === 200);
  expect("Admin can read any user", (await call(sessions[A].cookie, "GET", "/api/users/U-DEMO-STAFF")).status === 200);
  const submittedTransfer = transfers.find((t) => t.status !== "Draft");
  if (submittedTransfer) expect("Council cannot edit a submitted transfer", (await call(council, "PATCH", `/api/council-transfers/${submittedTransfer.id}`, { status: "Accepted" })).status === 403);
  expect("Council cannot create a transfer as someone else", (await call(council, "POST", "/api/council-transfers", { submittedByEmail: "other@example.com" })).status === 403);
  // Fitness: a role may only record its own side, in its own name.
  expect("Vet cannot write the fitness review directly (clearance confirms it)", (await call(sessions[V].cookie, "POST", "/api/fitness-reviews", { animalId: "A-0006", vetConfirmedByEmail: "vet@asams.demo" })).status === 403);
  expect("Vet cannot record the Staff side", (await call(sessions[V].cookie, "POST", "/api/fitness-reviews", { animalId: "A-0006", staffConfirmedByEmail: "vet@asams.demo" })).status === 403);
  expect("Staff cannot record the Vet side", (await call(staff, "POST", "/api/fitness-reviews", { animalId: "A-0006", vetConfirmedByEmail: "staff@asams.demo" })).status === 403);
  expect("Staff cannot confirm in another's name", (await call(staff, "POST", "/api/fitness-reviews", { animalId: "A-0006", staffConfirmedByEmail: "admin@asams.demo" })).status === 403);
  // Holds: Vet only the lazy-expiry flip.
  const holds = (await json(staff, "/api/statutory-holds")).items;
  if (holds[0]) expect("Vet cannot reclaim a hold", (await call(sessions[V].cookie, "PATCH", `/api/statutory-holds/${holds[0].id}`, { status: "Reclaimed" })).status === 403);
  const activeFuture = holds.find((h) => h.status === "Active" && new Date(h.holdEndAt) > new Date());
  if (activeFuture) expect("Vet cannot expire a hold early", (await call(sessions[V].cookie, "PATCH", `/api/statutory-holds/${activeFuture.id}`, { status: "Expired", expiredAt: new Date().toISOString() })).status === 403);

  // 5b. Process journeys: ownership on the application journey.
  const otherAppForJourney = allApps.find((a) => a.adopterEmail.toLowerCase() !== "adopter@asams.demo");
  if (otherAppForJourney) {
    expect("Staff can read any application journey", (await call(staff, "GET", `/api/process/applications/${otherAppForJourney.applicationId}`)).status === 200);
    expect("Adopter cannot read someone else's application journey", (await call(adopter, "GET", `/api/process/applications/${otherAppForJourney.applicationId}`)).status === 403);
    expect("Council cannot read application journeys", (await call(council, "GET", `/api/process/applications/${otherAppForJourney.applicationId}`)).status === 403);
  }
  const advWorklist = await json(adopter, "/api/worklist");
  expect("Adopter worklist has only own applications", Object.keys(advWorklist.applications).every((id) => myApps.some((a) => a.applicationId === id)) && Object.keys(advWorklist.animals).length === 0);
  const councilWorklist = await json(council, "/api/worklist");
  expect("Council worklist has no animal or application data", Object.keys(councilWorklist.animals).length === 0 && Object.keys(councilWorklist.applications).length === 0);
  const ct = await json(council, "/api/process/transfers");
  expect("Council transfer statuses cover only own transfers", Object.keys(ct.transfers).every((id) => transfers.some((t) => t.id === id)));

  // 5c. Stored application documents: Staff/Admin and the owning Adopter
  // only (metadata list), never the Veterinarian or a Council Officer.
  const filesFor = (id) => `/api/files?ownerType=application&ownerId=${id}`;
  if (myApps[0]) {
    expect("Adopter can list documents of own application", (await call(adopter, "GET", filesFor(myApps[0].applicationId))).status === 200);
  }
  if (allApps[0]) {
    const any = allApps[0].applicationId;
    for (const [role, token] of [[A, sessions[A].cookie], [S, staff]]) {
      expect(`${role} can list application documents`, (await call(token, "GET", filesFor(any))).status === 200);
      expect(`${role} cannot start an upload to an Adopter application`, (await call(token, "POST", "/api/files", { ownerType: "application", ownerId: any, fileName: "x.pdf", sizeBytes: 10 })).status === 403);
    }
    expect("Vet cannot list application documents", (await call(sessions[V].cookie, "GET", filesFor(any))).status === 403);
    expect("Council cannot list application documents", (await call(council, "GET", filesFor(any))).status === 403);
    const vetView = (await json(sessions[V].cookie, "/api/applications")).items.find((a) => a.applicationId === any);
    expect("Vet receives applications without documents", Boolean(vetView) && vetView.documents.length === 0);
  }
  if (otherAppForJourney) {
    expect("Adopter cannot list another Adopter documents", (await call(adopter, "GET", filesFor(otherAppForJourney.applicationId))).status === 403);
  }

  // 5d. Rule Configuration: the attachment size can only be set from 1 to 5 MB.
  const current = (await json(sessions[A].cookie, "/api/system-settings")).item;
  if (current) {
    expect("Admin cannot save a max attachment size above 5 MB", (await call(sessions[A].cookie, "POST", "/api/system-settings", { ...current, maxAttachmentSizeMB: 10 })).status === 400);
    expect("Admin cannot save a max attachment size of 0", (await call(sessions[A].cookie, "POST", "/api/system-settings", { ...current, maxAttachmentSizeMB: 0 })).status === 400);
  }

  // 6. Session endpoint and independence of sessions.
  expect("session endpoint reports the signed-in user", (await json(staff, "/api/auth/session")).user?.role === S);
  const second = await signIn(ACCOUNTS[S]);
  expect("signing in again does not invalidate an earlier token", (await call(staff, "GET", "/api/animals")).status === 200 && (await call(second.cookie, "GET", "/api/animals")).status === 200);

  console.log(`${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ""}`);
  process.exitCode = failures ? 1 : 0;
})();

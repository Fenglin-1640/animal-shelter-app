// QA test runner entry point. Usage (from the project root):
//   npx tsx scripts/qa-test-runner/run.ts adopters [--force]
//   npx tsx scripts/qa-test-runner/run.ts animals [TC-001 TC-002 ...]
//   npx tsx scripts/qa-test-runner/run.ts negatives
//   npx tsx scripts/qa-test-runner/run.ts report
import { assertServerUp } from "./lib/fetch-shim";
import { getAdoptionRows, getAssessmentRows, getIntakeRows, getReleaseRows } from "./lib/sheet";
import { runAdoptersPhase } from "./steps/adopters";
import { runAnimalWorkflow, type TestCaseBundle } from "./steps/animal-workflow";
import { printReport } from "./steps/report";

function buildBundles(): Map<string, TestCaseBundle> {
  const intakeRows = getIntakeRows();
  const assessmentRows = new Map(getAssessmentRows().map((r) => [r.testCaseId, r]));
  const adoptionRows = new Map(getAdoptionRows().map((r) => [r.testCaseId, r]));
  const releaseRows = new Map(getReleaseRows().map((r) => [r.testCaseId, r]));

  const bundles = new Map<string, TestCaseBundle>();
  for (const intake of intakeRows) {
    const assessment = assessmentRows.get(intake.testCaseId);
    const adoption = adoptionRows.get(intake.testCaseId);
    const release = releaseRows.get(intake.testCaseId);
    if (!assessment || !adoption || !release) {
      console.warn(`Skipping ${intake.testCaseId}: missing a row in one of the joined sheets.`);
      continue;
    }
    bundles.set(intake.testCaseId, { intake, assessment, adoption, release });
  }
  return bundles;
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  await assertServerUp();

  switch (mode) {
    case "adopters":
      await runAdoptersPhase(rest.includes("--force"));
      break;

    case "animals": {
      const bundles = buildBundles();
      const only = rest.filter((a) => a.startsWith("TC-"));
      const targets = only.length > 0 ? only : [...bundles.keys()];
      console.log(`\n=== Animal workflow phase (${targets.length} test case${targets.length === 1 ? "" : "s"}) ===`);
      for (const tcId of targets) {
        const bundle = bundles.get(tcId);
        if (!bundle) {
          console.warn(`Unknown Test Case ID: ${tcId}`);
          continue;
        }
        await runAnimalWorkflow(bundle);
      }
      break;
    }

    case "negatives": {
      const bundles = buildBundles();
      const template = bundles.get("TC-002"); // a plain Standard-full-workflow cat, reused only as a data template
      if (!template) throw new Error("TC-002 not found to use as a negative-path template");
      const { runOwnerMatchNegative, runIncompatibleNegative } = await import("./steps/negative-paths");
      await runOwnerMatchNegative(template);
      await runIncompatibleNegative(template);
      break;
    }

    case "report":
      printReport();
      break;

    default:
      console.error(`Unknown mode: "${mode}". Use one of: adopters, animals, negatives, report.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

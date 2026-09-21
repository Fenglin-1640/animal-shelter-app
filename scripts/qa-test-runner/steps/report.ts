import fs from "node:fs";
import path from "node:path";
import { loadLog, type CaseEntry } from "../lib/runlog";

const REPORT_PATH = path.join(__dirname, "..", "..", "..", "test-data", "results", "report.md");

function summariseCase(id: string, entry: CaseEntry): { lines: string[]; passed: number; failed: number; blocked: number } {
  const lines: string[] = [];
  let passed = 0, failed = 0, blocked = 0;
  lines.push(`### ${id}${entry.animalId ? ` -> ${entry.animalId} (${entry.shelterId ?? ""})` : " (no AnimalId - never reached Finalise Intake)"}`);
  for (const [stepName, result] of Object.entries(entry.steps)) {
    const icon = result.status === "pass" ? "PASS" : result.status === "blocked_expected" ? "BLOCKED (expected)" : result.status === "skipped" ? "SKIPPED" : "FAIL";
    if (result.status === "pass") passed++;
    else if (result.status === "blocked_expected") blocked++;
    else if (result.status === "fail") failed++;
    lines.push(`- **${stepName}**: ${icon} — expected: ${result.expected} | actual: ${result.actual}${result.note ? ` | note: ${result.note}` : ""}`);
  }
  return { lines, passed, failed, blocked };
}

export function printReport(): void {
  const log = loadLog();
  const lines: string[] = [`# ASAMS QA Test Run Report`, ``, `Generated ${new Date().toISOString()}`, ``];

  let totalPass = 0, totalFail = 0, totalBlocked = 0;

  lines.push(`## Adopters (${Object.keys(log.adopters).length})`);
  for (const [id, a] of Object.entries(log.adopters)) {
    lines.push(`- ${id} (${a.email}): signedUp=${a.signedUp}, profileSaved=${a.profileSaved}`);
  }
  lines.push(``, `## Standard/health-recheck/behaviour-blocked Test Cases (${Object.keys(log.cases).length})`, ``);

  const caseIds = Object.keys(log.cases).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10);
    const nb = parseInt(b.replace(/\D/g, ""), 10);
    return na - nb;
  });
  for (const id of caseIds) {
    const { lines: caseLines, passed, failed, blocked } = summariseCase(id, log.cases[id]);
    totalPass += passed;
    totalFail += failed;
    totalBlocked += blocked;
    lines.push(...caseLines, ``);
  }

  lines.push(`## Negative-path isolated runs (${Object.keys(log.negatives).length})`, ``);
  for (const [id, entry] of Object.entries(log.negatives)) {
    const { lines: negLines, passed, failed, blocked } = summariseCase(id, entry);
    totalPass += passed;
    totalFail += failed;
    totalBlocked += blocked;
    lines.push(...negLines, ``);
  }

  lines.push(
    `## Summary`,
    ``,
    `- Total steps recorded: ${totalPass + totalFail + totalBlocked}`,
    `- Pass: ${totalPass}`,
    `- Blocked (expected): ${totalBlocked}`,
    `- Fail: ${totalFail}`,
    ``,
  );

  const report = lines.join("\n");
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf-8");
  console.log(report);
  console.log(`\nFull report written to ${REPORT_PATH}`);
}

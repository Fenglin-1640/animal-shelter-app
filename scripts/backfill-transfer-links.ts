// Creates the AnimalTransferLink row for every finalised intake record that
// references an existing Council Transfer and has its animal, unless a link
// already exists. Only inserts link rows; no other data is changed. Safe to
// run again. Dry run by default:
//   npx tsx scripts/backfill-transfer-links.ts [--apply]
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";

const apply = process.argv.includes("--apply");

async function main() {
  const [intakes, transfers, animals, links] = await Promise.all([
    db.orm.IntakeRecord.select("intakeId", "animalId", "councilTransferSubmissionId", "finalisedAt", "createdAt").all(),
    db.orm.CouncilTransferSubmission.select("id").all(),
    db.orm.Animal.select("animalId").all(),
    db.orm.AnimalTransferLink.select("animalId", "councilTransferId").all(),
  ]);
  const transferIds = new Set(transfers.map((t) => t.id));
  const animalIds = new Set(animals.map((a) => a.animalId));
  const linkedAnimals = new Set(links.map((l) => l.animalId));
  const linkedTransfers = new Set(links.map((l) => l.councilTransferId));

  let created = 0;
  let skipped = 0;
  for (const intake of intakes) {
    const transferId = intake.councilTransferSubmissionId;
    if (!transferId || !intake.finalisedAt) continue;
    if (!transferIds.has(transferId) || !animalIds.has(intake.animalId)) {
      skipped++;
      console.log(`skip ${intake.intakeId}: transfer or animal missing`);
      continue;
    }
    if (linkedAnimals.has(intake.animalId) || linkedTransfers.has(transferId)) continue;
    linkedAnimals.add(intake.animalId);
    linkedTransfers.add(transferId);
    created++;
    if (apply) {
      await db.orm.AnimalTransferLink.create({
        animalId: intake.animalId,
        councilTransferId: transferId,
        intakeId: intake.intakeId,
        createdAt: toTimestamptz(intake.finalisedAt ?? intake.createdAt),
      });
    }
  }
  console.log(`${apply ? "created" : "would create"} ${created} link(s); ${links.length} already linked; ${skipped} skipped`);
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

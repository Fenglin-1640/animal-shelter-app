// Relative imports (not the "@/..." alias) - this script runs standalone
// via tsx, outside Next.js's bundler, which is what resolves that alias.
import { db } from "../lib/db/client";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";

// Recreates the PRD 4.2 demo accounts (one per role) in the database.
// Run with `npm run db:seed`. Safe to re-run: existing rows are replaced.
async function main() {
  for (const account of DEMO_ACCOUNTS) {
    await db.orm.User.upsert({
      // No conflictOn: the primary key (id) is the conflict target.
      create: {
        id: account.userId,
        email: account.email.toLowerCase(),
        password: account.password,
        role: account.role,
        status: account.status,
        title: account.title,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
        signUpAt: new Date(account.signUpAt),
        failedLoginAttempts: 0,
      },
      update: {
        email: account.email.toLowerCase(),
        password: account.password,
        role: account.role,
        status: account.status,
        title: account.title,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
      },
    });
    console.log(`Seeded ${account.role}: ${account.email}`);
  }

  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

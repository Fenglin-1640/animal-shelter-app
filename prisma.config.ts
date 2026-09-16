import "dotenv/config";
import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-sqlite/config";

// Prisma 8's "contract" toolchain (no classic schema.prisma/migrate here -
// see prisma/README.md for why). DATABASE_URL defaults to a gitignored
// local file so `npm run db:update` works with zero setup.
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    },
  }),
});

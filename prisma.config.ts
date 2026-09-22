import { config as loadEnv } from "dotenv";
import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

// This file is run directly by the `prisma` CLI (contract emit / db update),
// not through `next dev`, so it doesn't get Next.js's automatic
// .env.development.local/.env.local loading - load the same files here,
// in the same precedence order Next.js uses (first match wins).
loadEnv({ path: [".env.development.local", ".env.local", ".env"] });

// Prisma 8's "contract" toolchain (no classic schema.prisma/migrate here -
// see prisma/README.md for why). DATABASE_URL is the Neon Postgres
// connection string (set in .env.development.local, gitignored).
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env.DATABASE_URL,
    },
  }),
});

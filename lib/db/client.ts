import fs from "node:fs";
import path from "node:path";
import sqlite from "@prisma/orm-sqlite/runtime";
import type { Contract } from "@/prisma/contract";

// Prisma 8's "contract" toolchain has no classic PrismaClient - see
// prisma/README.md. contract.json is read with fs instead of an ESM
// `with { type: "json" }` import attribute so this module works the same
// way under both Next.js's bundler and a plain `tsx` script (prisma/seed.ts).
const contractJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "prisma", "contract.json"), "utf-8"),
);

// DATABASE_URL matches prisma.config.ts's default; the sqlite runtime
// wants a filesystem path, not a "file:" URL, so the prefix is stripped.
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbPath = databaseUrl.replace(/^file:/, "");

// Reused across hot reloads in dev so `next dev` doesn't open a new
// sqlite connection on every edit (same reasoning as the classic
// `globalThis.prisma` singleton pattern).
const globalForDb = globalThis as unknown as { asamsDb?: ReturnType<typeof sqlite<Contract>> };

export const db =
  globalForDb.asamsDb ?? sqlite<Contract>({ contractJson, path: dbPath });

if (process.env.NODE_ENV !== "production") {
  globalForDb.asamsDb = db;
}

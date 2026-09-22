import fs from "node:fs";
import path from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import { config as loadEnv } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "@/prisma/contract";

// The postgres runtime's timestamptz codec reads/writes through the global
// Temporal API (TC39 proposal), which this Node version doesn't implement
// natively yet ("RUNTIME.TEMPORAL_UNAVAILABLE" otherwise).
const globalForTemporal = globalThis as unknown as { Temporal?: typeof Temporal };
if (typeof globalForTemporal.Temporal === "undefined") {
  globalForTemporal.Temporal = Temporal;
}

// `next dev`/`next build` auto-load .env.development.local/.env.local, but
// this module is also imported directly by plain `tsx` scripts (prisma/seed.ts,
// scripts/qa-test-runner) that get no such loading - mirrors
// prisma.config.ts's explicit load, in the same precedence order. A no-op
// under Next.js since it never overrides already-set vars.
loadEnv({ path: [".env.development.local", ".env.local", ".env"] });

// Prisma 8's "contract" toolchain has no classic PrismaClient - see
// prisma/README.md. contract.json is read with fs instead of an ESM
// `with { type: "json" }` import attribute so this module works the same
// way under both Next.js's bundler and a plain `tsx` script (prisma/seed.ts).
const contractJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "prisma", "contract.json"), "utf-8"),
);

// DATABASE_URL is the Neon Postgres connection string (matches
// prisma.config.ts); the postgres runtime takes it verbatim as `url`,
// unlike the sqlite runtime which wanted a stripped filesystem path.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// Reused across hot reloads in dev so `next dev` doesn't open a new
// connection pool on every edit (same reasoning as the classic
// `globalThis.prisma` singleton pattern).
const globalForDb = globalThis as unknown as { asamsDb?: ReturnType<typeof postgres<Contract>> };

const client = globalForDb.asamsDb ?? postgres<Contract>({ contractJson, url: databaseUrl });

if (process.env.NODE_ENV !== "production") {
  globalForDb.asamsDb = client;
}

// The sqlite runtime's sole namespace was the synthetic "__unbound__" id,
// which its own package type-flattens onto `.orm` (`db.orm.Animal`). Postgres
// has real schemas, so its contract declares an actual "public" namespace and
// `client.orm` stays namespaced (`client.orm.public.Animal`) - every store in
// this codebase was written against the flat shape, so re-derive it here
// once instead of touching every `db.orm.<Model>` call site.
export const db = {
  orm: client.orm.public,
  close: () => client.close(),
};

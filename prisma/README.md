# Prisma 8 in this project

The installed `prisma` CLI (8.0.0-rc.15) is **not** the classic
`schema.prisma` + `PrismaClient` tool. It's Prisma's new "Developer
Platform" CLI, built around a *contract* instead of a schema, and it has
no `prisma generate` / `prisma migrate dev` commands at all - see
`prisma --help`.

## What's different here

- **No `datasource`/`generator` blocks.** `prisma/contract.prisma` is just
  `model` blocks. The database connection lives in `prisma.config.ts`
  instead.
- **`prisma orm init --target`** only offers `postgres` and `mongodb`.
  SQLite isn't wired into the guided wizard, but the `@prisma/orm-sqlite`
  package is real and published - this project uses it directly
  (`prisma.config.ts` + `lib/db/client.ts`), just hand-assembled instead
  of scaffolded.
- **Commands:** `prisma contract emit` (regenerate `contract.json`/
  `contract.d.ts` from `contract.prisma`) and `prisma db update` (apply
  the contract to the live database) replace `migrate dev`/`db push`.
  `npm run db:update` runs both. Both `contract.json`/`contract.d.ts` and
  `migrations/` are committed to git (like a lockfile - see the
  Prisma-authored `prisma-8.md` quick reference this CLI can regenerate
  via `prisma orm init`).
- **Query API is a fluent builder, not classic `PrismaClient` methods:**
  `db.orm.User.create({ ...fields })` (flat fields, no `data:` wrapper),
  `db.orm.User.where({ email }).first()` / `.all()` (there's no top-level
  `findMany()`), `.where({ id }).update({ ...patch })`,
  `.where({ id }).delete()`, and `db.orm.User.upsert({ create, update,
  conflictOn? })` (`conflictOn` defaults to the primary key).
- **The sqlite runtime wants `path`, not a `file:` URL:**
  `sqlite({ contractJson, path: "./prisma/dev.db" })`. `lib/db/client.ts`
  strips the `file:` prefix from `DATABASE_URL` for this reason.
- Primary keys need to be `String @id` (no `@default(autoincrement())`) -
  an `Int @id @default(autoincrement())` column failed `prisma db update`
  against sqlite in this rc build (`MIGRATION.RUNNER_FAILED`). This
  project's ids were already string-based (`U-XXXXXX`, matching the
  pre-database `generateAccountId()` helper), so it wasn't a real
  constraint here.

## Commands

```bash
npm run db:emit     # contract.prisma -> contract.json/contract.d.ts
npm run db:update    # db:emit, then apply the contract to prisma/dev.db
npm run db:seed      # recreate the PRD 4.2 demo accounts
```

`prisma/dev.db` is gitignored (local dev only, per-checkout).

import type { TimestamptzString } from "@prisma/orm-postgres/target/codec-types";

// The postgres runtime's DateTime columns are authored as
// TimestamptzString(6) (see prisma/README.md) - a nominally-branded string,
// not a plain `string`, so the ORM's create()/update() input types reject a
// plain string even though every domain type in this app already stores
// these timestamps as plain ISO strings. This just asserts the shape; it's
// a type-level cast, not a runtime conversion. (Reads need no equivalent -
// a branded string widens to `string` without a cast.)
export function toTimestamptz(value: string): TimestamptzString<6>;
export function toTimestamptz(value: string | null): TimestamptzString<6> | null;
export function toTimestamptz(
  value: string | null | undefined,
): TimestamptzString<6> | null | undefined;
export function toTimestamptz(
  value: string | null | undefined,
): TimestamptzString<6> | null | undefined {
  if (value == null) return value;
  return value as unknown as TimestamptzString<6>;
}

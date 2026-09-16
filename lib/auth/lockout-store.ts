// Lockout state (failedLoginAttempts/lockedAt) now lives on the User row
// in the database (see prisma/contract.prisma) and is enforced by
// app/api/auth/sign-in/route.ts. This module keeps the client-side
// action User Administration needs: unlocking an account (FR-UA-02).
export { LOCKOUT_THRESHOLD } from "@/lib/auth/lockout-config";

export async function unlockAccount(userId: string): Promise<void> {
  await fetch(`/api/users/${userId}/unlock`, { method: "POST" });
}

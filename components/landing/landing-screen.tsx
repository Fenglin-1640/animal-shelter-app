"use client";

import { FunctionCardGroup } from "@/components/landing/function-card";
import { useRole } from "@/lib/roles/role-context";
import { ROLE_FUNCTIONS } from "@/lib/roles/roles";

export function LandingScreen() {
  const { role } = useRole();
  const functions = ROLE_FUNCTIONS[role];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Landing Screen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as {role} (demo role, no authentication yet).
        </p>
      </div>

      <FunctionCardGroup
        heading="Administration Functions"
        items={functions.administration}
      />
      <FunctionCardGroup heading="User Functions" items={functions.user} />
    </div>
  );
}

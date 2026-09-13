"use client";

import { FunctionCardGroup } from "@/components/landing/function-card";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_FUNCTIONS } from "@/lib/roles/roles";

export function LandingScreen() {
  const { user } = useAuth();
  if (!user) return null;
  const functions = ROLE_FUNCTIONS[user.role];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Landing Screen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as {user.displayName} ({user.role}).
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

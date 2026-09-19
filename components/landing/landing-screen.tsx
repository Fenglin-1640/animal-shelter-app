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
        <h1 className="text-3xl font-bold text-text">
          Welcome back, {user.firstName} ({user.role})!
        </h1>
      </div>

      <FunctionCardGroup
        heading="Administration Functions"
        items={functions.administration}
      />
      <FunctionCardGroup heading="User Functions" items={functions.user} />
    </div>
  );
}

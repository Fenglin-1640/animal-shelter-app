"use client";

import { FunctionCardGroup } from "@/components/landing/function-card";
import { NeedsMyActionPanel } from "@/components/process/needs-my-action-panel";
import { PaymentConfirmPopup } from "@/components/process/payment-confirm-popup";
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

      {(user.role === "Administrator" || user.role === "Shelter Staff Member") && (
        <>
          {/* Hidden for Administrators; the payment popup still shows for both roles. */}
          {user.role !== "Administrator" && <NeedsMyActionPanel />}
          <PaymentConfirmPopup />
        </>
      )}

      <FunctionCardGroup
        heading="Administration Functions"
        items={functions.administration}
      />
      <FunctionCardGroup heading="User Functions" items={functions.user} />
    </div>
  );
}

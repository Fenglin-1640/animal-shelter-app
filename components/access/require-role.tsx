"use client";

import type { ReactNode } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { useAuth } from "@/lib/auth/auth-context";
import type { Role } from "@/lib/roles/roles";

// Guards a page's content by role, for the case a user reaches its URL
// directly (PRD 5.3: hidden nav entries alone aren't enough access control).
export function RequireRole({
  allowed,
  children,
}: {
  allowed: Role[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;
  if (!allowed.includes(user.role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

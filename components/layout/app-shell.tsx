"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { RoleSidebar } from "@/components/layout/role-sidebar";
import { AnimalProcessTracker } from "@/components/process/animal-process-tracker";
import { useAuth } from "@/lib/auth/auth-context";
import { useAnimalScope } from "@/lib/process/animal-scope";
import type { Role } from "@/lib/roles/roles";

// Roles that see an animal's process rail beside every animal page.
const TRACKER_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

export function AppShell({
  children,
  rightPanel,
}: {
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { status, user, signOut } = useAuth();
  const scopedAnimalId = useAnimalScope();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-text-muted">
        Loading...
      </div>
    );
  }

  const handleSignOut = () => {
    signOut();
    router.push("/sign-in");
  };

  return (
    <div className="flex min-h-screen flex-col bg-page text-text">
      <AppHeader
        onToggleNav={() => setMobileNavOpen((open) => !open)}
        onSignOut={handleSignOut}
      />
      <div className="flex flex-1">
        <RoleSidebar
          role={user.role}
          displayName={user.displayName}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
        <main className="min-w-0 flex-1 px-[5%] py-8">
          <div className="mx-auto w-full max-w-[70em]">{children}</div>
        </main>
        {rightPanel ??
          (scopedAnimalId && TRACKER_ROLES.includes(user.role) ? <AnimalProcessTracker animalId={scopedAnimalId} /> : null)}
      </div>
    </div>
  );
}

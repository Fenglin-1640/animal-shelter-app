"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { RoleSidebar } from "@/components/layout/role-sidebar";
import { useAuth } from "@/lib/auth/auth-context";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { status, user, signOut } = useAuth();
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
      </div>
    </div>
  );
}

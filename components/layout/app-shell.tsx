"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { RoleSidebar } from "@/components/layout/role-sidebar";
import { RoleProvider } from "@/lib/roles/role-context";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <RoleProvider>
      <div className="flex min-h-screen flex-col bg-page text-text">
        <AppHeader onToggleNav={() => setMobileNavOpen((open) => !open)} />
        <div className="flex flex-1">
          <RoleSidebar
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
          <main className="min-w-0 flex-1 px-[5%] py-8">
            <div className="mx-auto w-full max-w-[70em]">{children}</div>
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}

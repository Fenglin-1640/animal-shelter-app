"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { type Role } from "./roles";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  children,
  defaultRole = "Administrator",
}: {
  children: ReactNode;
  defaultRole?: Role;
}) {
  const [role, setRole] = useState<Role>(defaultRole);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

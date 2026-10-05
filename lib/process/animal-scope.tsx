"use client";

import { createContext, useContext, type ReactNode } from "react";

// Set by the shared animal layout (app/animals/[animalId]/layout.tsx) so
// AppShell knows which animal's process tracker to show at the top of
// every animal page.
const AnimalScopeContext = createContext<string | null>(null);

export function AnimalScopeProvider({ animalId, children }: { animalId: string; children: ReactNode }) {
  return <AnimalScopeContext.Provider value={animalId}>{children}</AnimalScopeContext.Provider>;
}

export function useAnimalScope(): string | null {
  return useContext(AnimalScopeContext);
}

"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { AnimalScopeProvider } from "@/lib/process/animal-scope";

// Shared layout for every animal page: scopes them to the animal so the
// app shell renders that animal's process tracker on each sub-page.
export default function AnimalLayout({ children }: { children: ReactNode }) {
  const { animalId } = useParams<{ animalId: string }>();
  return <AnimalScopeProvider animalId={animalId}>{children}</AnimalScopeProvider>;
}

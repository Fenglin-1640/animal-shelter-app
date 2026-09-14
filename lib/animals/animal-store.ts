import { MOCK_ANIMALS } from "@/lib/animals/mock-animals";
import type { Animal } from "@/lib/animals/types";

// Animals created via Finalise Intake (FR-INT-03), kept separate from the
// static PRD 12.1 seed animals. Persisted to localStorage since there is
// no backend.
const STORAGE_KEY = "asams-created-animals";

function loadCreatedAnimals(): Animal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Animal[]) : [];
  } catch {
    return [];
  }
}

function saveCreatedAnimals(animals: Animal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(animals));
}

export function addAnimal(animal: Animal) {
  saveCreatedAnimals([...loadCreatedAnimals(), animal]);
}

export function getAllAnimals(): Animal[] {
  return [...MOCK_ANIMALS, ...loadCreatedAnimals()];
}

export function getAnimalById(animalId: string): Animal | undefined {
  return getAllAnimals().find((a) => a.animalId === animalId);
}

export function generateShelterId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${year}-${suffix}`;
}

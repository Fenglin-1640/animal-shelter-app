import { MOCK_ANIMALS } from "@/lib/animals/mock-animals";
import type { Animal } from "@/lib/animals/types";

// Animals created via Finalise Intake (FR-INT-03), kept separate from the
// static PRD 12.1 seed animals. Persisted to localStorage since there is
// no backend.
const STORAGE_KEY = "asams-created-animals";

// Field-level edits (e.g. microchipNumber written back by Scan Microchip,
// FR-MC-01) layered on top of a base record - same overlay pattern as
// lib/user-administration/directory-store.ts, needed because the 10 PRD
// 12.1 seed animals are static imports, not localStorage-backed records
// that could otherwise be mutated in place.
const OVERRIDES_KEY = "asams-animal-overrides";

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

function loadOverrides(): Record<string, Partial<Animal>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Partial<Animal>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function addAnimal(animal: Animal) {
  saveCreatedAnimals([...loadCreatedAnimals(), animal]);
}

export function updateAnimal(animalId: string, patch: Partial<Animal>) {
  const overrides = loadOverrides();
  overrides[animalId] = { ...overrides[animalId], ...patch };
  saveOverrides(overrides);
}

export function getAllAnimals(): Animal[] {
  const overrides = loadOverrides();
  return [...MOCK_ANIMALS, ...loadCreatedAnimals()].map((animal) =>
    overrides[animal.animalId] ? { ...animal, ...overrides[animal.animalId] } : animal,
  );
}

export function getAnimalById(animalId: string): Animal | undefined {
  return getAllAnimals().find((a) => a.animalId === animalId);
}

export function generateShelterId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${year}-${suffix}`;
}

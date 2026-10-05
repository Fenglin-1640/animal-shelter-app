// A Veterinarian's microchip implant task, created when Scan Microchip
// finds no chip (see app/api/microchip-implants). The number is assigned
// up front, so the Vet implants a chip carrying exactly that number.
export interface MicrochipImplantTask {
  id: string;
  animalId: string;
  assignedNumber: string;
  status: "Pending" | "Completed";
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  completedByEmail?: string;
  completedByName?: string;
  completedAt?: string;
}

export interface MicrochipImplantRow {
  id: string;
  animalId: string;
  assignedNumber: string;
  status: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  completedByEmail: string | null;
  completedByName: string | null;
  completedAt: string | null;
}

export function toMicrochipImplantTask(row: MicrochipImplantRow): MicrochipImplantTask {
  return {
    id: row.id,
    animalId: row.animalId,
    assignedNumber: row.assignedNumber,
    status: row.status === "Completed" ? "Completed" : "Pending",
    createdByEmail: row.createdByEmail,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    completedByEmail: row.completedByEmail ?? undefined,
    completedByName: row.completedByName ?? undefined,
    completedAt: row.completedAt ?? undefined,
  };
}

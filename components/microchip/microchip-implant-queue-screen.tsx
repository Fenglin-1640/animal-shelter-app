"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { NeedsActionLabel } from "@/components/process/needs-action-label";
import { useAuth } from "@/lib/auth/auth-context";
import { getAllAnimals } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { listMicrochipImplants } from "@/lib/microchip/store";
import type { MicrochipImplantTask } from "@/lib/microchip/implant";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

interface Row {
  task: MicrochipImplantTask;
  animal: Animal | undefined;
}

// Animals awaiting a microchip implant (Scan Microchip found no chip).
// Two list requests in parallel, joined here.
function MicrochipImplantQueueContent({ isVet }: { isVet: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMicrochipImplants({ status: "Pending" }), getAllAnimals()]).then(([tasks, animals]) => {
      if (cancelled) return;
      const byId = new Map(animals.map((a) => [a.animalId, a]));
      setRows(
        tasks
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((task) => ({ task, animal: byId.get(task.animalId) })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Microchip Implants</h1>
        <p className="mt-1 text-sm text-text-muted">
          Animals awaiting a microchip implant. Each has a number assigned already; implant it, then record the
          vaccination and desexing in the same session.
        </p>
      </div>
      {rows === null ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No animals are awaiting a microchip implant.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ task, animal }) => (
            <li key={task.id}>
              <Link
                href={`/animals/${task.animalId}/microchip-implant`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {animal?.name ?? task.animalId}
                    {animal ? ` · ${animal.shelterId}` : ""}
                  </p>
                  <p className="text-xs text-text-muted">
                    Microchip {task.assignedNumber} &middot; requested{" "}
                    {new Date(task.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </p>
                </div>
                {isVet ? <NeedsActionLabel label="Implant microchip" /> : <span className="text-xs text-text-muted">Waiting on Veterinarian</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MicrochipImplantQueueScreen() {
  const { user } = useAuth();
  if (!user) return null;
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <MicrochipImplantQueueContent isVet={user.role === "Veterinarian"} />
    </AppShell>
  );
}

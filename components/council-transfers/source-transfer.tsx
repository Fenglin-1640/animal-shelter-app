"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/shared/http";

type SourceTransfer = { id: string; foundLocation: string; submittedByName: string };

// "Source transfer" for an animal that came from a Council Transfer
// (Administrator, Shelter Staff, Veterinarian). Plain text: the transfer
// page itself is only open to the Council Officer who submitted it.
export function SourceTransferField({ animalId }: { animalId: string }) {
  const [transfer, setTransfer] = useState<SourceTransfer | null>(null);
  useEffect(() => {
    let cancelled = false;
    getJson<{ ok?: boolean; transfer?: SourceTransfer | null }>(`/api/animals/${encodeURIComponent(animalId)}/source-transfer`).then((r) => {
      if (!cancelled) setTransfer(r.ok && r.transfer ? r.transfer : null);
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);
  if (!transfer) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Source transfer</dt>
      <dd className="text-sm text-text">
        {transfer.id} &middot; {transfer.foundLocation} ({transfer.submittedByName})
      </dd>
    </div>
  );
}

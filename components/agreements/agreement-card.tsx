import Link from "next/link";
import { AnimalThumbnail } from "@/components/shared/animal-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { AGREEMENT_STATUS_CATEGORY, getAgreementStatus } from "@/lib/agreements/status";
import type { AdoptionAgreement } from "@/lib/agreements/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function AgreementCard({ agreement }: { agreement: AdoptionAgreement }) {
  const status = getAgreementStatus(agreement.isSigned);

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <AnimalThumbnail animalId={agreement.animalId} species={agreement.animalSpecies} className="w-full sm:w-32" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text">{agreement.animalName}</h3>
            <p className="text-xs text-text-muted">
              {agreement.agreementId} &middot; {agreement.agreementVersion}
            </p>
          </div>
          <StatusChip label={status} category={AGREEMENT_STATUS_CATEGORY[status]} />
        </div>
        <p className="text-sm text-text">{agreement.adoptionConditions}</p>
        <p className="text-sm text-text-muted">
          Return policy: {agreement.returnPolicyPeriod}
        </p>
        <p className="text-sm text-text-muted">
          Generated {formatDate(agreement.generatedAt)}
          {agreement.signedDate ? ` · Signed ${formatDate(agreement.signedDate)}` : ""}
        </p>
      </div>

      <div className="flex items-start sm:items-center">
        <Link
          href={`/my-agreements/${agreement.applicationId}`}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          {agreement.isSigned ? "View Agreement" : "Review and Sign"}
        </Link>
      </div>
    </article>
  );
}

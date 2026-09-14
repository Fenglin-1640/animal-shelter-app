import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { AGREEMENT_STATUS_CATEGORY, getAgreementStatus } from "@/lib/agreements/status";
import type { AdopterAgreement } from "@/lib/agreements/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function AgreementCard({ agreement }: { agreement: AdopterAgreement }) {
  const status = getAgreementStatus(agreement.isSigned);
  const action = agreement.isSigned
    ? { label: "View Agreement", disabledReason: "Agreement document viewing is not built yet" }
    : { label: "Sign Agreement", disabledReason: "Online agreement signing is not built yet" };

  return (
    <article className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row">
      <PlaceholderThumbnail species={agreement.animalSpecies} className="w-full sm:w-32" />

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
        {agreement.nextStep && <p className="text-sm text-text">{agreement.nextStep}</p>}
      </div>

      <div className="flex items-start sm:items-center">
        <button
          type="button"
          disabled
          title={action.disabledReason}
          className="h-9 whitespace-nowrap rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.label}
        </button>
      </div>
    </article>
  );
}

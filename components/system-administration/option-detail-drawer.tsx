"use client";

import { useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import type { Species } from "@/lib/animals/types";
import { setRetired, updateOption } from "@/lib/system-administration/store";
import { OPTION_STATUS_CATEGORY } from "@/lib/system-administration/status";
import type { DropdownOption } from "@/lib/system-administration/types";
import { useSpeciesOptions } from "@/lib/system-administration/use-species";
import { VaccineMetadataFields } from "@/components/system-administration/vaccine-metadata-fields";
import { parseAntigenList, resolveVaccineType } from "@/lib/medical/vaccine-model";
import { formatDateTime } from "@/lib/shared/dates";

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function OptionDetailDrawer({
  option,
  onClose,
  onSaved,
}: {
  option: DropdownOption;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isBreed = option.category === "Breed and Description";
  const isVaccine = option.category === "Vaccine Type";
  const speciesOptions = useSpeciesOptions();
  const [applicableSpecies, setApplicableSpecies] = useState<string[]>(option.applicableSpecies ?? []);
  const [covers, setCovers] = useState((option.coversAntigens ?? []).join(", "));
  const resolved = isVaccine && speciesOptions.length > 0 ? resolveVaccineType(option, speciesOptions) : null;
  const [value, setValue] = useState(option.value);
  const [description, setDescription] = useState(option.description);
  const [speciesId, setSpeciesId] = useState<Species | "">(option.speciesId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    if (!value.trim() || !description.trim() || (isBreed && !speciesId)) {
      setError("Value, description" + (isBreed ? " and species are" : " is") + " required.");
      return;
    }

    setIsSaving(true);
    const result = await updateOption(option.id, {
      value,
      description,
      speciesId: isBreed && speciesId ? speciesId : undefined,
      ...(isVaccine ? { applicableSpecies, coversAntigens: parseAntigenList(covers) } : {}),
    });
    setIsSaving(false);

    if (!result.ok) {
      setError(
        result.reason === "duplicate"
          ? "This value already exists in this category."
          : result.reason === "invalid"
            ? result.message
            : "Option not found.",
      );
      return;
    }

    setMessage("Changes saved.");
    onSaved();
  };

  const handleToggleRetired = async () => {
    setError(null);
    setIsRetiring(true);
    const result = await setRetired(option.id, !option.isRetired);
    setIsRetiring(false);

    if (!result.ok) {
      setError(
        result.reason === "locked"
          ? "This option is required by the system and cannot be retired."
          : "Option not found.",
      );
      return;
    }

    setMessage(option.isRetired ? "Option restored." : "Option retired.");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close option details"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-y-0 right-0 w-[380px] max-w-[90vw] overflow-y-auto border-l border-border bg-page p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-sm font-semibold text-text">Option Details</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close option details"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-text">{option.value}</h2>
            <p className="text-sm text-text-muted">{option.category}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip
                label={option.isRetired ? "Retired" : "Active"}
                category={OPTION_STATUS_CATEGORY[option.isRetired ? "Retired" : "Active"]}
              />
              {option.systemLocked && (
                <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-active px-2 py-0.5 text-xs text-text-muted">
                  System Locked
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 rounded-[12px] border border-border bg-surface p-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Created</dt>
              <dd className="text-sm text-text">{formatDateTime(option.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Last Updated</dt>
              <dd className="text-sm text-text">{formatDateTime(option.updatedAt)}</dd>
            </div>
            {resolved && (
              <>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Applicable species</dt>
                  <dd className="text-sm text-text">
                    {resolved.speciesIds.length > 0
                      ? resolved.speciesIds.map((id) => speciesOptions.find((s) => s.id === id)?.value ?? id).join(", ")
                      : "None - not offered to Veterinarians"}
                    {resolved.source === "built-in" && resolved.speciesIds.length > 0 ? " (built-in default)" : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Covers (antigens)</dt>
                  <dd className="text-sm text-text">
                    {resolved.antigenLabels.join(", ")}
                    {resolved.source === "built-in" ? " (built-in default)" : !option.coversAntigens?.length ? " (named after the value)" : ""}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-3">
            <h3 className="text-sm font-bold text-text">Edit</h3>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-option-value" className="text-xs font-semibold text-text-muted">
                Value
              </label>
              <input
                id="edit-option-value"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-option-description" className="text-xs font-semibold text-text-muted">
                Description
              </label>
              <textarea
                id="edit-option-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-[12px] border border-border bg-page px-2 py-1.5 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>

            {isBreed && (
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-option-species" className="text-xs font-semibold text-text-muted">
                  Species
                </label>
                <select
                  id="edit-option-species"
                  value={speciesId}
                  onChange={(e) => setSpeciesId(e.target.value as Species)}
                  className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <option value="">Select</option>
                  {speciesOptions.filter((s) => !s.isRetired || s.value === speciesId).map((s) => (
                    <option key={s.id} value={s.value}>{s.value}</option>
                  ))}
                </select>
              </div>
            )}

            {isVaccine && (
              <VaccineMetadataFields
                idPrefix="edit-option"
                option={option}
                speciesOptions={speciesOptions}
                applicableSpecies={applicableSpecies}
                onSpeciesChange={setApplicableSpecies}
                covers={covers}
                onCoversChange={setCovers}
              />
            )}

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-text">
                {message}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleToggleRetired}
                disabled={isRetiring || (option.systemLocked && !option.isRetired)}
                title={
                  option.systemLocked && !option.isRetired
                    ? "This option is required by the system and cannot be retired."
                    : undefined
                }
                className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetiring ? "Saving..." : option.isRetired ? "Restore Option" : "Retire Option"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

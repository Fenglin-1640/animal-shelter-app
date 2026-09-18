"use client";

import { useState, type FormEvent } from "react";
import type { Species } from "@/lib/animals/types";
import { createOption } from "@/lib/system-administration/store";
import type { DropdownCategory } from "@/lib/system-administration/types";

const SPECIES_OPTIONS: Species[] = ["Cat", "Dog", "Bird", "Reptile"];

export function CreateOptionDialog({
  category,
  onClose,
  onCreated,
}: {
  category: DropdownCategory;
  onClose: () => void;
  onCreated: () => void;
}) {
  const isBreed = category === "Breed and Description";
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [speciesId, setSpeciesId] = useState<Species | "">("");
  const [errors, setErrors] = useState<{ value?: string; description?: string; speciesId?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors: typeof errors = {};
    if (!value.trim()) nextErrors.value = "Value is required.";
    if (!description.trim()) nextErrors.description = "Description is required.";
    if (isBreed && !speciesId) nextErrors.speciesId = "Species is required.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await createOption({
      category,
      value,
      description,
      speciesId: isBreed && speciesId ? speciesId : undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(
        isBreed
          ? "This value already exists for the selected species."
          : "This value already exists in this category.",
      );
      return;
    }

    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close add option dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[420px] rounded-[12px] border border-border bg-surface p-6 shadow-[0_8px_28px_rgba(20,18,32,0.25)]">
        <h2 className="text-lg font-bold text-text">Add Option</h2>
        <p className="mt-1 text-sm text-text-muted">Category: {category}</p>

        {formError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="option-value" className="text-sm font-semibold text-text">
              Value <span aria-hidden="true">*</span>
            </label>
            <input
              id="option-value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.value ? "border-danger" : "border-border"}`}
            />
            {errors.value && <p className="text-sm text-danger">{errors.value}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="option-description" className="text-sm font-semibold text-text">
              Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="option-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.description ? "border-danger" : "border-border"}`}
            />
            {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
          </div>

          {isBreed && (
            <div className="flex flex-col gap-1">
              <label htmlFor="option-species" className="text-sm font-semibold text-text">
                Species <span aria-hidden="true">*</span>
              </label>
              <select
                id="option-species"
                value={speciesId}
                onChange={(e) => setSpeciesId(e.target.value as Species)}
                className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.speciesId ? "border-danger" : "border-border"}`}
              >
                <option value="">Select</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.speciesId && <p className="text-sm text-danger">{errors.speciesId}</p>}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 flex-1 rounded-[12px] bg-primary text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? "Adding..." : "Add Option"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

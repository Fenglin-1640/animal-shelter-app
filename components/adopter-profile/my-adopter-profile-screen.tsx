"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { getAdopterProfile, saveAdopterProfile } from "@/lib/adopter-profile/store";
import type { AdopterProfile } from "@/lib/adopter-profile/types";
import {
  HOME_OWNERSHIP_OPTIONS,
  HOURS_ALONE_OPTIONS,
  HOUSEHOLD_TYPES,
} from "@/lib/adopter-profile/options";
import type { Species } from "@/lib/animals/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Adopter"];
const PREFERRED_SPECIES_OPTIONS: Species[] = ["Cat", "Dog", "Bird", "Reptile"];
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  residentialAddress?: string;
  householdType?: string;
  homeOwnership?: string;
  landlordPermission?: string;
  adultsInHousehold?: string;
  childrenInHousehold?: string;
  existingPetDetails?: string;
  environmentDetails?: string;
  hoursAlone?: string;
  preferredSpecies?: string;
  refereeName?: string;
  refereeRelationship?: string;
  refereePhone?: string;
  refereeEmail?: string;
  refereeConsent?: string;
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-2 rounded-[12px] border border-border-strong bg-surface-active px-3 py-2 text-sm text-text"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {message}
    </div>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function MyAdopterProfileContent({ email }: { email: string }) {
  const [profile, setProfile] = useState<AdopterProfile | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdopterProfile(email).then((result) => {
      if (!cancelled) setProfile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const addressRef = useRef<HTMLTextAreaElement>(null);
  const householdTypeRef = useRef<HTMLSelectElement>(null);
  const homeOwnershipRef = useRef<HTMLSelectElement>(null);
  const landlordPermissionRef = useRef<HTMLInputElement>(null);
  const adultsRef = useRef<HTMLInputElement>(null);
  const childrenRef = useRef<HTMLInputElement>(null);
  const existingPetDetailsRef = useRef<HTMLTextAreaElement>(null);
  const environmentDetailsRef = useRef<HTMLTextAreaElement>(null);
  const hoursAloneRef = useRef<HTMLSelectElement>(null);
  const preferredSpeciesRef = useRef<HTMLDivElement>(null);
  const refereeNameRef = useRef<HTMLInputElement>(null);
  const refereeRelationshipRef = useRef<HTMLInputElement>(null);
  const refereePhoneRef = useRef<HTMLInputElement>(null);
  const refereeEmailRef = useRef<HTMLInputElement>(null);
  const refereeConsentRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Partial<Record<keyof FieldErrors, React.RefObject<HTMLElement | null>>> = {
    residentialAddress: addressRef,
    householdType: householdTypeRef,
    homeOwnership: homeOwnershipRef,
    landlordPermission: landlordPermissionRef,
    adultsInHousehold: adultsRef,
    childrenInHousehold: childrenRef,
    existingPetDetails: existingPetDetailsRef,
    environmentDetails: environmentDetailsRef,
    hoursAlone: hoursAloneRef,
    preferredSpecies: preferredSpeciesRef,
    refereeName: refereeNameRef,
    refereeRelationship: refereeRelationshipRef,
    refereePhone: refereePhoneRef,
    refereeEmail: refereeEmailRef,
    refereeConsent: refereeConsentRef,
  };

  if (profile === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }

  const focusField = (field: keyof FieldErrors) => {
    fieldRefs[field]?.current?.focus();
  };

  const updateField = <K extends keyof AdopterProfile>(key: K, value: AdopterProfile[K]) => {
    setProfile({ ...profile, [key]: value });
  };

  const toggleSpecies = (species: Species) => {
    const has = profile.preferredSpecies.includes(species);
    setProfile({
      ...profile,
      preferredSpecies: has
        ? profile.preferredSpecies.filter((s) => s !== species)
        : [...profile.preferredSpecies, species],
    });
  };

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [keyof FieldErrors, string] => Boolean(entry[1]),
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);

    const nextErrors: FieldErrors = {};
    if (!profile.residentialAddress.trim()) {
      nextErrors.residentialAddress = "Residential address is required.";
    }
    if (!profile.householdType) {
      nextErrors.householdType = "Household type is required.";
    }
    if (!profile.homeOwnership) {
      nextErrors.homeOwnership = "Home ownership status is required.";
    }
    if (profile.homeOwnership === "Rent" && !profile.landlordPermission) {
      nextErrors.landlordPermission = "Landlord permission is required when renting.";
    }

    const adults = Number(profile.adultsInHousehold);
    if (!profile.adultsInHousehold.trim() || !Number.isInteger(adults) || adults < 1) {
      nextErrors.adultsInHousehold = "Enter the number of adults (1 or more).";
    }
    const children = Number(profile.childrenInHousehold);
    if (!profile.childrenInHousehold.trim() || !Number.isInteger(children) || children < 0) {
      nextErrors.childrenInHousehold = "Enter the number of children (0 or more).";
    }

    if (profile.hasExistingPets && !profile.existingPetDetails.trim()) {
      nextErrors.existingPetDetails = "Describe your existing pets.";
    }
    if (!profile.environmentDetails.trim()) {
      nextErrors.environmentDetails =
        "Describe your fencing or indoor environment for a pet.";
    }
    if (!profile.hoursAlone) {
      nextErrors.hoursAlone = "Select the typical hours an animal would be alone.";
    }
    if (profile.preferredSpecies.length === 0) {
      nextErrors.preferredSpecies = "Select at least one preferred species.";
    }

    const refereeFieldsFilled = [
      profile.refereeName,
      profile.refereeRelationship,
      profile.refereePhone,
      profile.refereeEmail,
    ].some((value) => value.trim());

    if (refereeFieldsFilled || profile.refereeConsent) {
      if (!profile.refereeName.trim()) nextErrors.refereeName = "Referee name is required.";
      if (!profile.refereeRelationship.trim()) {
        nextErrors.refereeRelationship = "Referee relationship is required.";
      }
      if (!profile.refereePhone.trim()) {
        nextErrors.refereePhone = "Referee phone is required.";
      } else if (!PHONE_PATTERN.test(profile.refereePhone.trim())) {
        nextErrors.refereePhone = "Enter a valid phone number.";
      }
      if (!profile.refereeEmail.trim()) {
        nextErrors.refereeEmail = "Referee email is required.";
      } else if (!EMAIL_PATTERN.test(profile.refereeEmail.trim())) {
        nextErrors.refereeEmail = "Enter a valid email address.";
      }
      if (!profile.refereeConsent) {
        nextErrors.refereeConsent =
          "Consent is required to store and contact your referee.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const order: (keyof FieldErrors)[] = [
        "residentialAddress", "householdType", "homeOwnership", "landlordPermission",
        "adultsInHousehold", "childrenInHousehold", "existingPetDetails",
        "environmentDetails", "hoursAlone", "preferredSpecies",
        "refereeName", "refereeRelationship", "refereePhone", "refereeEmail", "refereeConsent",
      ];
      const firstInvalid = order.find((field) => nextErrors[field]);
      if (firstInvalid) focusField(firstInvalid);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    await new Promise((resolve) => setTimeout(resolve, 250));

    const toSave: AdopterProfile = {
      ...profile,
      refereeConsentAt: profile.refereeConsent
        ? (profile.refereeConsentAt ?? new Date().toISOString())
        : undefined,
    };
    await saveAdopterProfile(email, toSave);
    setProfile(toSave);
    setIsSubmitting(false);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to Landing Screen
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">My Adopter Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          This information is used to assess your household when you submit
          an adoption application. Staff can only view it while processing
          your own application. Editing your profile after an application is
          submitted does not change that application&apos;s saved snapshot.
        </p>
      </div>

      {errorEntries.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex gap-2 rounded-[12px] border border-danger bg-danger/10 px-3 py-3 text-sm text-text"
        >
          <AlertIcon />
          <ul className="flex flex-col gap-1">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <button
                  type="button"
                  onClick={() => focusField(field)}
                  className="text-left underline underline-offset-2 hover:no-underline"
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Household</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="residentialAddress" className="text-sm font-semibold text-text">
                Residential Address <span aria-hidden="true">*</span>
              </label>
              <textarea
                ref={addressRef}
                id="residentialAddress"
                rows={2}
                value={profile.residentialAddress}
                onChange={(e) => updateField("residentialAddress", e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(errors.residentialAddress)}
                className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.residentialAddress ? "border-danger" : "border-border"}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="householdType" className="text-sm font-semibold text-text">
                  Household Type <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={householdTypeRef}
                  id="householdType"
                  value={profile.householdType}
                  onChange={(e) => updateField("householdType", e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.householdType)}
                  className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.householdType ? "border-danger" : "border-border"}`}
                >
                  <option value="">Select</option>
                  {HOUSEHOLD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="homeOwnership" className="text-sm font-semibold text-text">
                  Home Ownership <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={homeOwnershipRef}
                  id="homeOwnership"
                  value={profile.homeOwnership}
                  onChange={(e) => updateField("homeOwnership", e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.homeOwnership)}
                  className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.homeOwnership ? "border-danger" : "border-border"}`}
                >
                  <option value="">Select</option>
                  {HOME_OWNERSHIP_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {profile.homeOwnership === "Rent" && (
              <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-page p-3">
                <label className="flex items-start gap-2 text-sm text-text">
                  <input
                    ref={landlordPermissionRef}
                    type="checkbox"
                    checked={profile.landlordPermission}
                    onChange={(e) => updateField("landlordPermission", e.target.checked)}
                    aria-invalid={Boolean(errors.landlordPermission)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                  I have permission from my landlord to keep pets.{" "}
                  <span aria-hidden="true">*</span>
                </label>
                <div>
                  <button
                    type="button"
                    disabled
                    title="Uploading proof of landlord permission is not available yet"
                    className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Upload Proof
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="adultsInHousehold" className="text-sm font-semibold text-text">
                  Adults in Household <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={adultsRef}
                  id="adultsInHousehold"
                  type="number"
                  min={0}
                  value={profile.adultsInHousehold}
                  onChange={(e) => updateField("adultsInHousehold", e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.adultsInHousehold)}
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.adultsInHousehold ? "border-danger" : "border-border"}`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="childrenInHousehold" className="text-sm font-semibold text-text">
                  Children in Household <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={childrenRef}
                  id="childrenInHousehold"
                  type="number"
                  min={0}
                  value={profile.childrenInHousehold}
                  onChange={(e) => updateField("childrenInHousehold", e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.childrenInHousehold)}
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.childrenInHousehold ? "border-danger" : "border-border"}`}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Pets &amp; Environment</h2>
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={profile.hasExistingPets}
                onChange={(e) => updateField("hasExistingPets", e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              I have existing pets.
            </label>

            {profile.hasExistingPets && (
              <div className="flex flex-col gap-1">
                <label htmlFor="existingPetDetails" className="text-sm font-semibold text-text">
                  Existing Pet Details <span aria-hidden="true">*</span>
                </label>
                <textarea
                  ref={existingPetDetailsRef}
                  id="existingPetDetails"
                  rows={2}
                  value={profile.existingPetDetails}
                  onChange={(e) => updateField("existingPetDetails", e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.existingPetDetails)}
                  className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.existingPetDetails ? "border-danger" : "border-border"}`}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="environmentDetails" className="text-sm font-semibold text-text">
                Fencing or Indoor Environment <span aria-hidden="true">*</span>
              </label>
              <textarea
                ref={environmentDetailsRef}
                id="environmentDetails"
                rows={2}
                value={profile.environmentDetails}
                onChange={(e) => updateField("environmentDetails", e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(errors.environmentDetails)}
                className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.environmentDetails ? "border-danger" : "border-border"}`}
              />
            </div>

            <div className="flex flex-col gap-1 sm:max-w-xs">
              <label htmlFor="hoursAlone" className="text-sm font-semibold text-text">
                Typical Hours Animal Would Be Alone <span aria-hidden="true">*</span>
              </label>
              <select
                ref={hoursAloneRef}
                id="hoursAlone"
                value={profile.hoursAlone}
                onChange={(e) => updateField("hoursAlone", e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(errors.hoursAlone)}
                className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.hoursAlone ? "border-danger" : "border-border"}`}
              >
                <option value="">Select</option>
                {HOURS_ALONE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Adoption Preferences</h2>
          <div ref={preferredSpeciesRef} tabIndex={-1} className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-semibold text-text">
              Preferred Species <span aria-hidden="true">*</span>
            </span>
            <div className="flex flex-wrap gap-4">
              {PREFERRED_SPECIES_OPTIONS.map((species) => (
                <label key={species} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={profile.preferredSpecies.includes(species)}
                    onChange={() => toggleSpecies(species)}
                    className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                  {species}
                </label>
              ))}
            </div>
            {errors.preferredSpecies && (
              <p className="text-sm text-danger">{errors.preferredSpecies}</p>
            )}
          </div>
        </section>

        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Referee</h2>
          <p className="mt-1 text-sm text-text-muted">
            Optional until you need one for an application. If you provide
            any referee details, all fields and consent are required.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="refereeName" className="text-sm font-semibold text-text">
                Referee Name
              </label>
              <input
                ref={refereeNameRef}
                id="refereeName"
                type="text"
                value={profile.refereeName}
                onChange={(e) => updateField("refereeName", e.target.value)}
                aria-invalid={Boolean(errors.refereeName)}
                className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.refereeName ? "border-danger" : "border-border"}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="refereeRelationship" className="text-sm font-semibold text-text">
                Relationship
              </label>
              <input
                ref={refereeRelationshipRef}
                id="refereeRelationship"
                type="text"
                value={profile.refereeRelationship}
                onChange={(e) => updateField("refereeRelationship", e.target.value)}
                aria-invalid={Boolean(errors.refereeRelationship)}
                className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.refereeRelationship ? "border-danger" : "border-border"}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="refereePhone" className="text-sm font-semibold text-text">
                Phone
              </label>
              <input
                ref={refereePhoneRef}
                id="refereePhone"
                type="tel"
                value={profile.refereePhone}
                onChange={(e) => updateField("refereePhone", e.target.value)}
                aria-invalid={Boolean(errors.refereePhone)}
                className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.refereePhone ? "border-danger" : "border-border"}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="refereeEmail" className="text-sm font-semibold text-text">
                Email
              </label>
              <input
                ref={refereeEmailRef}
                id="refereeEmail"
                type="email"
                value={profile.refereeEmail}
                onChange={(e) => updateField("refereeEmail", e.target.value)}
                aria-invalid={Boolean(errors.refereeEmail)}
                className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.refereeEmail ? "border-danger" : "border-border"}`}
              />
            </div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-text">
            <input
              ref={refereeConsentRef}
              type="checkbox"
              checked={profile.refereeConsent}
              onChange={(e) => updateField("refereeConsent", e.target.checked)}
              aria-invalid={Boolean(errors.refereeConsent)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            I consent to ASAMS storing my referee&apos;s details and
            contacting them as part of my adoption application.
          </label>
        </section>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Adopter Profile"}
          </button>
        </div>

        {saved && <SuccessBanner message="Adopter profile saved." />}
      </form>
    </div>
  );
}

export function MyAdopterProfileScreen() {
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
      <MyAdopterProfileContent email={user.email} />
    </AppShell>
  );
}

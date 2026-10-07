"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getActiveTitleOptions } from "@/lib/options/titles";
import { formatDateTime } from "@/lib/shared/dates";

const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-2 rounded-[12px] border border-border-strong bg-surface-active px-3 py-2 text-sm text-text"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-primary"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {message}
    </div>
  );
}

interface ContactErrors {
  title?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function ContactDetailsForm() {
  const { user, updateProfile } = useAuth();
  const titleRef = useRef<HTMLSelectElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(user?.title ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActiveTitleOptions().then((result) => {
      if (!cancelled) setTitleOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedAt(null);

    const nextErrors: ContactErrors = {};
    if (!title) nextErrors.title = "Title is required.";
    if (!firstName.trim()) nextErrors.firstName = "First name is required.";
    if (!lastName.trim()) nextErrors.lastName = "Last name is required.";
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      nextErrors.phone = "Phone number is required.";
    } else if (!PHONE_PATTERN.test(trimmedPhone)) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.title) titleRef.current?.focus();
      else if (nextErrors.firstName) firstNameRef.current?.focus();
      else if (nextErrors.lastName) lastNameRef.current?.focus();
      else phoneRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    await updateProfile({ title, firstName, lastName, phone: trimmedPhone });
    setIsSubmitting(false);
    setSavedAt(Date.now());
  };

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Contact Details</h2>
      <p className="mt-1 text-sm text-text-muted">
        Keep your name and phone number up to date.
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-email" className="text-sm font-semibold text-text">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={user.email}
            readOnly
            disabled
            className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text-muted"
          />
          <p className="text-sm text-text-muted">
            Contact an Administrator to change the email on your account.
          </p>
        </div>

        <div className="grid grid-cols-[6.5rem_1fr] gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-title" className="text-sm font-semibold text-text">
              Title <span aria-hidden="true">*</span>
            </label>
            <select
              ref={titleRef}
              id="profile-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "profile-title-error" : undefined}
              className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                errors.title ? "border-danger" : "border-border"
              }`}
            >
              <option value="">Select</option>
              {titleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.title && (
              <p id="profile-title-error" className="text-sm text-danger">
                {errors.title}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-first-name" className="text-sm font-semibold text-text">
              First Name <span aria-hidden="true">*</span>
            </label>
            <input
              ref={firstNameRef}
              id="profile-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={
                errors.firstName ? "profile-first-name-error" : undefined
              }
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                errors.firstName ? "border-danger" : "border-border"
              }`}
            />
            {errors.firstName && (
              <p id="profile-first-name-error" className="text-sm text-danger">
                {errors.firstName}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="profile-last-name" className="text-sm font-semibold text-text">
            Last Name <span aria-hidden="true">*</span>
          </label>
          <input
            ref={lastNameRef}
            id="profile-last-name"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={
              errors.lastName ? "profile-last-name-error" : undefined
            }
            className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              errors.lastName ? "border-danger" : "border-border"
            }`}
          />
          {errors.lastName && (
            <p id="profile-last-name-error" className="text-sm text-danger">
              {errors.lastName}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="profile-phone" className="text-sm font-semibold text-text">
            Phone <span aria-hidden="true">*</span>
          </label>
          <input
            ref={phoneRef}
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "profile-phone-error" : undefined}
            className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              errors.phone ? "border-danger" : "border-border"
            }`}
          />
          {errors.phone && (
            <p id="profile-phone-error" className="text-sm text-danger">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Contact Details"}
          </button>
        </div>

        {savedAt && <SuccessBanner message="Contact details updated." />}
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedAt(null);

    const nextErrors: PasswordErrors = {};
    if (!currentPassword) {
      nextErrors.currentPassword = "Current password is required.";
    }
    if (!newPassword) {
      nextErrors.newPassword = "New password is required.";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "New password must be at least 8 characters.";
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your new password.";
    } else if (newPassword && confirmPassword !== newPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.currentPassword) currentRef.current?.focus();
      else if (nextErrors.newPassword) newRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    const result = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrors({ currentPassword: "Current password is incorrect." });
      currentRef.current?.focus();
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSavedAt(Date.now());
  };

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [keyof PasswordErrors, string] => Boolean(entry[1]),
  );

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Change Password</h2>
      <p className="mt-1 text-sm text-text-muted">
        Choose a new password of at least 8 characters.
      </p>

      {errorEntries.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 flex gap-2 rounded-[12px] border border-danger bg-danger/10 px-3 py-3 text-sm text-text"
        >
          <AlertIcon />
          <ul className="flex flex-col gap-1">
            {errorEntries.map(([, message], index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="current-password" className="text-sm font-semibold text-text">
            Current Password <span aria-hidden="true">*</span>
          </label>
          <input
            ref={currentRef}
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.currentPassword)}
            className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              errors.currentPassword ? "border-danger" : "border-border"
            }`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="new-password" className="text-sm font-semibold text-text">
            New Password <span aria-hidden="true">*</span>
          </label>
          <input
            ref={newRef}
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.newPassword)}
            className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              errors.newPassword ? "border-danger" : "border-border"
            }`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-password" className="text-sm font-semibold text-text">
            Confirm New Password <span aria-hidden="true">*</span>
          </label>
          <input
            ref={confirmRef}
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              errors.confirmPassword ? "border-danger" : "border-border"
            }`}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Updating..." : "Update Password"}
          </button>
        </div>

        {savedAt && <SuccessBanner message="Password updated." />}
      </form>
    </section>
  );
}

export function ProfileScreen() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to Landing Screen
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">My Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          View your account details and update your contact information or
          password.
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Role
            </dt>
            <dd className="text-sm text-text">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Status
            </dt>
            <dd className="text-sm text-text">{user.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Signed Up
            </dt>
            <dd className="text-sm text-text">
              {formatDateTime(user.signUpAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Last Login
            </dt>
            <dd className="text-sm text-text">
              {formatDateTime(user.lastLoginAt)}
            </dd>
          </div>
        </dl>
      </section>

      <ContactDetailsForm />
      <ChangePasswordForm />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SimpleHeader } from "@/components/layout/simple-header";
import { useAuth } from "@/lib/auth/auth-context";
import { getActiveTitleOptions, getInitialTitleOptions } from "@/lib/options/titles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

interface FieldErrors {
  title?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  consent?: string;
  form?: string;
}

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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SignUpScreen() {
  const { signUp } = useAuth();

  const titleRef = useRef<HTMLSelectElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [titleOptions, setTitleOptions] = useState<string[]>(getInitialTitleOptions);

  useEffect(() => {
    // Sign Up isn't gated behind an auth-loading state (unlike My Profile
    // etc.), so it can be server-rendered with real content. Start from
    // the deterministic seed list (matches server output) and correct to
    // the live, possibly-retired-aware list once mounted client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only correction to avoid an SSR/localStorage hydration mismatch.
    setTitleOptions(getActiveTitleOptions());
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{
    accountId: string;
    email: string;
  } | null>(null);

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [keyof FieldErrors, string] => Boolean(entry[1]),
  );

  const fieldRefs: Partial<
    Record<keyof FieldErrors, React.RefObject<HTMLElement | null>>
  > = {
    title: titleRef,
    firstName: firstNameRef,
    lastName: lastNameRef,
    email: emailRef,
    phone: phoneRef,
    password: passwordRef,
    consent: consentRef,
  };

  const focusField = (field: keyof FieldErrors) => {
    fieldRefs[field]?.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!title) nextErrors.title = "Title is required.";
    if (!firstName.trim()) nextErrors.firstName = "First name is required.";
    if (!lastName.trim()) nextErrors.lastName = "Last name is required.";

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      nextErrors.phone = "Phone number is required.";
    } else if (!PHONE_PATTERN.test(trimmedPhone)) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (!consent) {
      nextErrors.consent =
        "You must agree to the privacy notice to create an account.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalid = (
        Object.keys(fieldRefs) as (keyof FieldErrors)[]
      ).find((field) => nextErrors[field]);
      if (firstInvalid) focusField(firstInvalid);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const result = await signUp({
      title,
      firstName,
      lastName,
      email: trimmedEmail,
      phone: trimmedPhone,
      password,
    });
    setIsSubmitting(false);

    if (result.ok) {
      setCreatedAccount({ accountId: result.accountId, email: trimmedEmail });
      return;
    }

    setErrors({
      email:
        "An account with this email already exists. Try signing in instead.",
      form: "An account with this email already exists. Try signing in instead.",
    });
    emailRef.current?.focus();
  };

  if (createdAccount) {
    return (
      <div className="flex min-h-screen flex-col bg-page text-text">
        <SimpleHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[400px] rounded-[12px] border border-border bg-surface p-6 text-center shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface-active text-primary">
              <CheckIcon />
            </div>
            <h1 className="mt-3 text-xl font-bold text-text">
              Account Created
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Account ID: <span className="font-mono">{createdAccount.accountId}</span>
            </p>
            <p className="mt-3 text-sm text-text">
              Your Adopter account for{" "}
              <span className="font-mono">{createdAccount.email}</span> is
              active. Sign in to continue.
            </p>
            <Link
              href={`/sign-in?email=${encodeURIComponent(createdAccount.email)}`}
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90"
            >
              Continue to Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-text">
      <SimpleHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px]">
          <div className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <h1 className="text-xl font-bold text-text">Sign Up</h1>
            <p className="mt-1 text-sm text-text-muted">
              Create an Adopter account to browse and apply for adoption.
            </p>

            {errorEntries.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 flex gap-2 rounded-[12px] border border-danger bg-danger/10 px-3 py-3 text-sm text-text"
              >
                <AlertIcon />
                <ul className="flex flex-col gap-1">
                  {errorEntries.map(([field, message]) =>
                    field === "form" ? (
                      <li key={field}>{message}</li>
                    ) : (
                      <li key={field}>
                        <button
                          type="button"
                          onClick={() => focusField(field)}
                          className="underline underline-offset-2 hover:no-underline"
                        >
                          {message}
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="title"
                    className="text-sm font-semibold text-text"
                  >
                    Title <span aria-hidden="true">*</span>
                  </label>
                  <select
                    ref={titleRef}
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? "title-error" : undefined}
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
                    <p id="title-error" className="text-sm text-danger">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="firstName"
                    className="text-sm font-semibold text-text"
                  >
                    First Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={firstNameRef}
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={
                      errors.firstName ? "firstName-error" : undefined
                    }
                    className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      errors.firstName ? "border-danger" : "border-border"
                    }`}
                  />
                  {errors.firstName && (
                    <p id="firstName-error" className="text-sm text-danger">
                      {errors.firstName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="lastName"
                  className="text-sm font-semibold text-text"
                >
                  Last Name <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={lastNameRef}
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.lastName)}
                  aria-describedby={
                    errors.lastName ? "lastName-error" : undefined
                  }
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    errors.lastName ? "border-danger" : "border-border"
                  }`}
                />
                {errors.lastName && (
                  <p id="lastName-error" className="text-sm text-danger">
                    {errors.lastName}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-text"
                >
                  Email <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    errors.email ? "border-danger" : "border-border"
                  }`}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-danger">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="phone"
                  className="text-sm font-semibold text-text"
                >
                  Phone <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={phoneRef}
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    errors.phone ? "border-danger" : "border-border"
                  }`}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-sm text-danger">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-text"
                >
                  Password <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : "password-hint"
                  }
                  className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    errors.password ? "border-danger" : "border-border"
                  }`}
                />
                {errors.password ? (
                  <p id="password-error" className="text-sm text-danger">
                    {errors.password}
                  </p>
                ) : (
                  <p id="password-hint" className="text-sm text-text-muted">
                    At least 8 characters.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="flex items-start gap-2 text-sm text-text">
                  <input
                    ref={consentRef}
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.consent)}
                    aria-describedby={
                      errors.consent ? "consent-error" : undefined
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                  <span>
                    I have read and agree to the ASAMS Privacy Notice.{" "}
                    <span aria-hidden="true">*</span>
                  </span>
                </label>
                {errors.consent && (
                  <p id="consent-error" className="text-sm text-danger">
                    {errors.consent}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-10 rounded-[12px] bg-primary text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

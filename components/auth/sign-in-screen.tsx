"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SimpleHeader } from "@/components/layout/simple-header";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo-accounts";
import { useAuth } from "@/lib/auth/auth-context";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
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

export function SignInScreen({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const { signIn } = useAuth();
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [keyof FieldErrors, string] => Boolean(entry[1]),
  );

  const focusField = (field: keyof FieldErrors) => {
    if (field === "email") emailRef.current?.focus();
    if (field === "password") passwordRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const nextErrors: FieldErrors = {};

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!trimmedPassword) {
      nextErrors.password = "Password is required.";
    }

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      focusField(nextErrors.email ? "email" : "password");
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const result = await signIn(trimmedEmail, trimmedPassword);
    setIsSubmitting(false);

    if (result.ok) {
      router.push("/");
      return;
    }

    if (result.reason === "invalid") {
      setErrors({
        password: "Incorrect email or password.",
        form: `Incorrect email or password. ${result.attemptsRemaining} attempt${
          result.attemptsRemaining === 1 ? "" : "s"
        } remaining before this account is locked.`,
      });
      passwordRef.current?.focus();
      return;
    }

    if (result.reason === "locked") {
      setErrors({
        form: "This account is locked after 6 failed sign-in attempts. Contact an Administrator to unlock it.",
      });
      return;
    }

    setErrors({
      form: "This account is inactive. Contact an Administrator for access.",
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-page text-text">
      <SimpleHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <h1 className="text-xl font-bold text-text">Sign In</h1>
            <p className="mt-1 text-sm text-text-muted">
              Sign in to ASAMS to continue.
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
                  autoComplete="username"
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
                  htmlFor="password"
                  className="text-sm font-semibold text-text"
                >
                  Password <span aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    className={`h-10 w-full rounded-[12px] border bg-page px-3 pr-10 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      errors.password ? "border-danger" : "border-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text"
                  >
                    {showPassword ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-danger">
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-10 rounded-[12px] bg-primary text-sm font-semibold text-page transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              Sign Up
            </Link>
          </p>

          <div className="mt-4 rounded-[12px] border border-border bg-surface p-4 text-xs text-text-muted">
            <p className="font-semibold text-text">Prototype demo accounts</p>
            <p className="mt-1">
              Shared password for every account:{" "}
              <span className="font-mono">{DEMO_PASSWORD}</span>
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <span className="font-mono">{account.email}</span> &middot;{" "}
                  {account.role}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

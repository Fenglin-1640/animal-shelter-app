"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getActiveTitleOptions } from "@/lib/options/titles";
import { ROLES, type Role } from "@/lib/roles/roles";
import { getActiveValues } from "@/lib/system-administration/store";
import { createDirectoryUser } from "@/lib/user-administration/directory-store";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

// Administrator is never creatable here (PRD 4.1: only reachable via
// transferring from an existing Active user); other roles are excluded
// if retired in System Administration's "User Role" category.
async function getCreatableRoles(): Promise<Exclude<Role, "Administrator">[]> {
  const active = new Set(await getActiveValues("User Role"));
  return ROLES.filter(
    (role): role is Exclude<Role, "Administrator"> =>
      role !== "Administrator" && active.has(role),
  );
}

interface FieldErrors {
  title?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export function CreateUserDialog({
  createdBy,
  onClose,
  onCreated,
}: {
  createdBy: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Exclude<Role, "Administrator">>("Adopter");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [creatableRoles, setCreatableRoles] = useState<Exclude<Role, "Administrator">[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActiveTitleOptions().then((result) => {
      if (!cancelled) setTitleOptions(result);
    });
    getCreatableRoles().then((result) => {
      if (!cancelled) setCreatableRoles(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

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

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const result = await createDirectoryUser({
      title,
      firstName,
      lastName,
      email: trimmedEmail,
      phone: trimmedPhone,
      role,
      status,
      createdBy,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError("An account with this email already exists.");
      return;
    }

    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close create user dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-[440px] rounded-[12px] border border-border bg-surface p-6 shadow-[0_8px_28px_rgba(20,18,32,0.25)]">
        <h2 className="text-lg font-bold text-text">Add User</h2>
        <p className="mt-1 text-sm text-text-muted">
          Creates an Active account with the shared prototype password.
        </p>

        {formError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="create-user-title" className="text-sm font-semibold text-text">
                Title <span aria-hidden="true">*</span>
              </label>
              <select
                id="create-user-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`h-10 rounded-[12px] border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.title ? "border-danger" : "border-border"}`}
              >
                <option value="">Select</option>
                {titleOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {errors.title && <p className="text-sm text-danger">{errors.title}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="create-user-first-name" className="text-sm font-semibold text-text">
                First Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="create-user-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.firstName ? "border-danger" : "border-border"}`}
              />
              {errors.firstName && <p className="text-sm text-danger">{errors.firstName}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="create-user-last-name" className="text-sm font-semibold text-text">
              Last Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="create-user-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.lastName ? "border-danger" : "border-border"}`}
            />
            {errors.lastName && <p className="text-sm text-danger">{errors.lastName}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="create-user-email" className="text-sm font-semibold text-text">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="create-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.email ? "border-danger" : "border-border"}`}
            />
            {errors.email && <p className="text-sm text-danger">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="create-user-phone" className="text-sm font-semibold text-text">
              Phone <span aria-hidden="true">*</span>
            </label>
            <input
              id="create-user-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${errors.phone ? "border-danger" : "border-border"}`}
            />
            {errors.phone && <p className="text-sm text-danger">{errors.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="create-user-role" className="text-sm font-semibold text-text">
                Role <span aria-hidden="true">*</span>
              </label>
              <select
                id="create-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<Role, "Administrator">)}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {creatableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="create-user-status" className="text-sm font-semibold text-text">
                Status <span aria-hidden="true">*</span>
              </label>
              <select
                id="create-user-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 flex-1 rounded-[12px] bg-primary text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create User"}
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

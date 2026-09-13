"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useAuth } from "@/lib/auth/auth-context";

function SignInPageContent() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-text-muted">
        Loading...
      </div>
    );
  }

  return <SignInScreen initialEmail={searchParams.get("email") ?? ""} />;
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page text-text-muted">
          Loading...
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}

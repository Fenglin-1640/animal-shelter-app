"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useAuth } from "@/lib/auth/auth-context";

export default function SignInPage() {
  const { status } = useAuth();
  const router = useRouter();

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

  return <SignInScreen />;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignUpScreen } from "@/components/auth/sign-up-screen";
import { useAuth } from "@/lib/auth/auth-context";

export default function SignUpPage() {
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

  return <SignUpScreen />;
}

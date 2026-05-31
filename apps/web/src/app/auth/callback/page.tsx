"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";

/**
 * OAuth redirect target. The AuthProvider (mounted in the root layout) calls
 * `client.init()` on mount, which detects the `code`/`state` query params here,
 * completes the token exchange, and establishes the session. Once auth is no
 * longer loading, we bounce back to the compose page.
 */
export default function AuthCallback() {
  const { loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace("/compose");
  }, [loading, router]);

  return <p>Completing sign-in…</p>;
}

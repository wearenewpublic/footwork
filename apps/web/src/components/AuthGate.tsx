"use client";
import { useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { agent, loading, signIn } = useAuth();
  const [handle, setHandle] = useState("");

  if (loading) return <p>Loading…</p>;
  if (agent) return <>{children}</>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(handle.trim());
      }}
    >
      <label>
        Sign in with your handle:{" "}
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alice.bsky.social" />
      </label>
      <button type="submit">Sign in</button>
    </form>
  );
}

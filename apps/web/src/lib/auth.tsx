"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { Agent } from "@atproto/api";
import { SCOPE } from "./oauth";

interface AuthState {
  agent: Agent | null;
  did: string | null;
  loading: boolean;
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

let _clientPromise: Promise<BrowserOAuthClient> | null = null;
function getClient(): Promise<BrowserOAuthClient> {
  if (!_clientPromise) {
    const origin = window.location.origin;
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
    const clientId = isLocal
      ? `http://localhost?scope=${encodeURIComponent(SCOPE)}&redirect_uri=${encodeURIComponent(`http://127.0.0.1:${window.location.port}/auth/callback`)}`
      : `${origin}/client-metadata.json`;
    _clientPromise = BrowserOAuthClient.load({ clientId, handleResolver: "https://bsky.social" });
  }
  return _clientPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // AT Protocol OAuth requires the loopback host 127.0.0.1, not localhost.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      window.location.replace(window.location.href.replace("localhost", "127.0.0.1"));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") return;
    (async () => {
      try {
        const client = await getClient();
        const result = await client.init();
        if (result?.session) {
          setAgent(new Agent(result.session));
          setDid(result.session.did);
        }
      } catch (err) {
        console.error("auth restore failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (handle: string) => {
    const client = await getClient();
    await client.signIn(handle, { scope: SCOPE });
  }, []);

  const signOut = useCallback(async () => {
    setAgent(null);
    setDid(null);
  }, []);

  return (
    <AuthContext.Provider value={{ agent, did, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

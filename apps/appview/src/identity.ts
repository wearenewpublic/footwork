import { IdResolver } from "@atproto/identity";
import type { Db } from "./db";
import type { Actor } from "./types";

/** Minimal shape of a DID document we care about. */
interface DidDoc {
  alsoKnownAs?: string[];
  service?: { id: string; type: string; serviceEndpoint: string }[];
}

/** Low-level DID resolver function (injectable for tests). */
export type DidResolveFn = (did: string) => Promise<DidDoc | null>;

const defaultIdResolver = new IdResolver();
export const defaultResolve: DidResolveFn = (did) => defaultIdResolver.did.resolve(did);

function handleFromDoc(doc: DidDoc): string | null {
  const aka = doc.alsoKnownAs?.find((u) => u.startsWith("at://"));
  return aka ? aka.slice("at://".length) : null;
}
function pdsFromDoc(doc: DidDoc): string | null {
  const svc = doc.service?.find((s) => s.type === "AtprotoPersonalDataServer");
  return svc?.serviceEndpoint ?? null;
}

/** Resolve a DID to an Actor, caching in the actors table. Never throws. */
export async function resolveActor(
  db: Db,
  did: string,
  resolve: DidResolveFn = defaultResolve,
): Promise<Actor> {
  const cached = db.getActor(did);
  if (cached) return cached;

  let actor: Actor = { did, handle: null, pds: null };
  try {
    const doc = await resolve(did);
    if (doc) actor = { did, handle: handleFromDoc(doc), pds: pdsFromDoc(doc) };
  } catch {
    // Leave actor as the null-fields fallback.
  }
  db.putActor(actor);
  return actor;
}

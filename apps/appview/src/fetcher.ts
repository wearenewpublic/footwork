import type { Db } from "./db";
import { resolveActor } from "./identity";
import type { FetchRecord } from "./hydrate";

/** Parse an at:// URI into { did, collection, rkey }. */
export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  return m ? { did: m[1], collection: m[2], rkey: m[3] } : null;
}

/** Low-level XRPC getRecord call (injectable for tests). */
export type HttpGetRecord = (
  pds: string,
  repo: string,
  collection: string,
  rkey: string,
) => Promise<{ uri: string; cid: string; value: Record<string, unknown> } | null>;

/** Real HTTP implementation using fetch against a PDS. */
export const httpGetRecord: HttpGetRecord = async (pds, repo, collection, rkey) => {
  const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set("repo", repo);
  url.searchParams.set("collection", collection);
  url.searchParams.set("rkey", rkey);
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as { uri: string; cid: string; value: Record<string, unknown> };
};

/**
 * Build a production FetchRecord: resolve the referent DID's PDS, then call
 * getRecord against it. Returns null if the PDS is unknown or the record is missing.
 */
export function makePdsFetcher(db: Db, httpGet: HttpGetRecord = httpGetRecord): FetchRecord {
  return async (uri: string) => {
    const parts = parseAtUri(uri);
    if (!parts) return null;
    const actor = await resolveActor(db, parts.did);
    if (!actor.pds) return null;
    const got = await httpGet(actor.pds, parts.did, parts.collection, parts.rkey);
    if (!got) return null;
    return { cid: got.cid, value: got.value };
  };
}

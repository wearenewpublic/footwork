/**
 * One-off repo backfill: index a repo's guide/save records directly from its
 * PDS into the AppView, bypassing the firehose. Use to recover records missed
 * while Jetstream was down or beyond its replay window.
 *
 *   APPVIEW_DB=appview.sqlite tsx scripts/backfill.ts <handle-or-did>
 */
import { openDb } from "../src/db";
import { backfillRepo, BACKFILL_COLLECTIONS, type RepoRecord } from "../src/backfill";

async function resolveDid(handleOrDid: string): Promise<string> {
  if (handleOrDid.startsWith("did:")) return handleOrDid;
  const res = await fetch(
    `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handleOrDid)}`,
  );
  const body = (await res.json()) as { did?: string };
  if (!body.did) throw new Error(`could not resolve handle: ${handleOrDid}`);
  return body.did;
}

async function resolvePds(did: string): Promise<string> {
  const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
  const doc = (await res.json()) as { service?: { id: string; serviceEndpoint: string }[] };
  const svc = doc.service?.find((s) => s.id === "#atproto_pds");
  if (!svc?.serviceEndpoint) throw new Error(`no PDS endpoint for ${did}`);
  return svc.serviceEndpoint;
}

async function listAll(pds: string, did: string, collection: string): Promise<RepoRecord[]> {
  const out: RepoRecord[] = [];
  let cursor: string | undefined;
  do {
    const u = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
    u.searchParams.set("repo", did);
    u.searchParams.set("collection", collection);
    u.searchParams.set("limit", "100");
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u);
    if (!res.ok) throw new Error(`listRecords ${collection} failed: ${res.status}`);
    const body = (await res.json()) as { records?: RepoRecord[]; cursor?: string };
    for (const r of body.records ?? []) out.push({ uri: r.uri, cid: r.cid, value: r.value });
    cursor = body.cursor;
  } while (cursor);
  return out;
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: tsx scripts/backfill.ts <handle-or-did>");
    process.exit(1);
  }
  const did = await resolveDid(target);
  const pds = await resolvePds(did);
  console.log(`backfilling ${did} from ${pds}`);
  const db = openDb(process.env.APPVIEW_DB ?? "appview.sqlite");
  const n = await backfillRepo(db, did, BACKFILL_COLLECTIONS, (c) => listAll(pds, did, c));
  console.log(`indexed ${n} records across ${BACKFILL_COLLECTIONS.length} collections`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import { applyEvent } from "./ingest";
import type { CommitEvent } from "./types";

/** Collections the AppView indexes (mirrors jetstream's WANTED). */
export const BACKFILL_COLLECTIONS = [ids.TownRoundaboutGuideDocument, ids.TownRoundaboutGuideSave];

/** A record as returned by com.atproto.repo.listRecords. */
export interface RepoRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

function rkeyFromUri(uri: string): string | null {
  const m = /^at:\/\/[^/]+\/[^/]+\/([^/]+)$/.exec(uri);
  return m ? m[1] : null;
}

/** Turn listRecords output into the create CommitEvents the ingest path expects. */
export function recordsToEvents(did: string, collection: string, records: RepoRecord[]): CommitEvent[] {
  const out: CommitEvent[] = [];
  for (const r of records) {
    const rkey = rkeyFromUri(r.uri);
    if (!rkey) continue;
    out.push({ did, collection, rkey, operation: "create", cid: r.cid, record: r.value });
  }
  return out;
}

export type ListRecords = (collection: string) => Promise<RepoRecord[]>;

/**
 * Index a repo's records directly from its PDS (source of truth), bypassing the
 * firehose — for recovering records published while Jetstream was down/beyond
 * its replay window. Reuses the live ingest path (`applyEvent`), so CID
 * verification still happens on read. Returns the number of records applied.
 */
export async function backfillRepo(
  db: Db,
  did: string,
  collections: string[],
  list: ListRecords,
): Promise<number> {
  let count = 0;
  for (const collection of collections) {
    const records = await list(collection);
    for (const ce of recordsToEvents(did, collection, records)) {
      applyEvent(db, ce);
      count++;
    }
  }
  return count;
}

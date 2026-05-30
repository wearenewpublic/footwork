import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import { atUri, type CommitEvent } from "./types";

/**
 * Apply a normalized commit event to the database. Indexes only guide documents
 * and saves; everything else is ignored. Referenced place/event records are NOT
 * indexed here — they are hydrated on read (see hydrate.ts).
 */
export function applyEvent(db: Db, e: CommitEvent): void {
  const uri = atUri(e.did, e.collection, e.rkey);

  if (e.collection === ids.TownRoundaboutGuideDocument) {
    if (e.operation === "delete") {
      db.deleteDocument(uri);
      return;
    }
    if (!e.record || !e.cid) return;
    db.putDocument({ uri, cid: e.cid, did: e.did, rkey: e.rkey, record: e.record });
    return;
  }

  if (e.collection === ids.TownRoundaboutGuideSave) {
    if (e.operation === "delete") {
      db.deleteSave(uri);
      return;
    }
    if (!e.record) return;
    const subject = e.record.subject as { uri?: string; cid?: string } | undefined;
    if (!subject?.uri || !subject?.cid) return;
    db.putSave({ uri, did: e.did, subjectUri: subject.uri, subjectCid: subject.cid });
    return;
  }
  // Unknown collection: ignore.
}

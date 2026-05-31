import { Jetstream } from "@skyware/jetstream";
import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import { applyEvent } from "./ingest";
import type { CommitEvent } from "./types";

const WANTED = [ids.TownRoundaboutGuideDocument, ids.TownRoundaboutGuideSave];

/** Pure mapping from a jetstream event to our normalized CommitEvent (or null). */
export function toCommitEvent(evt: {
  did?: string;
  kind?: string;
  commit?: {
    operation?: string;
    collection?: string;
    rkey?: string;
    cid?: string;
    record?: Record<string, unknown>;
  };
}): CommitEvent | null {
  if (evt.kind !== "commit" || !evt.commit || !evt.did) return null;
  const { operation, collection, rkey, cid, record } = evt.commit;
  if (!operation || !collection || !rkey) return null;
  return {
    did: evt.did,
    collection,
    rkey,
    operation: operation as CommitEvent["operation"],
    cid,
    record,
  };
}

/**
 * Start consuming Jetstream, applying events and persisting the cursor.
 * `startCursor` (unix microseconds) overrides the persisted cursor — useful to
 * replay recent events (e.g. to backfill records missed while down). Returns the
 * Jetstream instance.
 */
export function startJetstream(db: Db, startCursor?: number): Jetstream {
  const persisted = db.getCursor();
  const cursor = startCursor ?? (persisted ? Number(persisted) : undefined);
  // Cast WANTED to satisfy the typed tuple constraint; our collection strings are valid
  // Collection values but not in the @atcute/lexicons ambient Records, so a minimal
  // cast is needed.
  const js = new Jetstream({
    wantedCollections: WANTED as unknown as Array<"town.roundabout.guide.document">,
    cursor,
  });

  // Cast the event to `any` since our collections resolve to custom string literals
  // outside the known @atcute/lexicons Records; toCommitEvent handles the normalization.
  js.on("commit", (evt) => {
    const ce = toCommitEvent(evt as any);
    if (ce) applyEvent(db, ce);
    const timeUs = (evt as any).time_us;
    if (timeUs) db.setCursor(String(timeUs));
  });

  // Without an "error" listener, an EventEmitter "error" (e.g. a transient network
  // drop) is rethrown and crashes the process. Log it; reconnect on close.
  js.on("error", (err: unknown) => {
    console.error("jetstream error:", err instanceof Error ? err.message : err);
  });
  js.on("close", () => {
    console.warn("jetstream connection closed; reconnecting in 2s");
    setTimeout(() => {
      try {
        js.start();
      } catch (e) {
        console.error("jetstream reconnect failed:", e);
      }
    }, 2000);
  });

  js.start();
  return js;
}

import { Jetstream } from "@skyware/jetstream";
import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import { applyEvent } from "./ingest";
import type { CommitEvent } from "./types";

const WANTED = [ids.TownRoundaboutGuideDocument, ids.TownRoundaboutGuideSave];

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

/** Next exponential-backoff delay, capped. */
export function nextBackoff(current: number): number {
  return Math.min(current * 2, MAX_BACKOFF_MS);
}

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

/** The slice of the @skyware/jetstream client we depend on (injectable for tests). */
export interface JetstreamClient {
  cursor?: number;
  on(event: string, listener: (...args: any[]) => void): unknown;
  start(): void;
  close(): void;
}

/** Creates a real Jetstream client subscribed to our collections, from a cursor. */
function defaultCreateClient(cursor?: number): JetstreamClient {
  return new Jetstream({
    // Cast WANTED to satisfy the typed tuple constraint; our collection strings are valid
    // Collection values but not in the @atcute/lexicons ambient Records, so a minimal cast is needed.
    wantedCollections: WANTED as unknown as Array<"town.roundabout.guide.document">,
    cursor,
  });
}

export interface JetstreamController {
  /** Stop consuming and cancel any pending reconnect. */
  close(): void;
}

export interface StartJetstreamOptions {
  /** Unix-microsecond cursor overriding the persisted one (replay/backfill). */
  startCursor?: number;
  /** Injectable client factory (tests). Defaults to a real Jetstream. */
  createClient?: (cursor?: number) => JetstreamClient;
}

/**
 * Consume Jetstream, applying events and persisting the cursor, with automatic
 * reconnection. On `close`/`error` the connection is re-established after an
 * exponential backoff, resuming from the last cursor — so a transient drop (e.g.
 * an idle timeout on our low-traffic subscription) loses no events, since
 * Jetstream replays everything since the cursor on reconnect.
 *
 * Reconnection is single-in-flight: only one reconnect is ever scheduled at a
 * time, and superseded clients are detached (an identity guard ignores their
 * late events) and closed — avoiding the overlapping-socket pile-up that crashed
 * the earlier naive `close -> start()` loop.
 */
export function startJetstream(db: Db, options: StartJetstreamOptions = {}): JetstreamController {
  const createClient = options.createClient ?? defaultCreateClient;
  let stopped = false;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let client: JetstreamClient | null = null;

  const lastCursor = (): number | undefined => {
    if (client?.cursor != null) return client.cursor;
    const persisted = db.getCursor();
    return persisted ? Number(persisted) : undefined;
  };

  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) return; // single in-flight
    const delay = backoff;
    backoff = nextBackoff(backoff);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      const old = client;
      connect(lastCursor());
      // The new client is now `client`; the old one's identity guard makes any
      // late close/error it emits a no-op, so closing it can't trigger a reconnect.
      try {
        old?.close();
      } catch {
        // already closed / closing — ignore
      }
    }, delay);
  };

  const connect = (cursor?: number): void => {
    const c = createClient(cursor);
    client = c;
    // Identity guard: only the current client's events take effect.
    const guard =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A): void => {
        if (client === c) fn(...args);
      };

    c.on(
      "commit",
      guard((evt: any) => {
        const ce = toCommitEvent(evt);
        if (ce) applyEvent(db, ce);
        const timeUs = evt?.time_us;
        if (timeUs) db.setCursor(String(timeUs));
      }),
    );
    c.on(
      "open",
      guard(() => {
        backoff = INITIAL_BACKOFF_MS; // healthy connection — reset backoff
      }),
    );
    c.on(
      "error",
      guard((err: unknown) => {
        console.error("jetstream error:", err instanceof Error ? err.message : err);
        scheduleReconnect();
      }),
    );
    c.on(
      "close",
      guard(() => {
        console.warn("jetstream connection closed; reconnecting");
        scheduleReconnect();
      }),
    );
    c.start();
  };

  const persisted = db.getCursor();
  connect(options.startCursor ?? (persisted ? Number(persisted) : undefined));

  return {
    close: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      client?.close();
    },
  };
}

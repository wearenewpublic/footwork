# Guides AppView (Plan 2 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/appview` service — a Hono + SQLite application that ingests `town.roundabout.guide.document` and `.save` records from Jetstream, hydrates a guide's facet references on read (fetch from the referent's PDS, **verify the CID**, cache), and serves a JSON read API. The capstone is a hermetic round-trip integration test.

**Architecture:** Clean seams for testability. Pure ingest handlers turn normalized commit events into SQLite rows; a thin `@skyware/jetstream` adapter feeds them. Hydration takes an **injectable record-fetcher** so the round-trip test runs with no network, while production composes `@atproto/identity` (DID → PDS endpoint + handle) with a plain `fetch` to `com.atproto.repo.getRecord`. CID verification is explicit: DAG-CBOR-encode the fetched record value → SHA-256 → CIDv1 (codec `0x71`), compare to the strongRef's `cid`. Read API is a Hono app reading SQLite + hydration.

**Tech Stack:** TypeScript (ESM), Hono + `@hono/node-server`, `better-sqlite3`, `@skyware/jetstream`, `@atproto/identity`, `@ipld/dag-cbor` + `multiformats`, Vitest. Consumes `@guides/lexicons` (Plan 1).

> **Decisions (vetoable on review):**
> - **SQLite via `better-sqlite3`** (synchronous, minimal concepts) with hand-written SQL — keeps the focus on atproto, not an ORM.
> - **CID verification computed explicitly** (`@ipld/dag-cbor` + `multiformats`) rather than via a wrapper — it IS the lesson. Valid because our records contain only scalar/object/array types (no blobs/cid-links), so the lex-JSON value DAG-CBOR-encodes back to the stored bytes.
> - **Cache populated by hydration only.** We subscribe Jetstream to `document` + `save` (not `place`/`event`); referenced records are fetched on read and cached. The spec's "opportunistic firehose backfill" of places is deferred (it's an optimization, not a round-trip requirement).
> - **Read API routes** `/guide/:did/:rkey`, `/guides`, `/profile/:did/saves` — avoids URL-encoding full AT-URIs in paths.
> - **Identity resolution is real but cached** in an `actors` table; on resolution failure, hydration degrades gracefully (reference marked unresolved) rather than throwing.

---

## File Structure

- `apps/appview/package.json`, `apps/appview/tsconfig.json` — manifest + config.
- `apps/appview/src/types.ts` — shared types (normalized commit event, hydrated view shapes).
- `apps/appview/src/db.ts` — `openDb` + schema + typed persistence accessors. One responsibility: storage.
- `apps/appview/src/cid.ts` — `cidForRecord(value)`: explicit DAG-CBOR → CIDv1.
- `apps/appview/src/ingest.ts` — pure `applyEvent(db, event)`: normalized commit event → SQLite rows.
- `apps/appview/src/identity.ts` — `resolveActor(db, did)`: DID → `{ did, handle, pds }`, cached.
- `apps/appview/src/hydrate.ts` — `hydrateGuide(db, doc, fetchRecord)`: resolve facet refs, verify CIDs, cache, assemble view. Plus `makePdsFetcher` (production fetcher).
- `apps/appview/src/jetstream.ts` — thin `@skyware/jetstream` adapter wiring events → `applyEvent`, with cursor persistence.
- `apps/appview/src/api.ts` — Hono app + routes; reads db + hydration.
- `apps/appview/src/server.ts` — entrypoint: open db, start jetstream, serve Hono.
- Tests alongside: `src/*.test.ts` plus `src/roundtrip.test.ts`.

---

### Task 0: Scaffold the appview app

**Files:**
- Create: `apps/appview/package.json`, `apps/appview/tsconfig.json`

- [ ] **Step 1: Create the manifest**

`apps/appview/package.json`:
```json
{
  "name": "@guides/appview",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`apps/appview/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Install dependencies (versions resolve at install time)**

Run:
```bash
cd /Users/blainecook/Code/footwork
pnpm add --filter @guides/appview @guides/lexicons@workspace:* hono @hono/node-server better-sqlite3 @skyware/jetstream @atproto/identity @ipld/dag-cbor multiformats
pnpm add --filter @guides/appview -D vitest typescript @types/node @types/better-sqlite3 tsx
```
Expected: installs succeed; `@guides/lexicons` linked via workspace. If the sandbox blocks network, retry the failing command once with `dangerouslyDisableSandbox: true`; if still no network, report BLOCKED.

- [ ] **Step 3: Verify the workspace link**

Run:
```bash
cd /Users/blainecook/Code/footwork/apps/appview
node -e "import('@guides/lexicons').then(m => console.log('lexicons ids ok:', m.ids.TownRoundaboutGuideDocument))"
```
Expected: prints `lexicons ids ok: town.roundabout.guide.document`. (If Node cannot import the TS entry directly, this is fine to skip — the real check is that `pnpm ls @guides/lexicons` shows it linked; report which you used.)

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "chore(appview): scaffold appview app"
```

---

### Task 1: Shared types

**Files:**
- Create: `apps/appview/src/types.ts`
- Test: `apps/appview/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/appview/src/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { atUri } from "./types";

describe("atUri", () => {
  it("builds an at:// URI from did, collection, rkey", () => {
    expect(atUri("did:plc:abc", "town.roundabout.guide.document", "3k")).toBe(
      "at://did:plc:abc/town.roundabout.guide.document/3k",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write the types**

`apps/appview/src/types.ts`:
```ts
/** A commit event normalized away from any specific firehose/jetstream shape. */
export interface CommitEvent {
  did: string;
  collection: string;
  rkey: string;
  operation: "create" | "update" | "delete";
  /** Present for create/update; absent for delete. */
  record?: Record<string, unknown>;
  /** Present for create/update; absent for delete. */
  cid?: string;
}

export interface Actor {
  did: string;
  handle: string | null;
  pds: string | null;
}

/** A facet reference resolved (or attempted) during hydration. */
export interface ResolvedRef {
  uri: string;
  expectedCid: string;
  /** The fetched record value, if resolution succeeded. */
  value: Record<string, unknown> | null;
  /** True if the fetched record's recomputed CID equals expectedCid. */
  verified: boolean;
}

export interface HydratedGuide {
  uri: string;
  cid: string;
  author: Actor;
  record: Record<string, unknown>;
  /** Keyed by referenced record AT-URI. */
  references: Record<string, ResolvedRef>;
}

export function atUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): shared types and atUri helper"
```

---

### Task 2: SQLite persistence layer

**Files:**
- Create: `apps/appview/src/db.ts`
- Test: `apps/appview/src/db.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/appview/src/db.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "./db";

function freshDb() {
  return openDb(":memory:");
}

describe("db persistence", () => {
  it("upserts and reads a document", () => {
    const db = openDb(":memory:");
    db.putDocument({
      uri: "at://did:plc:a/town.roundabout.guide.document/1",
      cid: "bafy1",
      did: "did:plc:a",
      rkey: "1",
      record: { title: "Hi" },
    });
    const got = db.getDocument("at://did:plc:a/town.roundabout.guide.document/1");
    expect(got?.record).toEqual({ title: "Hi" });
    expect(got?.did).toBe("did:plc:a");
  });

  it("lists documents newest first and deletes", () => {
    const db = freshDb();
    db.putDocument({ uri: "at://d/c/1", cid: "x1", did: "d", rkey: "1", record: {} });
    db.putDocument({ uri: "at://d/c/2", cid: "x2", did: "d", rkey: "2", record: {} });
    expect(db.listDocuments(10).length).toBe(2);
    db.deleteDocument("at://d/c/1");
    expect(db.listDocuments(10).length).toBe(1);
  });

  it("stores saves and lists them by did", () => {
    const db = freshDb();
    db.putSave({ uri: "at://d/s/1", did: "d", subjectUri: "at://o/c/9", subjectCid: "c9" });
    const saves = db.listSavesByDid("d");
    expect(saves.map((s) => s.subjectUri)).toEqual(["at://o/c/9"]);
  });

  it("caches and reads referenced records", () => {
    const db = freshDb();
    db.putCachedRecord({ uri: "at://o/p/1", cid: "pc", record: { name: "Tartine" } });
    expect(db.getCachedRecord("at://o/p/1")?.record).toEqual({ name: "Tartine" });
  });

  it("round-trips the cursor", () => {
    const db = freshDb();
    expect(db.getCursor()).toBeNull();
    db.setCursor("12345");
    expect(db.getCursor()).toBe("12345");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./db`.

- [ ] **Step 3: Write the persistence layer**

`apps/appview/src/db.ts`:
```ts
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, rkey TEXT NOT NULL,
  record TEXT NOT NULL, indexedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
  uri TEXT PRIMARY KEY, did TEXT NOT NULL, subjectUri TEXT NOT NULL,
  subjectCid TEXT NOT NULL, indexedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cached_records (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, record TEXT NOT NULL, fetchedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actors (
  did TEXT PRIMARY KEY, handle TEXT, pds TEXT, resolvedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cursor (id INTEGER PRIMARY KEY CHECK (id = 1), seq TEXT);
`;

export interface DocumentRow {
  uri: string;
  cid: string;
  did: string;
  rkey: string;
  record: Record<string, unknown>;
}
export interface SaveRow {
  uri: string;
  did: string;
  subjectUri: string;
  subjectCid: string;
}
export interface CachedRow {
  uri: string;
  cid: string;
  record: Record<string, unknown>;
}
export interface ActorRow {
  did: string;
  handle: string | null;
  pds: string | null;
}

export class Db {
  private db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  putDocument(r: DocumentRow): void {
    this.db
      .prepare(
        `INSERT INTO documents (uri, cid, did, rkey, record, indexedAt)
         VALUES (@uri, @cid, @did, @rkey, @record, @indexedAt)
         ON CONFLICT(uri) DO UPDATE SET cid=@cid, record=@record, indexedAt=@indexedAt`,
      )
      .run({ ...r, record: JSON.stringify(r.record), indexedAt: new Date().toISOString() });
  }
  getDocument(uri: string): DocumentRow | null {
    const row = this.db.prepare(`SELECT * FROM documents WHERE uri = ?`).get(uri) as any;
    return row ? { ...row, record: JSON.parse(row.record) } : null;
  }
  listDocuments(limit: number): DocumentRow[] {
    const rows = this.db
      .prepare(`SELECT * FROM documents ORDER BY indexedAt DESC LIMIT ?`)
      .all(limit) as any[];
    return rows.map((r) => ({ ...r, record: JSON.parse(r.record) }));
  }
  deleteDocument(uri: string): void {
    this.db.prepare(`DELETE FROM documents WHERE uri = ?`).run(uri);
  }

  putSave(r: SaveRow): void {
    this.db
      .prepare(
        `INSERT INTO saves (uri, did, subjectUri, subjectCid, indexedAt)
         VALUES (@uri, @did, @subjectUri, @subjectCid, @indexedAt)
         ON CONFLICT(uri) DO UPDATE SET subjectUri=@subjectUri, subjectCid=@subjectCid, indexedAt=@indexedAt`,
      )
      .run({ ...r, indexedAt: new Date().toISOString() });
  }
  deleteSave(uri: string): void {
    this.db.prepare(`DELETE FROM saves WHERE uri = ?`).run(uri);
  }
  listSavesByDid(did: string): SaveRow[] {
    return this.db
      .prepare(`SELECT * FROM saves WHERE did = ? ORDER BY indexedAt DESC`)
      .all(did) as SaveRow[];
  }

  putCachedRecord(r: CachedRow): void {
    this.db
      .prepare(
        `INSERT INTO cached_records (uri, cid, record, fetchedAt)
         VALUES (@uri, @cid, @record, @fetchedAt)
         ON CONFLICT(uri) DO UPDATE SET cid=@cid, record=@record, fetchedAt=@fetchedAt`,
      )
      .run({ ...r, record: JSON.stringify(r.record), fetchedAt: new Date().toISOString() });
  }
  getCachedRecord(uri: string): CachedRow | null {
    const row = this.db.prepare(`SELECT * FROM cached_records WHERE uri = ?`).get(uri) as any;
    return row ? { ...row, record: JSON.parse(row.record) } : null;
  }

  putActor(r: ActorRow): void {
    this.db
      .prepare(
        `INSERT INTO actors (did, handle, pds, resolvedAt)
         VALUES (@did, @handle, @pds, @resolvedAt)
         ON CONFLICT(did) DO UPDATE SET handle=@handle, pds=@pds, resolvedAt=@resolvedAt`,
      )
      .run({ ...r, resolvedAt: new Date().toISOString() });
  }
  getActor(did: string): ActorRow | null {
    return (this.db.prepare(`SELECT did, handle, pds FROM actors WHERE did = ?`).get(did) as ActorRow) ?? null;
  }

  getCursor(): string | null {
    const row = this.db.prepare(`SELECT seq FROM cursor WHERE id = 1`).get() as any;
    return row?.seq ?? null;
  }
  setCursor(seq: string): void {
    this.db
      .prepare(`INSERT INTO cursor (id, seq) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET seq = ?`)
      .run(seq, seq);
  }
}

export function openDb(path: string): Db {
  return new Db(path);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): SQLite persistence layer"
```

---

### Task 3: CID computation (the verification primitive)

**Files:**
- Create: `apps/appview/src/cid.ts`
- Test: `apps/appview/src/cid.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/appview/src/cid.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cidForRecord } from "./cid";

describe("cidForRecord", () => {
  it("produces a stable CIDv1 dag-cbor string", async () => {
    const cid = await cidForRecord({ a: 1, b: "two" });
    expect(cid).toMatch(/^bafyrei[a-z2-7]+$/); // CIDv1 base32 dag-cbor + sha256
  });

  it("is insensitive to key order (DAG-CBOR canonicalizes)", async () => {
    const c1 = await cidForRecord({ a: 1, b: 2 });
    const c2 = await cidForRecord({ b: 2, a: 1 });
    expect(c1).toBe(c2);
  });

  it("differs when content differs", async () => {
    const c1 = await cidForRecord({ a: 1 });
    const c2 = await cidForRecord({ a: 2 });
    expect(c1).not.toBe(c2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./cid`.

- [ ] **Step 3: Write the CID computation**

`apps/appview/src/cid.ts`:
```ts
import * as dagCbor from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

/**
 * Compute the AT Protocol "blessed" CID for a record value:
 * DAG-CBOR encode (codec 0x71) -> SHA-256 -> CIDv1.
 *
 * Valid for records containing only scalar/object/array values (our lexicons).
 * Records with blobs or cid-links would require lex->IPLD transformation first.
 */
export async function cidForRecord(value: unknown): Promise<string> {
  const bytes = dagCbor.encode(value);
  const digest = await sha256.digest(bytes);
  return CID.createV1(dagCbor.code, digest).toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): explicit DAG-CBOR CID computation"
```

---

### Task 4: Ingest handlers (pure event → rows)

**Files:**
- Create: `apps/appview/src/ingest.ts`
- Test: `apps/appview/src/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/appview/src/ingest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { applyEvent } from "./ingest";
import { ids } from "@guides/lexicons";
import type { CommitEvent } from "./types";

const baseDoc: CommitEvent = {
  did: "did:plc:a",
  collection: ids.TownRoundaboutGuideDocument,
  rkey: "1",
  operation: "create",
  cid: "bafydoc",
  record: { $type: ids.TownRoundaboutGuideDocument, title: "T", text: "x", createdAt: "2026-01-01T00:00:00Z" },
};

describe("applyEvent", () => {
  it("indexes a document create", () => {
    const db = openDb(":memory:");
    applyEvent(db, baseDoc);
    expect(db.getDocument("at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1")?.cid).toBe("bafydoc");
  });

  it("removes a document on delete", () => {
    const db = openDb(":memory:");
    applyEvent(db, baseDoc);
    applyEvent(db, { ...baseDoc, operation: "delete", record: undefined, cid: undefined });
    expect(db.listDocuments(10).length).toBe(0);
  });

  it("indexes a save create with subject strongRef", () => {
    const db = openDb(":memory:");
    applyEvent(db, {
      did: "did:plc:b",
      collection: ids.TownRoundaboutGuideSave,
      rkey: "9",
      operation: "create",
      cid: "bafysave",
      record: {
        $type: ids.TownRoundaboutGuideSave,
        subject: { uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1", cid: "bafydoc" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    expect(db.listSavesByDid("did:plc:b")[0].subjectCid).toBe("bafydoc");
  });

  it("ignores unknown collections", () => {
    const db = openDb(":memory:");
    applyEvent(db, { ...baseDoc, collection: "app.bsky.feed.post" });
    expect(db.listDocuments(10).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./ingest`.

- [ ] **Step 3: Write the ingest handlers**

`apps/appview/src/ingest.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): pure ingest handlers for documents and saves"
```

---

### Task 5: Identity resolution (DID → handle + PDS), cached

**Files:**
- Create: `apps/appview/src/identity.ts`
- Test: `apps/appview/src/identity.test.ts`

The resolver caches into the `actors` table and is injectable for testing (we pass a fake low-level DID resolver so the test needs no network).

- [ ] **Step 1: Write the failing test**

`apps/appview/src/identity.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { openDb } from "./db";
import { resolveActor } from "./identity";

const fakeDidDoc = {
  id: "did:plc:a",
  alsoKnownAs: ["at://alice.test"],
  service: [
    { id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: "https://pds.example" },
  ],
};

describe("resolveActor", () => {
  it("resolves did -> handle + pds and caches the result", async () => {
    const db = openDb(":memory:");
    const resolve = vi.fn().mockResolvedValue(fakeDidDoc);

    const a1 = await resolveActor(db, "did:plc:a", resolve);
    expect(a1).toEqual({ did: "did:plc:a", handle: "alice.test", pds: "https://pds.example" });

    // Second call is served from cache (resolver not called again).
    const a2 = await resolveActor(db, "did:plc:a", resolve);
    expect(a2).toEqual(a1);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when resolution fails", async () => {
    const db = openDb(":memory:");
    const resolve = vi.fn().mockRejectedValue(new Error("nope"));
    const a = await resolveActor(db, "did:plc:x", resolve);
    expect(a).toEqual({ did: "did:plc:x", handle: null, pds: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./identity`.

- [ ] **Step 3: Write the identity resolver**

`apps/appview/src/identity.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): cached DID -> handle/pds resolution"
```

---

### Task 6: Hydration (resolve facet refs, verify CID, cache)

**Files:**
- Create: `apps/appview/src/hydrate.ts`
- Test: `apps/appview/src/hydrate.test.ts`

Hydration extracts referenced AT-URIs from a document's facets, fetches each via an **injectable** `FetchRecord` function, verifies the recomputed CID against the facet's strongRef cid, caches verified records, and returns a `HydratedGuide`.

- [ ] **Step 1: Write the failing test**

`apps/appview/src/hydrate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { hydrateGuide, refsFromDocument } from "./hydrate";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";
import type { DocumentRow } from "./db";

const placeValue = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", createdAt: "2026-01-01T00:00:00Z" };
const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

function docWithPlaceRef(placeCid: string): DocumentRow {
  return {
    uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1",
    cid: "bafydoc",
    did: "did:plc:a",
    rkey: "1",
    record: {
      $type: ids.TownRoundaboutGuideDocument,
      title: "Mission morning",
      text: "Start at Tartine.",
      createdAt: "2026-01-01T00:00:00Z",
      facets: [
        {
          index: { byteStart: 9, byteEnd: 16 },
          features: [
            { $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: { uri: placeUri, cid: placeCid }, intent: "card" },
          ],
        },
      ],
    },
  };
}

describe("hydration", () => {
  it("extracts referenced uris+cids from facets", async () => {
    const cid = await cidForRecord(placeValue);
    const refs = refsFromDocument(docWithPlaceRef(cid).record);
    expect(refs).toEqual([{ uri: placeUri, expectedCid: cid }]);
  });

  it("resolves a ref, verifies its CID, and caches it", async () => {
    const db = openDb(":memory:");
    const cid = await cidForRecord(placeValue);
    const fetchRecord = async (uri: string) =>
      uri === placeUri ? { cid, value: placeValue } : null;

    const view = await hydrateGuide(db, docWithPlaceRef(cid), fetchRecord, {
      did: "did:plc:a",
      handle: "alice.test",
      pds: "https://pds.example",
    });

    expect(view.references[placeUri].verified).toBe(true);
    expect(view.references[placeUri].value).toEqual(placeValue);
    expect(view.author.handle).toBe("alice.test");
    // cached for next time
    expect(db.getCachedRecord(placeUri)?.record).toEqual(placeValue);
  });

  it("marks a ref unverified when the CID does not match", async () => {
    const db = openDb(":memory:");
    const correctCid = await cidForRecord(placeValue);
    // Document claims a different (wrong) cid than the fetched record actually has.
    const fetchRecord = async () => ({ cid: correctCid, value: placeValue });
    const view = await hydrateGuide(db, docWithPlaceRef("bafywrongcid"), fetchRecord, {
      did: "did:plc:a",
      handle: null,
      pds: null,
    });
    expect(view.references[placeUri].verified).toBe(false);
    // unverified records are not cached
    expect(db.getCachedRecord(placeUri)).toBeNull();
  });

  it("serves a cached ref without refetching", async () => {
    const db = openDb(":memory:");
    const cid = await cidForRecord(placeValue);
    db.putCachedRecord({ uri: placeUri, cid, record: placeValue });
    let calls = 0;
    const fetchRecord = async () => {
      calls++;
      return { cid, value: placeValue };
    };
    const view = await hydrateGuide(db, docWithPlaceRef(cid), fetchRecord, { did: "did:plc:a", handle: null, pds: null });
    expect(view.references[placeUri].verified).toBe(true);
    expect(calls).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./hydrate`.

- [ ] **Step 3: Write the hydrator**

`apps/appview/src/hydrate.ts`:
```ts
import type { Db, DocumentRow } from "./db";
import { cidForRecord } from "./cid";
import type { Actor, HydratedGuide, ResolvedRef } from "./types";

/** A fetched record from a PDS: its claimed cid and decoded value, or null if not found. */
export type FetchRecord = (
  uri: string,
) => Promise<{ cid: string; value: Record<string, unknown> } | null>;

interface RefSpec {
  uri: string;
  expectedCid: string;
}

/** Pull all strongRef (uri, cid) pairs out of a document's facet features. */
export function refsFromDocument(record: Record<string, unknown>): RefSpec[] {
  const out: RefSpec[] = [];
  const facets = (record.facets as any[]) ?? [];
  for (const facet of facets) {
    for (const feature of facet.features ?? []) {
      const ref = feature?.ref as { uri?: string; cid?: string } | undefined;
      if (ref?.uri && ref?.cid) out.push({ uri: ref.uri, expectedCid: ref.cid });
    }
  }
  return out;
}

/**
 * Resolve one reference: serve from cache if present, else fetch, recompute the
 * CID, and verify it matches the expected cid. Verified records are cached.
 */
async function resolveRef(
  db: Db,
  spec: RefSpec,
  fetchRecord: FetchRecord,
): Promise<ResolvedRef> {
  const cached = db.getCachedRecord(spec.uri);
  if (cached && cached.cid === spec.expectedCid) {
    return { uri: spec.uri, expectedCid: spec.expectedCid, value: cached.record, verified: true };
  }

  const fetched = await fetchRecord(spec.uri);
  if (!fetched) {
    return { uri: spec.uri, expectedCid: spec.expectedCid, value: null, verified: false };
  }
  const recomputed = await cidForRecord(fetched.value);
  const verified = recomputed === spec.expectedCid;
  if (verified) {
    db.putCachedRecord({ uri: spec.uri, cid: recomputed, record: fetched.value });
  }
  return {
    uri: spec.uri,
    expectedCid: spec.expectedCid,
    value: verified ? fetched.value : null,
    verified,
  };
}

/** Assemble a fully hydrated guide view. */
export async function hydrateGuide(
  db: Db,
  doc: DocumentRow,
  fetchRecord: FetchRecord,
  author: Actor,
): Promise<HydratedGuide> {
  const specs = refsFromDocument(doc.record);
  const references: Record<string, ResolvedRef> = {};
  for (const spec of specs) {
    references[spec.uri] = await resolveRef(db, spec, fetchRecord);
  }
  return { uri: doc.uri, cid: doc.cid, author, record: doc.record, references };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): hydrate facet refs with CID verification and caching"
```

---

### Task 7: Production record fetcher (identity + XRPC getRecord)

**Files:**
- Create: `apps/appview/src/fetcher.ts`
- Test: `apps/appview/src/fetcher.test.ts`

This composes identity resolution (DID → PDS) with a plain `fetch` to `com.atproto.repo.getRecord`, producing a `FetchRecord` for production. The HTTP layer is injected so the test needs no network.

- [ ] **Step 1: Write the failing test**

`apps/appview/src/fetcher.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { openDb } from "./db";
import { makePdsFetcher } from "./fetcher";
import { ids } from "@guides/lexicons";

const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

describe("makePdsFetcher", () => {
  it("resolves the pds, calls getRecord, and returns {cid,value}", async () => {
    const db = openDb(":memory:");
    db.putActor({ did: "did:plc:a", handle: "alice.test", pds: "https://pds.example" });

    const httpGet = vi.fn().mockResolvedValue({
      uri: placeUri,
      cid: "bafyplace",
      value: { $type: ids.TownRoundaboutGuidePlace, name: "Tartine" },
    });
    const fetcher = makePdsFetcher(db, httpGet);
    const got = await fetcher(placeUri);

    expect(got).toEqual({ cid: "bafyplace", value: { $type: ids.TownRoundaboutGuidePlace, name: "Tartine" } });
    // Verify it called the resolved PDS getRecord with parsed at-uri parts.
    expect(httpGet).toHaveBeenCalledWith(
      "https://pds.example",
      "did:plc:a",
      ids.TownRoundaboutGuidePlace,
      "p1",
    );
  });

  it("returns null when the pds cannot be resolved", async () => {
    const db = openDb(":memory:");
    db.putActor({ did: "did:plc:a", handle: null, pds: null });
    const httpGet = vi.fn();
    const fetcher = makePdsFetcher(db, httpGet);
    expect(await fetcher(placeUri)).toBeNull();
    expect(httpGet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./fetcher`.

- [ ] **Step 3: Write the fetcher**

`apps/appview/src/fetcher.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): production PDS record fetcher (identity + getRecord)"
```

---

### Task 8: Hono read API

**Files:**
- Create: `apps/appview/src/api.ts`
- Test: `apps/appview/src/api.test.ts`

The API is built from injected dependencies (`db`, a `FetchRecord`, and an actor resolver) so it is testable via Hono's `app.request(...)` with no network.

- [ ] **Step 1: Write the failing test**

`apps/appview/src/api.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { createApi } from "./api";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";

const placeValue = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", createdAt: "2026-01-01T00:00:00Z" };
const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

async function seed() {
  const db = openDb(":memory:");
  const placeCid = await cidForRecord(placeValue);
  db.putDocument({
    uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1",
    cid: "bafydoc",
    did: "did:plc:a",
    rkey: "1",
    record: {
      $type: ids.TownRoundaboutGuideDocument,
      title: "Mission morning",
      text: "Start at Tartine.",
      createdAt: "2026-01-01T00:00:00Z",
      facets: [
        { index: { byteStart: 9, byteEnd: 16 }, features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: { uri: placeUri, cid: placeCid }, intent: "card" }] },
      ],
    },
  });
  return { db, placeCid };
}

function app(db: any, placeCid: string) {
  const fetchRecord = async (uri: string) => (uri === placeUri ? { cid: placeCid, value: placeValue } : null);
  const resolveActorFn = async (did: string) => ({ did, handle: "alice.test", pds: "https://pds.example" });
  return createApi({ db, fetchRecord, resolveActorFn });
}

describe("read API", () => {
  it("GET /guide/:did/:rkey returns a hydrated guide", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guide/did:plc:a/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.record.title).toBe("Mission morning");
    expect(body.references[placeUri].verified).toBe(true);
    expect(body.author.handle).toBe("alice.test");
  });

  it("GET /guide/:did/:rkey returns 404 for unknown guide", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guide/did:plc:a/nope");
    expect(res.status).toBe(404);
  });

  it("GET /guides lists recent guides", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guides");
    const body = await res.json();
    expect(body.guides.length).toBe(1);
    expect(body.guides[0].uri).toContain(ids.TownRoundaboutGuideDocument);
  });

  it("GET /profile/:did/saves lists a user's saves", async () => {
    const { db, placeCid } = await seed();
    db.putSave({ uri: "at://did:plc:b/s/1", did: "did:plc:b", subjectUri: "at://did:plc:a/c/1", subjectCid: "bafydoc" });
    const res = await app(db, placeCid).request("/profile/did:plc:b/saves");
    const body = await res.json();
    expect(body.saves.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: Write the API**

`apps/appview/src/api.ts`:
```ts
import { Hono } from "hono";
import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import type { FetchRecord } from "./hydrate";
import { hydrateGuide } from "./hydrate";
import { atUri, type Actor } from "./types";

export interface ApiDeps {
  db: Db;
  fetchRecord: FetchRecord;
  resolveActorFn: (did: string) => Promise<Actor>;
}

export function createApi(deps: ApiDeps): Hono {
  const { db, fetchRecord, resolveActorFn } = deps;
  const app = new Hono();

  app.get("/guide/:did/:rkey", async (c) => {
    const uri = atUri(c.req.param("did"), ids.TownRoundaboutGuideDocument, c.req.param("rkey"));
    const doc = db.getDocument(uri);
    if (!doc) return c.json({ error: "not found" }, 404);
    const author = await resolveActorFn(doc.did);
    const view = await hydrateGuide(db, doc, fetchRecord, author);
    return c.json(view);
  });

  app.get("/guides", (c) => {
    const guides = db.listDocuments(50).map((d) => ({ uri: d.uri, did: d.did, record: d.record }));
    return c.json({ guides });
  });

  app.get("/profile/:did/saves", (c) => {
    const saves = db.listSavesByDid(c.req.param("did"));
    return c.json({ saves });
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(appview): Hono read API with injected dependencies"
```

---

### Task 9: Round-trip integration test (the capstone)

**Files:**
- Test: `apps/appview/src/roundtrip.test.ts`

This exercises the whole pipeline hermetically: a document commit event flows through `applyEvent` into SQLite, then the read API hydrates its place reference (via an in-test fetcher standing in for a PDS), verifies the CID, and returns the assembled view — proving ingest → store → hydrate → verify → serve.

- [ ] **Step 1: Write the test**

`apps/appview/src/roundtrip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { applyEvent } from "./ingest";
import { createApi } from "./api";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";
import type { CommitEvent } from "./types";

describe("round-trip: ingest -> store -> hydrate -> verify -> serve", () => {
  it("indexes a document from a commit event and serves it hydrated", async () => {
    const db = openDb(":memory:");

    // A place that lives in the author's PDS (NOT indexed by us — hydrated on read).
    const placeValue = {
      $type: ids.TownRoundaboutGuidePlace,
      name: "Tartine Bakery",
      createdAt: "2026-05-30T00:00:00.000Z",
    };
    const placeUri = "at://did:plc:author/" + ids.TownRoundaboutGuidePlace + "/p1";
    const placeCid = await cidForRecord(placeValue);

    // The document references the place by strongRef (uri + the place's real cid).
    const docEvent: CommitEvent = {
      did: "did:plc:author",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "g1",
      operation: "create",
      cid: "bafyguide",
      record: {
        $type: ids.TownRoundaboutGuideDocument,
        title: "A morning in the Mission",
        type: "list",
        text: "Start at Tartine, then walk to Dolores Park.",
        createdAt: "2026-05-30T00:00:00.000Z",
        facets: [
          {
            index: { byteStart: 9, byteEnd: 16 },
            features: [
              { $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: { uri: placeUri, cid: placeCid }, intent: "card" },
            ],
          },
        ],
      },
    };

    // 1. Ingest the commit event (as the Jetstream adapter would).
    applyEvent(db, docEvent);

    // 2. Build the API with an in-test PDS fetcher (stands in for the real PDS).
    const fetchRecord = async (uri: string) =>
      uri === placeUri ? { cid: placeCid, value: placeValue } : null;
    const resolveActorFn = async (did: string) => ({ did, handle: "author.test", pds: "https://pds.example" });
    const api = createApi({ db, fetchRecord, resolveActorFn });

    // 3. Read it back through the public API.
    const res = await api.request("/guide/did:plc:author/g1");
    expect(res.status).toBe(200);
    const body = await res.json();

    // 4. The whole round-trip is intact and the reference is CID-verified.
    expect(body.record.title).toBe("A morning in the Mission");
    expect(body.author.handle).toBe("author.test");
    expect(body.references[placeUri].verified).toBe(true);
    expect(body.references[placeUri].value.name).toBe("Tartine Bakery");

    // 5. The verified reference was cached for next time.
    expect(db.getCachedRecord(placeUri)?.record).toEqual(placeValue);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS. (This test should pass immediately given Tasks 1–8; if it fails, the failure localizes a real integration bug — fix the underlying unit, not the test.)

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "test(appview): hermetic round-trip integration test"
```

---

### Task 10: Jetstream adapter + server entrypoint

**Files:**
- Create: `apps/appview/src/jetstream.ts`
- Create: `apps/appview/src/server.ts`
- Test: `apps/appview/src/jetstream.test.ts`

The adapter is kept thin: it maps `@skyware/jetstream` events to our normalized `CommitEvent` and calls `applyEvent`, persisting the cursor. We unit-test the **mapping function** (pure, no socket); the live socket wiring is covered by the smoke run in Step 6.

- [ ] **Step 1: Write the failing test (for the pure mapping)**

`apps/appview/src/jetstream.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toCommitEvent } from "./jetstream";
import { ids } from "@guides/lexicons";

describe("toCommitEvent", () => {
  it("maps a jetstream create commit to a normalized CommitEvent", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: {
        operation: "create",
        collection: ids.TownRoundaboutGuideDocument,
        rkey: "1",
        cid: "bafy",
        record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
      },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "1",
      operation: "create",
      cid: "bafy",
      record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
    });
  });

  it("maps a delete commit (no record/cid)", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: { operation: "delete", collection: ids.TownRoundaboutGuideSave, rkey: "9" },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideSave,
      rkey: "9",
      operation: "delete",
      cid: undefined,
      record: undefined,
    });
  });

  it("returns null for non-commit events", () => {
    expect(toCommitEvent({ kind: "identity" } as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: FAIL — cannot resolve `./jetstream`.

- [ ] **Step 3: Write the adapter**

`apps/appview/src/jetstream.ts`:
```ts
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

/** Start consuming Jetstream, applying events and persisting the cursor. Returns the Jetstream instance. */
export function startJetstream(db: Db): Jetstream {
  const cursor = db.getCursor();
  const js = new Jetstream({
    wantedCollections: WANTED,
    cursor: cursor ? Number(cursor) : undefined,
  });

  js.on("commit", (evt) => {
    const ce = toCommitEvent(evt as any);
    if (ce) applyEvent(db, ce);
    const timeUs = (evt as any).time_us;
    if (timeUs) db.setCursor(String(timeUs));
  });

  js.start();
  return js;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/apps/appview && pnpm test`
Expected: PASS (all appview tests; the 3 new mapping tests included).

> Note on the `@skyware/jetstream` event shape: this plan assumes `evt.kind === "commit"`, `evt.commit.{operation,collection,rkey,cid,record}`, and `evt.time_us`. If the installed version exposes a different shape (e.g. typed `CommitCreate`/`CommitDelete` via `onCreate`/`onDelete`), adjust ONLY `toCommitEvent` and the `js.on(...)` wiring in `startJetstream` to match — the `toCommitEvent` unit tests pin the normalized output the rest of the system depends on. Verify against `node_modules/@skyware/jetstream` types before finalizing.

- [ ] **Step 5: Write the server entrypoint**

`apps/appview/src/server.ts`:
```ts
import { serve } from "@hono/node-server";
import { openDb } from "./db";
import { startJetstream } from "./jetstream";
import { makePdsFetcher } from "./fetcher";
import { createApi } from "./api";
import { resolveActor } from "./identity";

const DB_PATH = process.env.APPVIEW_DB ?? "appview.sqlite";
const PORT = Number(process.env.PORT ?? 3001);

const db = openDb(DB_PATH);
startJetstream(db);

const api = createApi({
  db,
  fetchRecord: makePdsFetcher(db),
  resolveActorFn: (did) => resolveActor(db, did),
});

serve({ fetch: api.fetch, port: PORT });
console.log(`AppView listening on http://localhost:${PORT} (db: ${DB_PATH})`);
```

- [ ] **Step 6: Smoke-test the server boots**

Run (start, wait, hit the endpoint, stop):
```bash
cd /Users/blainecook/Code/footwork/apps/appview
APPVIEW_DB=":memory:" PORT=3099 pnpm start &
SERVER_PID=$!
sleep 4
curl -s http://localhost:3099/guides
kill $SERVER_PID 2>/dev/null || true
```
Expected: the `curl` prints `{"guides":[]}` (empty store), confirming the Hono server boots and the Jetstream connection attempt does not crash the process. If Jetstream cannot connect (no network), the server should still serve the API; if the process crashes on boot, report the error.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat(appview): jetstream adapter and server entrypoint"
```

---

## Definition of Done

- `pnpm -r test` passes from the repo root (lexicons + appview).
- `apps/appview` type-checks: `pnpm --filter @guides/appview exec tsc --noEmit -p tsconfig.json` exits 0.
- The round-trip test proves ingest → store → hydrate → CID-verify → serve end to end, hermetically.
- CID verification is real: a mismatched cid yields `verified: false` and is not cached; a match yields `verified: true` and is cached.
- The read API serves `/guide/:did/:rkey`, `/guides`, `/profile/:did/saves`.
- The server boots and serves the API even if Jetstream cannot connect.
- All work committed in small, green increments.

## Notes for later plans

- The `HydratedGuide` shape (record + `references` map with `verified` flags + `author`) is the contract the **Viewer (Plan 4)** renders with its lenses. Keep it stable.
- The **Editor (Plan 3)** writes `document`/`place`/`save` records to a PDS; once those land on the network, this AppView indexes documents/saves from Jetstream and hydrates places on read — closing the real round-trip.
- Deferred: opportunistic firehose backfill of `place`/`event` records; lex-validating ingested records before indexing (currently we trust the firehose shape and validate-by-use); pagination/ranking on `/guides`.
- **CID-compat caveat:** the hermetic tests verify the CID *mechanism* (mismatch → unverified, match → verified+cached) but are self-referential — they feed our own `cidForRecord` output back in. They do **not** prove our computation matches what a real atproto PDS produces. That can only be validated against a real on-network record (once the Editor in Plan 3 writes one, fetch it via `getRecord` and assert `cidForRecord(value)` equals the PDS-reported `cid`). Treat this as the first integration check when the live round-trip is wired up.

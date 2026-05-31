# Guides Editor — Write Path (Plan 3 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `apps/web` Next.js app with client-side AT Protocol OAuth, and build the testable write path: a **richtext lens** that maps a Tiptap/ProseMirror document to/from the atproto `{text, facets}` storage form, and a **publish pipeline** that creates the referenced `place`/`event` records, rewrites facets to strongRef them, validates against `@guides/lexicons`, and writes the guide `document` — all driven through an authenticated agent. This plan closes the **live round-trip** (write to a real PDS → Plan 2 AppView indexes it) and validates the CID-compat caveat.

**Architecture:** Client-side OAuth (public client, no backend) via `@atproto/oauth-client-browser`, mirroring the known-good `blaine/ionosphere` implementation. The richtext lens and publish pipeline are pure, dependency-injected logic in `apps/web/src/lib/`, unit-tested with Vitest (the lens by round-trip laws; publish with a mock agent). The Tiptap editing UI that produces the ProseMirror doc is **Plan 4** — this plan defines and tests the seam (a ProseMirror doc JSON in, atproto records out).

**Tech Stack:** Next.js (App Router), React, `@atproto/oauth-client-browser`, `@atproto/api` (Agent), `@guides/lexicons` (Plan 1: types, generated validators, `byteSliceFromChars`, `facetSegments`), Vitest.

> **Decisions (vetoable on review):**
> - **Client-side-only OAuth** (`BrowserOAuthClient`), mirroring `blaine/ionosphere/apps/ionosphere/src/lib/auth.tsx`. Loopback client_id for dev; no hosted client metadata. Granular scopes: `atproto repo:town.roundabout.guide.document repo:town.roundabout.guide.place repo:community.lexicon.calendar.event`.
> - **The richtext lens is a hand-written codec verified by round-trip laws**, adopting relationaltext's framing (text+facets is canonical; the editor's doc format is a vocabulary). We do NOT add a panproto runtime dependency — the tree↔(text+ranges) transform is a focused codec, and `facetSegments` from Plan 1 already implements the storage→doc decomposition. If relationaltext later ships a direct ProseMirror codec, it can replace this module behind the same laws.
> - **Marks carry place/event DATA + a temp id, not strongRefs.** Standalone records are created at publish time (avoids orphan records if a draft is abandoned); the publish pipeline maps temp id → strongRef and the lens emits facets with the real refs.
> - **Logic lives in `apps/web/src/lib/`** (testable with Vitest, no React/Next needed to test). The Tiptap UI (Plan 4) produces the ProseMirror doc JSON these modules consume.

---

## File Structure

- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/vitest.config.ts` — app + test config.
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` — minimal Next App Router shell (a landing page; the compose page is Plan 4).
- `apps/web/src/lib/auth.tsx` — client-side OAuth `AuthProvider` + `useAuth` (mirrors ionosphere). Integration-verified.
- `apps/web/src/lib/doc.ts` — the ProseMirror-doc TypeScript types we operate on + small helpers.
- `apps/web/src/lib/richtext-lens.ts` — `docToStorage(doc, refMap)` and `storageToDoc(storage)`. The testable core.
- `apps/web/src/lib/publish.ts` — `publishGuide(agent, draft)`: create refs → rewrite facets → validate → create document.
- Tests: `apps/web/src/lib/*.test.ts`.

---

### Task 0: Scaffold the Next.js app

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/vitest.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create `apps/web/package.json`**
```json
{
  "name": "@guides/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**
```bash
cd /Users/blainecook/Code/footwork
pnpm add --filter @guides/web @guides/lexicons@workspace:* next react react-dom @atproto/api @atproto/oauth-client-browser
pnpm add --filter @guides/web -D vitest typescript @types/node @types/react @types/react-dom
```
If the sandbox blocks network, retry the failing command once with `dangerouslyDisableSandbox: true`; if still no network, report BLOCKED.

- [ ] **Step 3: Create config files**

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "types": ["node"]
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"]
}
```

`apps/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, transpilePackages: ["@guides/lexicons"] };
export default nextConfig;
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 4: Create a minimal App Router shell**

`apps/web/src/app/layout.tsx`:
```tsx
export const metadata = { title: "Guides" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main>
      <h1>Guides</h1>
      <p>A place-based, collaborative recommendation tool on AT Protocol.</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify build + the workspace link**

Run:
```bash
cd /Users/blainecook/Code/footwork/apps/web
pnpm exec next build
node -e "import('@guides/lexicons').then(m => console.log('lex ok', m.ids.TownRoundaboutGuideDocument))"
```
Expected: `next build` completes; the import prints `lex ok town.roundabout.guide.document`. If `next build` requires additional config it scaffolds (e.g. `next-env.d.ts`), let it; commit whatever it generates. Report the Next.js version installed.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore(web): scaffold Next.js app"
```

---

### Task 1: ProseMirror doc types

**Files:**
- Create: `apps/web/src/lib/doc.ts`
- Test: `apps/web/src/lib/doc.test.ts`

We model only the subset of ProseMirror/Tiptap JSON we use: a `doc` of `paragraph` nodes containing `text` nodes that may carry `marks`. Marks are `bold`, `italic`, `placeRef` (attrs `{ refId, intent }`), `eventRef` (attrs `{ refId, intent }`).

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/doc.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { paragraphsText, type PMDoc } from "./doc";

describe("paragraphsText", () => {
  it("joins paragraph text with double newlines", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
      ],
    };
    expect(paragraphsText(doc)).toBe("Hello\n\nWorld");
  });

  it("handles an empty paragraph", () => {
    const doc: PMDoc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(paragraphsText(doc)).toBe("");
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (`cd apps/web && pnpm test` — cannot resolve `./doc`).

- [ ] **Step 3: Write `apps/web/src/lib/doc.ts`**
```ts
export interface PMMark {
  type: "bold" | "italic" | "placeRef" | "eventRef";
  attrs?: { refId?: string; intent?: string };
}
export interface PMTextNode {
  type: "text";
  text: string;
  marks?: PMMark[];
}
export interface PMParagraph {
  type: "paragraph";
  content?: PMTextNode[];
}
export interface PMDoc {
  type: "doc";
  content: PMParagraph[];
}

/** The plain-text projection of the document: paragraphs joined by blank lines. */
export function paragraphsText(doc: PMDoc): string {
  return doc.content
    .map((p) => (p.content ?? []).map((n) => n.text).join(""))
    .join("\n\n");
}
```

- [ ] **Step 4: Run; confirm PASS.**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): ProseMirror doc types and text projection"
```

---

### Task 2: The richtext lens — `docToStorage`

**Files:**
- Create: `apps/web/src/lib/richtext-lens.ts`
- Test: `apps/web/src/lib/richtext-lens.test.ts`

`docToStorage(doc, refMap)` walks the doc, builds the plain text (paragraphs joined by `\n\n`), and emits one facet per marked text-node-run: byte ranges via `byteSliceFromChars` (Plan 1), features mapped from marks. `placeRef`/`eventRef` marks resolve their `refId` through `refMap` (temp id → strongRef) into a `ref` feature.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/richtext-lens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { docToStorage } from "./richtext-lens";
import type { PMDoc } from "./doc";
import { ids } from "@guides/lexicons";

const placeRef = { uri: "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" };

describe("docToStorage", () => {
  it("emits a placeRef facet over the correct UTF-8 byte range", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Go to " },
            { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
            { type: "text", text: " now" },
          ],
        },
      ],
    };
    const { text, facets } = docToStorage(doc, { t1: placeRef });
    expect(text).toBe("Go to Tartine now");
    expect(facets).toEqual([
      {
        index: { byteStart: 6, byteEnd: 13 },
        features: [
          { $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" },
        ],
      },
    ]);
  });

  it("computes byte offsets correctly across multibyte text", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "👋 " },
            { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
          ],
        },
      ],
    };
    const { facets } = docToStorage(doc, { t1: placeRef });
    expect(facets[0].index).toEqual({ byteStart: 5, byteEnd: 12 }); // 👋=4 + space=1
  });

  it("maps bold/italic to format features", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] }],
    };
    const { facets } = docToStorage(doc, {});
    expect(facets[0].features).toEqual([{ $type: ids.TownRoundaboutGuideDocument + "#format", kind: "bold" }]);
  });

  it("omits a place facet whose refId is missing from the map (drops the ref, keeps the text)", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "placeRef", attrs: { refId: "missing", intent: "card" } }] }] }],
    };
    const { text, facets } = docToStorage(doc, {});
    expect(text).toBe("x");
    expect(facets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (cannot resolve `./richtext-lens`).

- [ ] **Step 3: Write `apps/web/src/lib/richtext-lens.ts` (docToStorage; storageToDoc added in Task 3)**
```ts
import { byteSliceFromChars, ids, type FacetLike as Facet, type StrongRef } from "@guides/lexicons";
import type { PMDoc, PMMark } from "./doc";

const DOC = ids.TownRoundaboutGuideDocument;

export type RefMap = Record<string, StrongRef>;

function featureFromMark(mark: PMMark, refMap: RefMap): Record<string, unknown> | null {
  switch (mark.type) {
    case "bold":
    case "italic":
      return { $type: `${DOC}#format`, kind: mark.type };
    case "placeRef":
    case "eventRef": {
      const refId = mark.attrs?.refId;
      const ref = refId ? refMap[refId] : undefined;
      if (!ref) return null; // unresolved ref: drop the feature, keep the text
      const type = mark.type === "placeRef" ? "placeRef" : "eventRef";
      return { $type: `${DOC}#${type}`, ref, intent: mark.attrs?.intent ?? "card" };
    }
    default:
      return null;
  }
}

/** Project a ProseMirror doc to atproto {text, facets}, resolving ref ids via refMap. */
export function docToStorage(doc: PMDoc, refMap: RefMap): { text: string; facets: Facet[] } {
  let text = "";
  const facets: Facet[] = [];

  doc.content.forEach((para, pIdx) => {
    if (pIdx > 0) text += "\n\n";
    for (const node of para.content ?? []) {
      const charStart = text.length;
      text += node.text;
      const charEnd = text.length;
      const features = (node.marks ?? [])
        .map((m) => featureFromMark(m, refMap))
        .filter((f): f is Record<string, unknown> => f !== null);
      if (features.length > 0) {
        facets.push({ index: byteSliceFromChars(text, charStart, charEnd), features: features as any });
      }
    }
  });

  return { text, facets };
}
```

> Note: `text.length` is a UTF-16 char count, which is the correct input to `byteSliceFromChars` (which itself converts to UTF-8 bytes). Do not pre-convert to bytes here.

- [ ] **Step 4: Run; confirm PASS (4 tests).**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): richtext lens docToStorage (doc -> text+facets)"
```

---

### Task 3: The richtext lens — `storageToDoc` + round-trip laws

**Files:**
- Modify: `apps/web/src/lib/richtext-lens.ts`
- Test: `apps/web/src/lib/richtext-lens.roundtrip.test.ts`

`storageToDoc({text, facets})` is the reverse: split text on `\n\n` into paragraphs, and within each paragraph use Plan 1's `facetSegments` to produce marked text nodes. The round-trip law we verify: for a doc with resolved refs, `storageToDoc(docToStorage(doc, refMap))` reproduces the doc's text + mark structure (PutGet), and for storage, `docToStorage(storageToDoc(storage), refMapFromStorage)` reproduces the storage (GetPut). Because `storageToDoc` yields placeRef/eventRef marks whose `ref` is inlined, we test the law at the **storage** level (storage → doc → storage is identity), which is the property the publish path depends on.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/richtext-lens.roundtrip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { docToStorage, storageToDoc, refMapFromDoc } from "./richtext-lens";
import { ids, type FacetLike as Facet } from "@guides/lexicons";

const placeRef = { uri: "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" };

describe("richtext lens round-trip (GetPut at the storage level)", () => {
  it("storage -> doc -> storage is identity for text + placeRef + format", () => {
    const storage = {
      text: "Go to Tartine now\n\nIt is great.",
      facets: [
        {
          index: { byteStart: 6, byteEnd: 13 },
          features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" }],
        },
        {
          index: { byteStart: 24, byteEnd: 29 },
          features: [{ $type: ids.TownRoundaboutGuideDocument + "#format", kind: "bold" }],
        },
      ] as Facet[],
    };
    const doc = storageToDoc(storage);
    const back = docToStorage(doc, refMapFromDoc(doc));
    expect(back.text).toBe(storage.text);
    expect(back.facets).toEqual(storage.facets);
  });

  it("preserves multibyte byte offsets through the round-trip", () => {
    const storage = {
      text: "👋 Tartine",
      facets: [
        { index: { byteStart: 5, byteEnd: 12 }, features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" }] },
      ] as Facet[],
    };
    const doc = storageToDoc(storage);
    const back = docToStorage(doc, refMapFromDoc(doc));
    expect(back.facets[0].index).toEqual({ byteStart: 5, byteEnd: 12 });
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (cannot resolve `storageToDoc`/`refMapFromDoc`).

- [ ] **Step 3: Add `storageToDoc` + `refMapFromDoc` to `apps/web/src/lib/richtext-lens.ts`**

Append:
```ts
import { facetSegments } from "@guides/lexicons";
import type { PMMark, PMParagraph, PMTextNode } from "./doc";

interface InlineFeature {
  $type: string;
  kind?: string;
  ref?: StrongRef;
  intent?: string;
}

function marksFromFeatures(features: unknown[]): { marks: PMMark[]; refs: Record<string, StrongRef> } {
  const marks: PMMark[] = [];
  const refs: Record<string, StrongRef> = {};
  for (const f of features as InlineFeature[]) {
    if (f.$type === `${DOC}#format` && (f.kind === "bold" || f.kind === "italic")) {
      marks.push({ type: f.kind });
    } else if (f.$type === `${DOC}#placeRef` && f.ref) {
      const refId = `${f.ref.uri}#${f.ref.cid}`;
      refs[refId] = f.ref;
      marks.push({ type: "placeRef", attrs: { refId, intent: f.intent ?? "card" } });
    } else if (f.$type === `${DOC}#eventRef` && f.ref) {
      const refId = `${f.ref.uri}#${f.ref.cid}`;
      refs[refId] = f.ref;
      marks.push({ type: "eventRef", attrs: { refId, intent: f.intent ?? "card" } });
    }
  }
  return { marks, refs };
}

/** Reconstruct a ProseMirror doc from atproto {text, facets}. */
export function storageToDoc(storage: { text: string; facets: Facet[] }): PMDoc {
  const paragraphs: PMParagraph[] = [];
  // Segment the WHOLE text by facets, then split segments at paragraph breaks.
  const segments = [...facetSegments(storage.text, storage.facets)];
  let current: PMTextNode[] = [];
  const flush = () => {
    paragraphs.push(current.length ? { type: "paragraph", content: current } : { type: "paragraph" });
    current = [];
  };
  for (const seg of segments) {
    const parts = seg.text.split("\n\n");
    parts.forEach((part, i) => {
      if (i > 0) flush();
      if (part.length === 0) return;
      const { marks } = marksFromFeatures(seg.features);
      current.push(marks.length ? { type: "text", text: part, marks } : { type: "text", text: part });
    });
  }
  flush();
  return { type: "doc", content: paragraphs };
}

/** Build a refMap (refId -> StrongRef) from a doc produced by storageToDoc. */
export function refMapFromDoc(doc: PMDoc): RefMap {
  const map: RefMap = {};
  for (const para of doc.content) {
    for (const node of para.content ?? []) {
      for (const mark of node.marks ?? []) {
        if ((mark.type === "placeRef" || mark.type === "eventRef") && mark.attrs?.refId) {
          // refId encodes uri#cid (see marksFromFeatures); reconstruct the StrongRef.
          const [uri, cid] = mark.attrs.refId.split("#");
          if (uri && cid) map[mark.attrs.refId] = { uri, cid };
        }
      }
    }
  }
  return map;
}
```

> Note on the `refId` convention: when reconstructing a doc from storage, `marksFromFeatures` encodes each ref as `uri#cid` so `refMapFromDoc` can rebuild the `StrongRef` for the round-trip. (The editor in Plan 4 uses its own temp ids — e.g. `place-1` — and supplies the real `refMap` from records it created; that path is exercised by Task 2's tests.)

- [ ] **Step 4: Run; confirm PASS (round-trip tests + Task 2 tests all green).**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): richtext lens storageToDoc + round-trip law tests"
```

---

### Task 4: The publish pipeline

**Files:**
- Create: `apps/web/src/lib/publish.ts`
- Test: `apps/web/src/lib/publish.test.ts`

`publishGuide(repo, createRecord, draft)` orchestrates the writes. `draft` carries the ProseMirror `doc`, the guide `title`/`type`, and the place/event payloads keyed by the same temp ids the doc's marks use. Steps: (1) for each place/event payload, `createRecord` the standalone record and capture its `{uri, cid}` strongRef into a refMap; (2) `docToStorage(doc, refMap)` to get `{text, facets}` with real refs; (3) assemble the document record, **validate** it with `@guides/lexicons`; (4) `createRecord` the document; return its uri. `createRecord` is injected (the real one wraps `agent.com.atproto.repo.createRecord`), so this is fully unit-testable.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/publish.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { publishGuide, type Draft } from "./publish";
import { ids } from "@guides/lexicons";
import type { PMDoc } from "./doc";

function draftWithPlace(): Draft {
  const doc: PMDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Go to " },
          { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "place-1", intent: "card" } }] },
        ],
      },
    ],
  };
  return {
    title: "Mission morning",
    type: "list",
    doc,
    places: { "place-1": { name: "Tartine", location: { $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42" } } },
    events: {},
  };
}

describe("publishGuide", () => {
  it("creates the place record, then the document referencing it, and returns the doc uri", async () => {
    const createRecord = vi
      .fn()
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" })
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1", cid: "bafydoc" });

    const result = await publishGuide("did:plc:me", createRecord, draftWithPlace());

    expect(result).toBe("at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1");
    // First call: place record
    expect(createRecord.mock.calls[0][0]).toBe(ids.TownRoundaboutGuidePlace);
    expect(createRecord.mock.calls[0][1].name).toBe("Tartine");
    // Second call: document, with a facet strongRef-ing the created place
    const docCall = createRecord.mock.calls[1];
    expect(docCall[0]).toBe(ids.TownRoundaboutGuideDocument);
    const docRecord = docCall[1];
    expect(docRecord.text).toBe("Go to Tartine");
    expect(docRecord.facets[0].features[0].ref).toEqual({
      uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1",
      cid: "bafyplace",
    });
    expect(docRecord.$type).toBe(ids.TownRoundaboutGuideDocument);
    expect(typeof docRecord.createdAt).toBe("string");
  });

  it("rejects a draft whose document violates the lexicon (title too long)", async () => {
    const createRecord = vi.fn().mockResolvedValue({ uri: "at://x/y/z", cid: "c" });
    const bad = draftWithPlace();
    bad.title = "x".repeat(1201); // exceeds title maxLength (1200) / maxGraphemes (300)
    await expect(publishGuide("did:plc:me", createRecord, bad)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (cannot resolve `./publish`).

- [ ] **Step 3: Write `apps/web/src/lib/publish.ts`**
```ts
import { ids, lexicons, type StrongRef } from "@guides/lexicons";
import type { PMDoc } from "./doc";
import { docToStorage, type RefMap } from "./richtext-lens";

export interface PlacePayload {
  name: string;
  location?: Record<string, unknown>;
}
export interface EventPayload {
  name: string;
  startsAt?: string;
}
export interface Draft {
  title: string;
  type: "curated" | "list";
  doc: PMDoc;
  places: Record<string, PlacePayload>;
  events: Record<string, EventPayload>;
}

/** Inject the real implementation (agent.com.atproto.repo.createRecord) in production. */
export type CreateRecord = (
  collection: string,
  record: Record<string, unknown>,
) => Promise<{ uri: string; cid: string }>;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Create the referenced place/event records, then the guide document referencing them.
 * Returns the document's AT-URI. Validates the document against the lexicon before writing.
 */
export async function publishGuide(repo: string, createRecord: CreateRecord, draft: Draft): Promise<string> {
  const refMap: RefMap = {};

  for (const [refId, place] of Object.entries(draft.places)) {
    const record = { $type: ids.TownRoundaboutGuidePlace, name: place.name, location: place.location, createdAt: nowIso() };
    const ref = await createRecord(ids.TownRoundaboutGuidePlace, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  for (const [refId, event] of Object.entries(draft.events)) {
    const record = { $type: ids.CommunityLexiconCalendarEvent, name: event.name, startsAt: event.startsAt, createdAt: nowIso() };
    const ref = await createRecord(ids.CommunityLexiconCalendarEvent, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  const { text, facets } = docToStorage(draft.doc, refMap);
  const document: Record<string, unknown> = {
    $type: ids.TownRoundaboutGuideDocument,
    title: draft.title,
    type: draft.type,
    text,
    facets,
    createdAt: nowIso(),
  };

  // Validate against the generated lexicon before writing (throws on invalid).
  lexicons.assertValidRecord(ids.TownRoundaboutGuideDocument, document);

  const created = await createRecord(ids.TownRoundaboutGuideDocument, document);
  return created.uri;
}
```

> Note: `lexicons.assertValidRecord(nsid, record)` is exposed by `@guides/lexicons` (the generated `Lexicons` instance). `repo` (the author DID) is accepted for symmetry with the production `createRecord` wrapper (Task 5) even though the injected test stub ignores it. If `assertValidRecord` is not a method on the exported `lexicons` in the installed build, use the generated `validateRecord` from `@guides/lexicons/.../document` and throw on `!result.success` — confirm against the Plan 1 exports.

- [ ] **Step 4: Run; confirm PASS (2 tests).**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): publish pipeline (create refs, validate, write document)"
```

---

### Task 5: Client-side OAuth + the production createRecord

**Files:**
- Create: `apps/web/src/lib/auth.tsx`
- Create: `apps/web/src/lib/agent.ts`

This mirrors `blaine/ionosphere/apps/ionosphere/src/lib/auth.tsx`. It is React/browser integration code, verified by `next build` + the manual live round-trip (Step 4), not by unit tests (OAuth requires a browser + a real PDS).

- [ ] **Step 1: Write `apps/web/src/lib/auth.tsx`**
```tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { Agent } from "@atproto/api";

const SCOPE = [
  "atproto",
  "repo:town.roundabout.guide.document",
  "repo:town.roundabout.guide.place",
  "repo:community.lexicon.calendar.event",
].join(" ");

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
```

- [ ] **Step 2: Write `apps/web/src/lib/agent.ts` (production createRecord wrapper)**
```ts
import type { Agent } from "@atproto/api";
import type { CreateRecord } from "./publish";

/** Wrap an authenticated Agent into the CreateRecord function the publish pipeline expects. */
export function makeCreateRecord(agent: Agent, repo: string): CreateRecord {
  return async (collection, record) => {
    const res = await agent.com.atproto.repo.createRecord({ repo, collection, record });
    return { uri: res.data.uri, cid: res.data.cid };
  };
}
```

- [ ] **Step 3: Verify it type-checks and builds**

Run:
```bash
cd /Users/blainecook/Code/footwork/apps/web
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec next build
```
Expected: both succeed. If `agent.com.atproto.repo.createRecord`'s argument/return shape differs in the installed `@atproto/api`, adjust `makeCreateRecord` to match (it must return `{uri, cid}` strings). Report any adjustment. If `BrowserOAuthClient.load` / `signIn` / `init` signatures differ from the ionosphere reference, align to the installed `@atproto/oauth-client-browser` and report.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat(web): client-side OAuth provider and createRecord wrapper"
```

---

## Definition of Done

- `pnpm -r test` passes from the repo root (lexicons + appview + web lib tests).
- `apps/web` type-checks (`tsc --noEmit`) and `next build` succeeds.
- The richtext lens round-trips at the storage level (incl. multibyte) and `docToStorage` produces correct UTF-8 byte offsets and feature mappings.
- `publishGuide` creates referenced records first, rewrites facets to their strongRefs, validates the document against `@guides/lexicons`, writes it, and returns the URI — proven with an injected `createRecord`.
- OAuth + `makeCreateRecord` build cleanly (live behavior verified manually in Plan 4).
- All work committed in small, green increments.

## Notes for Plan 4 (Editor UI) and beyond

- **The seam Plan 4 plugs into:** the Tiptap editor produces a `PMDoc` (Task 1 shape) plus `places`/`events` payload maps keyed by the mark `refId`s; the compose page builds a `Draft` and calls `publishGuide(did, makeCreateRecord(agent, did), draft)`.
- **Live round-trip verification (Plan 4):** sign in via OAuth, compose a guide with a place, publish, then confirm it appears via the Plan 2 AppView (`GET /guide/:did/:rkey`) with `references[placeUri].verified === true`. **This is the first real test of CID-compat** — if our `cidForRecord` (AppView) doesn't match the PDS's CID for the place record, `verified` will be false; that's the signal to reconcile the CID computation (the caveat flagged in Plan 2).
- The lens currently supports `bold`/`italic`/`placeRef`/`eventRef`. Additional facet feature types (e.g. `link`) extend `featureFromMark`/`marksFromFeatures` symmetrically.

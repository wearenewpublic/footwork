# Adopt relationaltext (Plan 5 of 5, revised) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersedes** `docs/superpowers/plans/2026-06-01-guides-viewer.md` (the hand-rolled HIR/renderer viewer). **Amends** the merged Plan 1 (lexicon) and Plan 3 (editor lens). Backwards-compat is explicitly NOT a goal — old guide records in the previous facet dialect can be re-published.

**Goal:** Stop hand-rolling rich-text handling and being a third facet dialect. Adopt the **`relational-text`** library as the canonical document model: store guides as relationaltext documents (`{text, facets}` — the library's vocabulary for bold/italic/link), keep **place/event as our own custom entity facets** (`town.roundabout.guide.facet#place`/`#event`, carrying a `strongRef` + `intent`), build documents in the editor via the library's `Document` API, and render the public viewer with `relational-text-react`'s `DocumentRenderer`. Delete our `richtext-lens.ts` and the planned `hir.ts`/`GuideView`.

**Architecture:** `relational-text` is WASM-backed; import from narrow subpaths (`relational-text/core`, `relational-text/registry`) to avoid the automerge/knowledge extras. The **editor** walks the Tiptap doc and builds a `Document` via `fromText` + `addBlock` (paragraphs) + `addMark` (bold/italic/link as name-only hub marks; place/event as `$type` entity marks with a `ref`); stores `doc.facets`/`doc.text`. The **viewer** does `Document.fromJSON({text,facets}).toHIR()` → `DocumentRenderer` with custom `components` for place/event chips. The **AppView is unchanged** — `refsFromDocument` keys on a feature's `ref`. The **lexicon** stores facets in relationaltext's wire shape (open features) + defines our place/event entity feature types.

**Tech Stack:** `relational-text@0.1.x`, `relational-text-react@0.1.x` (WASM), Next.js, Tiptap (editor, unchanged UI), `@guides/lexicons`, Vitest.

> **Decisions (vetoable on review):**
> - **Editor builds the Document via `fromText`+`addMark`+`addBlock`** (a thin Tiptap walk), not the registered ProseMirror adapter — confirmed working in the spike, handles our custom entities natively, no format registration/WASM-lens wiring.
> - **Place/event entity `$type`s:** `town.roundabout.guide.facet#place`, `town.roundabout.guide.facet#event`, each with `{ ref: strongRef, intent }`. (Renamed from the old `…document#placeRef`/`#eventRef`.)
> - **Rich-text marks** use the relationaltext hub vocabulary (`org.relationaltext.facet` with `name: "bold"|"italic"`; link as the hub link mark). We no longer define our own format/link facets.
> - **Lexicon facets typed openly** (`{index, features: unknown[]}`) — the `relational-text` WASM core validates rich-text features; the lexicon validates structure + our entity features.
> - **Import narrow subpaths** to avoid `@automerge/automerge`.

---

## File Structure

- Modify `packages/lexicons/lexicons/town/roundabout/guide/document.json` — facets → open relationaltext wire shape; remove `#format`/`#link`/`#placeRef`/`#eventRef`/`#facet`/`#byteSlice` defs. Add `packages/lexicons/lexicons/town/roundabout/guide/facet.json` defining `#place`/`#event` entity features. Regenerate.
- Create `apps/web/src/lib/rt.ts` — library wrapper: `ensureInit()`, `tiptapToDocument(json, refMap)`, `documentWire(doc)`, `hirFor(wire)`.
- Delete `apps/web/src/lib/richtext-lens.ts` (+ its tests) and **do not** create `hir.ts`/`GuideView` from the old plan.
- Modify `apps/web/src/lib/publish.ts` — build facets via `rt.ts` instead of `docToStorage`.
- Create `apps/web/src/components/GuideView.tsx` — `DocumentRenderer`-based renderer with place/event chip components.
- Create the viewer pages + Save button + profile page (as in the superseded plan, but rendering via `GuideView`).
- Next config: enable WASM if required (Task 0 determines this).

---

### Task 0: WASM-in-Next smoke (de-risk first)

**Files:**
- Modify: `apps/web/package.json` (deps), `apps/web/next.config.mjs` (WASM if needed)
- Create (temporary): `apps/web/src/app/(viewer)/rt-smoke/page.tsx`

- [ ] **Step 1: Install**
```bash
cd /Users/blainecook/Code/footwork
pnpm add --filter @guides/web relational-text relational-text-react
```

- [ ] **Step 2: Write a smoke server page** `apps/web/src/app/(viewer)/rt-smoke/page.tsx`
```tsx
import { Document } from "relational-text/core";
import { init } from "relational-text/registry";

export const dynamic = "force-dynamic";

export default async function RtSmoke() {
  await init();
  const doc = Document.fromText("Go to Tartine").addMark(0, 2, { name: "bold" });
  const hir = doc.toHIR();
  return (
    <main>
      <h1>rt-smoke</h1>
      <pre>{JSON.stringify({ text: doc.text, facets: doc.facets, hir }, null, 2)}</pre>
    </main>
  );
}
```

- [ ] **Step 3: Build + run; confirm WASM works server-side**
```bash
cd /Users/blainecook/Code/footwork/apps/web
pnpm exec next build
APPVIEW_DB=":memory:" pnpm dev &  # or `next start` after build
sleep 5
curl -s http://localhost:3000/rt-smoke | grep -c "org.relationaltext.facet#bold"   # expect >= 1
kill %1 2>/dev/null || true
```
Expected: build succeeds and the rendered HTML contains the HIR with `org.relationaltext.facet#bold`. **If WASM fails to load under Turbopack/SSR**, resolve it here before proceeding:
  - try `next.config.mjs` → `experimental: { turbo: { ... } }` / `webpack: (c) => { c.experiments = { ...c.experiments, asyncWebAssembly: true }; return c; }`;
  - if SSR WASM proves intractable, fall back to rendering the viewer as a client component (`"use client"` + `useEffect` init) and record that decision.
  Report exactly what was needed.

- [ ] **Step 4: Remove the smoke page**, keep any `next.config.mjs` change. Commit.
```bash
rm apps/web/src/app/\(viewer\)/rt-smoke/page.tsx
cd /Users/blainecook/Code/footwork && git add -A && git commit -m "chore(web): add relational-text deps; confirm WASM under Next"
```

> If Step 3 required SSR→client fallback, note it — Tasks 4/6 (pages) adjust accordingly (render `GuideView` as a client component).

---

### Task 1: Lexicon — relationaltext wire facets + place/event entities

**Files:**
- Modify: `packages/lexicons/lexicons/town/roundabout/guide/document.json`
- Create: `packages/lexicons/lexicons/town/roundabout/guide/facet.json`
- Regenerate: `packages/lexicons/src/lexicon/**`

- [ ] **Step 1: Rewrite `document.json`** — facets become the open relationaltext wire shape; drop our rich-text defs:
```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.document",
  "defs": {
    "main": {
      "type": "record",
      "description": "A guide: a relationaltext document (UTF-8 text + flat facets).",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["title", "text", "createdAt"],
        "properties": {
          "title": { "type": "string", "maxLength": 1200, "maxGraphemes": 300 },
          "type": { "type": "string", "knownValues": ["curated", "list"], "description": "Display-only flag." },
          "text": { "type": "string", "maxLength": 100000, "maxGraphemes": 30000 },
          "facets": { "type": "array", "items": { "type": "ref", "ref": "#facet" } },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    },
    "facet": {
      "type": "object",
      "description": "A relationaltext facet: a byte range plus one or more typed features. Feature semantics are owned by the relational-text vocabulary; only structure is constrained here.",
      "required": ["index", "features"],
      "properties": {
        "index": { "type": "ref", "ref": "#byteSlice" },
        "features": { "type": "array", "items": { "type": "unknown" } }
      }
    },
    "byteSlice": {
      "type": "object",
      "required": ["byteStart", "byteEnd"],
      "properties": {
        "byteStart": { "type": "integer", "minimum": 0 },
        "byteEnd": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

- [ ] **Step 2: Create `facet.json`** defining our entity feature types:
```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.facet",
  "defs": {
    "place": {
      "type": "object",
      "description": "An inline reference to a town.roundabout.guide.place record.",
      "required": ["ref"],
      "properties": {
        "ref": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
        "intent": { "type": "string", "knownValues": ["hero", "card", "chip"], "default": "card" }
      }
    },
    "event": {
      "type": "object",
      "description": "An inline reference to a community.lexicon.calendar.event record.",
      "required": ["ref"],
      "properties": {
        "ref": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
        "intent": { "type": "string", "knownValues": ["card"], "default": "card" }
      }
    }
  }
}
```

- [ ] **Step 3: Regenerate + build the lexicons package**
```bash
cd /Users/blainecook/Code/footwork/packages/lexicons
pnpm gen
pnpm run build
pnpm test
```
Expected: codegen succeeds; `ids.TownRoundaboutGuideFacet` now exists; `ids.TownRoundaboutGuideDocument` still exists. The existing validation test (which used the OLD facet defs with `#placeRef`) will FAIL — **update it** to the new shape: a document whose `facets[].features[0]` is `{ $type: "town.roundabout.guide.facet#place", ref: {uri, cid (valid)}, intent: "card" }`. Keep the "rejects missing title" case.

- [ ] **Step 4: Update the facet-helper exports** — `facets.ts` (`byteSliceFromChars`, `facetSegments`, `strongRef`) stays (still useful), but it is no longer the rendering path. No change required unless tests reference removed defs.

- [ ] **Step 5: Commit**
```bash
cd /Users/blainecook/Code/footwork
git add -A && git commit -m "feat(lexicons): guide document as relationaltext wire facets + place/event entities"
```

---

### Task 2: Editor — library-backed document builder

**Files:**
- Create: `apps/web/src/lib/rt.ts`
- Test: `apps/web/src/lib/rt.test.ts`
- Delete: `apps/web/src/lib/richtext-lens.ts`, `apps/web/src/lib/richtext-lens.test.ts`, `apps/web/src/lib/richtext-lens.roundtrip.test.ts`

`tiptapToDocument(tiptapJson, refMap)` walks the Tiptap doc (the `PMDoc` shape from `doc.ts`), accumulates text (paragraphs joined by `\n\n`), and for each marked text-node run computes the UTF-8 byte range and calls `addMark`: `bold`/`italic` → `{ name }` (hub mark); `link` → `{ name: "link", uri }`; `placeRef`/`eventRef` → `{ $type: ids.TownRoundaboutGuideFacet + "#place"|"#event", ref: refMap[refId], intent }`. Adds a paragraph block per paragraph via `addBlock`. Returns the `Document`; `documentWire(doc)` returns `{ text, facets }`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/rt.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { ensureInit, tiptapToDocument, documentWire } from "./rt";
import { ids } from "@guides/lexicons";
import type { PMDoc } from "./doc";

const place = { uri: "at://did:plc:a/town.roundabout.guide.place/p1", cid: "bafyplace" };

beforeAll(async () => {
  await ensureInit();
});

describe("tiptapToDocument", () => {
  it("emits a place entity facet over the correct UTF-8 byte range", async () => {
    const json: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Go to " },
            { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
          ],
        },
      ],
    };
    const doc = await tiptapToDocument(json, { t1: place });
    const { text, facets } = documentWire(doc);
    expect(text).toBe("Go to Tartine");
    const placeFeature = facets.flatMap((f: any) => f.features).find((f: any) => f.$type === ids.TownRoundaboutGuideFacet + "#place");
    expect(placeFeature).toMatchObject({ ref: place, intent: "card" });
    const placeFacet = facets.find((f: any) => f.features.some((x: any) => x.$type === ids.TownRoundaboutGuideFacet + "#place"));
    expect(placeFacet.index).toEqual({ byteStart: 6, byteEnd: 13 });
  });

  it("multibyte: byte offsets account for emoji", async () => {
    const json: PMDoc = {
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
    const { facets } = documentWire(await tiptapToDocument(json, { t1: place }));
    const f = facets.find((x: any) => x.features.some((y: any) => y.$type?.endsWith("#place")));
    expect(f.index).toEqual({ byteStart: 5, byteEnd: 12 });
  });

  it("bold maps to a hub mark; unresolved refIds drop the entity but keep text", async () => {
    const json: PMDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] },
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "placeRef", attrs: { refId: "missing" } }] }] },
      ],
    };
    const { text, facets } = documentWire(await tiptapToDocument(json, {}));
    expect(text).toBe("hi\n\nx");
    expect(facets.flatMap((f: any) => f.features).some((f: any) => f.name === "bold")).toBe(true);
    expect(facets.flatMap((f: any) => f.features).some((f: any) => f.$type?.endsWith("#place"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (`cd apps/web && pnpm test` — cannot resolve `./rt`). Then delete the three `richtext-lens*` files.

- [ ] **Step 3: Write `apps/web/src/lib/rt.ts`**
```ts
import { Document } from "relational-text/core";
import { init } from "relational-text/registry";
import { ids, type StrongRef } from "@guides/lexicons";
import type { PMDoc, PMMark } from "./doc";

const PLACE = `${ids.TownRoundaboutGuideFacet}#place`;
const EVENT = `${ids.TownRoundaboutGuideFacet}#event`;

let _ready: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (!_ready) _ready = init();
  return _ready;
}

export type RefMap = Record<string, StrongRef>;

const enc = new TextEncoder();
function byteLen(s: string): number {
  return enc.encode(s).length;
}

interface MarkSpan {
  byteStart: number;
  byteEnd: number;
  mark: Record<string, unknown>;
}

/** Map a Tiptap mark to a relational-text mark input (or null to drop it). */
function markInput(mark: PMMark, refMap: RefMap): Record<string, unknown> | null {
  switch (mark.type) {
    case "bold":
      return { name: "bold" };
    case "italic":
      return { name: "italic" };
    case "placeRef":
    case "eventRef": {
      const ref = mark.attrs?.refId ? refMap[mark.attrs.refId] : undefined;
      if (!ref) return null;
      return {
        $type: mark.type === "placeRef" ? PLACE : EVENT,
        ref: { uri: ref.uri, cid: ref.cid },
        intent: mark.attrs?.intent ?? "card",
      };
    }
    default:
      return null;
  }
}

/** Build a relational-text Document from a Tiptap/ProseMirror doc, resolving refIds via refMap. */
export async function tiptapToDocument(json: PMDoc, refMap: RefMap): Promise<Document> {
  await ensureInit();

  // 1) Assemble plain text (paragraphs joined by blank lines) and collect mark spans by byte range.
  let text = "";
  const spans: MarkSpan[] = [];
  const blocks: { start: number; end: number }[] = [];

  json.content.forEach((para, pIdx) => {
    if (pIdx > 0) text += "\n\n";
    const blockStart = byteLen(text);
    for (const node of para.content ?? []) {
      const start = byteLen(text);
      text += node.text;
      const end = byteLen(text);
      for (const m of node.marks ?? []) {
        const mi = markInput(m, refMap);
        if (mi) spans.push({ byteStart: start, byteEnd: end, mark: mi });
      }
    }
    blocks.push({ start: blockStart, end: byteLen(text) });
  });

  // 2) Build the Document: text, paragraph blocks, then inline marks.
  let doc = Document.fromText(text);
  for (const b of blocks) doc = doc.addBlock(b.start, b.end, { name: "paragraph" });
  for (const s of spans) doc = doc.addMark(s.byteStart, s.byteEnd, s.mark as any);
  return doc;
}

export function documentWire(doc: Document): { text: string; facets: unknown[] } {
  return { text: doc.text, facets: doc.facets as unknown[] };
}

/** Reconstruct a Document from stored wire JSON (for rendering / HIR). */
export function documentFromWire(wire: { text: string; facets: unknown[] }): Document {
  return Document.fromJSON(wire as any);
}
```

- [ ] **Step 4: Run; confirm PASS (3 tests).** If `addBlock`/`addMark` argument shapes differ from the spike (mark input keys, block name), align to the installed API and report — the spike confirmed `addMark(start,end,{name})` and `addMark(start,end,{$type,...})` work; verify `addBlock(start,end,{name:"paragraph"})`.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): build guide documents via relational-text (replaces richtext-lens)"
```

---

### Task 3: Editor publish — use the library builder

**Files:**
- Modify: `apps/web/src/lib/publish.ts`, `apps/web/src/lib/publish.test.ts`

- [ ] **Step 1: Update `publish.ts`** — replace the `docToStorage(...)` call with the library builder. The orchestration (create place/event records → `refMap` → build document → validate → write) is unchanged; only the doc-building line changes:
```ts
// was: const { text, facets } = docToStorage(draft.doc, refMap);
import { tiptapToDocument, documentWire } from "./rt";
// ...
const built = await tiptapToDocument(draft.doc, refMap);
const { text, facets } = documentWire(built);
const document = { $type: ids.TownRoundaboutGuideDocument, title: draft.title, type: draft.type, text, facets, createdAt: nowIso() };
lexicons.assertValidRecord(ids.TownRoundaboutGuideDocument, document);
```
(`publishGuide` becomes/stays `async`; it already is.)

- [ ] **Step 2: Update `publish.test.ts`** — the happy-path assertion that read `docRecord.facets[0].features[0].ref` now finds the place feature by `$type === ids.TownRoundaboutGuideFacet + "#place"` among `facets[].features[]`; assert its `ref` equals the created place strongRef. Keep the "title too long → rejects" case. The test must `await ensureInit()` in `beforeAll` (validation of facets is structural; the entity feature carries the real CID).

- [ ] **Step 3: Run; confirm PASS.** `cd apps/web && pnpm test`

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(web): publish builds documents via relational-text"`

---

### Task 4: Viewer renderer via DocumentRenderer

**Files:**
- Create: `apps/web/src/components/GuideView.tsx`

Reconstruct the Document from the stored wire, `toHIR()`, and render with `relational-text-react`'s `DocumentRenderer`, supplying `components` for our entity marks (`place`/`event` → chips, resolving display text from the AppView `references` map) and default HTML for hub marks (bold/italic/link).

- [ ] **Step 1: Write `apps/web/src/components/GuideView.tsx`**
```tsx
"use client"; // if Task 0 required client-side WASM; otherwise this can be a server component

import { DocumentRenderer } from "relational-text-react";
import { documentFromWire } from "../lib/rt";
import type { HydratedGuide, ResolvedRef } from "../lib/appview";

function chip(kind: "place" | "event", refs: Record<string, ResolvedRef>) {
  return function Chip({ attrs, children }: { attrs: Record<string, unknown>; children: React.ReactNode }) {
    const ref = attrs.ref as { uri?: string } | undefined;
    const value = ref?.uri ? refs[ref.uri]?.value : null;
    const name = (value?.name as string) ?? null;
    const detail = kind === "event" ? (value?.startsAt as string) : (value?.name as string);
    return (
      <span className={`chip chip-${kind}`} title={name ? `${kind}: ${detail ?? name}` : undefined}>
        {children}
      </span>
    );
  };
}

export function GuideView({ guide }: { guide: HydratedGuide }) {
  const wire = { text: String(guide.record.text ?? ""), facets: (guide.record.facets as unknown[]) ?? [] };
  const hir = documentFromWire(wire).toHIR();
  // DocumentRenderer keys custom components on the mark's short name (after '#').
  const components = {
    place: chip("place", guide.references),
    event: chip("event", guide.references),
  };
  return <DocumentRenderer hir={hir} components={components} />;
}
```

- [ ] **Step 2: Build** `cd apps/web && pnpm exec next build` → succeeds. If `DocumentRenderer`'s prop names / `components` signature differ from the installed `relational-text-react`, align and report (confirmed from source: `{ hir, components }`, component props `{ name, attrs, children }`).

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): GuideView via relational-text-react DocumentRenderer"`

---

### Task 5: SSR guide page + metadata + Save button + scope

**Files:**
- Create: `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx`
- Create: `apps/web/src/lib/save.ts` (+ test), `apps/web/src/components/SaveButton.tsx`, `apps/web/src/lib/appview.ts`
- Modify: `apps/web/src/lib/auth.tsx` (add `repo:town.roundabout.guide.save`)

These are as specified in the superseded viewer plan (Tasks 0/3/4 there), unchanged except the guide page renders `<GuideView guide={guide} />`. Reuse that plan's code for `appview.ts` (`fetchGuide`/`fetchSaves`/`HydratedGuide`/`ResolvedRef`), `save.ts` (`buildSaveRecord`, TDD), `SaveButton.tsx`, the OG/JSON-LD `generateMetadata`, and the scope addition. If Task 0 forced client-side WASM, the guide page fetches server-side and passes `guide` to a client `GuideView`.

- [ ] **Step 1:** Implement `appview.ts` + `save.ts` (+ failing test → pass) + `SaveButton.tsx` + the scope edit (see superseded plan tasks 0 and 4 for exact code).
- [ ] **Step 2:** Implement the guide page rendering `GuideView` + `generateMetadata` (canonical + OpenGraph + JSON-LD) + `SaveButton`.
- [ ] **Step 3: Build + test.** `cd apps/web && pnpm exec next build && pnpm -r test`
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(web): SSR guide page (relational-text render) + Save button"`

---

### Task 6: SSR profile saves page

**Files:**
- Create: `apps/web/src/app/(viewer)/profile/[did]/page.tsx`

- [ ] **Step 1:** Implement as in the superseded plan (Task 5 there): fetch `/profile/:did/saves`, list with links to `/guide/<did>/<rkey>` parsed from each `subjectUri`.
- [ ] **Step 2: Build + full test suite.** `cd /Users/blainecook/Code/footwork && pnpm -r test` and `pnpm --filter @guides/web exec next build`. Expected: all green; `/guide/[did]/[rkey]` and `/profile/[did]` listed.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): SSR profile saves page"`

---

### Task 7: Live verification (manual)

- [ ] **Step 1:** Run the AppView (replay cursor as needed) + the web app. Publish a fresh guide via the editor (now writing relationaltext-format facets).
- [ ] **Step 2:** Open `http://127.0.0.1:3000/guide/<did>/<rkey>` — confirm prose renders with bold/italic, place/event spans show as chips with resolved names, page has title/byline, and view-source shows server-rendered HTML + OG + JSON-LD (or, if client-WASM fallback, the chips render after hydration).
- [ ] **Step 3:** Sign in → Save → confirm "Saved ✓"; open `/profile/<did>` → confirm the guide is listed.
- [ ] **Step 4:** Run `apps/appview/scripts/verify-cid.ts <new-guide-uri>` — confirm place/event refs still `verified: true` (the entity `$type` changed but the strongRef + CID computation are unchanged). Record the outcome in `docs/superpowers/notes/2026-06-01-relationaltext-verification.md` and commit.

---

## Definition of Done

- `pnpm -r test` passes from the repo root (lexicons with updated validation test; web with `rt.ts`, `publish`, `save` tests; appview unchanged at 29).
- `apps/web` type-checks and `next build` succeeds; `/guide/[did]/[rkey]` and `/profile/[did]` listed.
- Guides are stored as relationaltext documents (hub vocabulary for bold/italic/link; `town.roundabout.guide.facet#place`/`#event` entities) and built via the `relational-text` `Document` API — `richtext-lens.ts` deleted, no hand-rolled HIR/renderer.
- The viewer renders via `relational-text-react` `DocumentRenderer` with place/event chip components; overlapping marks, nesting, and segmentation are handled by the library.
- The AppView still hydrates + CID-verifies references (unchanged); live round-trip re-verified in the new format.
- WASM works under Next (SSR, or documented client-side fallback).
- All work committed in small, green increments.

## Notes / follow-ups

- We deliberately build documents via `fromText`+`addMark`+`addBlock` rather than registering the `@relational-text/org.prosemirror` adapter. If we later want full editor interop (paste Markdown, import other formats), register formats via `registerFormat` and use `from(...)`/`to(...)` — the library is built for it.
- This completes the spike's intent without a bespoke rich-text stack: we're a first-class relationaltext document with our own place/event vocabulary, using the library's tested model, HIR, lenses, and React renderer.
- The old `2026-06-01-guides-viewer.md` plan is superseded by this document.

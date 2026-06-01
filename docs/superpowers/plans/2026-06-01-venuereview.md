# venueReview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `town.roundabout.guide.venueReview` through the full round-trip as a block-rendered review card, demonstrating block-level entities and two-hop nested references (facet → venueReview → place).

**Architecture:** A review is a relationaltext **block** feature (`$type town.roundabout.guide.facet#review`, `name "review"`, `attrs: { ref, intent }`) over a one-char block marker. The `venueReview` record holds rating/text/vibes + a strongRef to a `place` record. The editor authors it via a popup + a Tiptap block node; publish creates place→venueReview then emits the block; AppView hydrates both hops; the viewer renders a card via a custom block component.

**Tech Stack:** TypeScript, `@guides/lexicons` (lex-cli), `relational-text`/`relational-text-react` (WASM), Tiptap v3, Hono + SQLite (AppView), vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-venuereview-design.md`

## Empirically-verified facts (from probing relational-text 0.1.1)

These were confirmed with scratch tests; the code below depends on them:

1. A custom block feature **must be registered** via `registerFeatureType({ typeId, featureClass: "block", void: true })` before `toHIR`/`fromJSON`. Without it the feature defaults to inline class, renders as a mark, and the block marker char (`￼`/`\n`) **leaks into the rendered text**.
2. For **block** features the strongRef must live under **`attrs`** (`{ $type, name, parents, attrs: { ref, intent } }`). Block features do **not** lift top-level keys into HIR `attrs` (place/event *marks* do, which is why they store `ref` top-level — blocks are different).
3. The resulting HIR node is `{ type: "block", name: "review", attrs: { ref, intent }, children: [{ type:"text", content:"" }] }`. `DocumentRenderer` resolves a custom block by `node.name` and renders it even though its only child is empty text.
4. `document.json` types `facets[].features` as `unknown`, so `lexicons.assertValidRecord` does **not** validate feature internals — the nested-`attrs` review feature validates fine.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `packages/lexicons/lexicons/town/roundabout/guide/venueReview.json` | add `vibes` | Modify |
| `packages/lexicons/lexicons/town/roundabout/guide/facet.json` | add `review` def | Modify |
| `packages/lexicons/src/lexicon/*` | regenerated types/validators | Regenerate (commit) |
| `packages/lexicons/src/validation.test.ts` | venueReview validation test | Modify |
| `apps/web/src/lib/doc.ts` | `PMReviewBlock` node type | Modify |
| `apps/web/src/lib/rt.ts` | register review block; emit review block in `tiptapToDocument` | Modify |
| `apps/web/src/lib/rt.test.ts` | review-block round-trip test | Modify |
| `apps/web/src/lib/publish.ts` | `ReviewPayload`; create place→venueReview | Modify |
| `apps/web/src/lib/publish.test.ts` | review publish test | Modify |
| `apps/web/src/lib/draft.ts` | include reviews in validation | Modify |
| `apps/web/src/lib/draft.test.ts` | review draft test | Modify |
| `apps/web/src/lib/tiptap/reviewBlock.ts` | Tiptap block node | Create |
| `apps/web/src/components/CreateReviewPopup.tsx` | authoring form | Create |
| `apps/web/src/components/GuideEditor.tsx` | "Add review" button + state | Modify |
| `apps/appview/src/hydrate.ts` | two-hop hydration | Modify |
| `apps/appview/src/hydrate.test.ts` | two-hop hydration test | Modify |
| `apps/web/src/components/GuideView.tsx` | review card block component | Modify |
| `apps/web/src/app/globals.css` | `.review-card` styles | Modify |

---

### Task 1: Lexicon — `vibes` field + `review` facet def + regenerate

**Files:**
- Modify: `packages/lexicons/lexicons/town/roundabout/guide/venueReview.json`
- Modify: `packages/lexicons/lexicons/town/roundabout/guide/facet.json`
- Regenerate: `packages/lexicons/src/lexicon/*`
- Test: `packages/lexicons/src/validation.test.ts`

- [ ] **Step 1: Add `vibes` to `venueReview.json`**

Replace the `properties` block in `venueReview.json` with:

```json
        "properties": {
          "place": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
          "text": { "type": "string", "maxLength": 10000, "maxGraphemes": 3000 },
          "rating": { "type": "integer", "minimum": 1, "maximum": 5 },
          "vibes": {
            "type": "array",
            "maxLength": 8,
            "items": { "type": "string", "maxLength": 256, "maxGraphemes": 64 }
          },
          "createdAt": { "type": "string", "format": "datetime" }
        }
```

Also update the `description` of `main` to drop "not wired into the spike round-trip" (it now is): `"A rich review wrapper: intrinsic copy, rating, and vibe tags, referencing a place."`

- [ ] **Step 2: Add a `review` def to `facet.json`**

Add this def alongside `place` and `event` (inside `defs`):

```json
    "review": {
      "type": "object",
      "description": "An inline reference to a town.roundabout.guide.venueReview record, realized as a relationaltext block feature (the strongRef travels in the feature's attrs; rendered as a card).",
      "required": ["ref"],
      "properties": {
        "ref": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
        "intent": { "type": "string", "knownValues": ["card"], "default": "card" }
      }
    }
```

- [ ] **Step 3: Regenerate lexicon types/validators**

Run: `pnpm --filter @guides/lexicons gen`
Note: `lex gen-api` may print prompts/warnings; let it complete. It rewrites `src/lexicon/*` (committed). Then rebuild dist: `pnpm --filter @guides/lexicons build`
Expected: `src/lexicon/lexicons.ts` now contains `vibes` under `TownRoundaboutGuideVenueReview` and a `review` def under the facet schema.

- [ ] **Step 4: Write the failing validation test**

Add to `packages/lexicons/src/validation.test.ts` (match the existing import/style in that file; it already imports `ids`, `lexicons`):

```typescript
describe("venueReview", () => {
  const base = {
    $type: ids.TownRoundaboutGuideVenueReview,
    place: { uri: "at://did:plc:a/town.roundabout.guide.place/p1", cid: "bafyplace" },
    text: "Great espresso, cozy corner spot.",
    rating: 4,
    vibes: ["cozy", "good for groups"],
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  it("accepts a valid venueReview with vibes", () => {
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, base)).not.toThrow();
  });

  it("rejects a rating outside 1–5", () => {
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, rating: 6 })).toThrow();
  });

  it("rejects more than 8 vibes", () => {
    expect(() =>
      lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, vibes: Array(9).fill("x") }),
    ).toThrow();
  });
});
```

If `validation.test.ts` lacks `describe`/`it` imports, add them: `import { describe, it, expect } from "vitest";`.

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @guides/lexicons exec vitest run src/validation.test.ts`
Expected: PASS (3 new assertions). If "accepts valid" fails, the regen in Step 3 didn't pick up `vibes` — re-run gen+build.

- [ ] **Step 6: Commit**

```bash
git add packages/lexicons
git commit -m "feat(lexicons): add venueReview.vibes + facet#review def"
```

---

### Task 2: `rt.ts` — register review block + emit it from `tiptapToDocument`

**Files:**
- Modify: `apps/web/src/lib/doc.ts`
- Modify: `apps/web/src/lib/rt.ts`
- Test: `apps/web/src/lib/rt.test.ts`

- [ ] **Step 1: Add the `PMReviewBlock` node type to `doc.ts`**

In `apps/web/src/lib/doc.ts`, add the interface and widen `PMDoc.content`:

```typescript
export interface PMReviewBlock {
  type: "reviewBlock";
  attrs: { refId: string; placeName: string; rating: number };
}
export interface PMDoc {
  type: "doc";
  content: (PMParagraph | PMReviewBlock)[];
}
```

(`paragraphsText` already guards with `p.content ?? []`, so a `reviewBlock` contributes an empty line — acceptable; no change needed there.)

- [ ] **Step 2: Write the failing round-trip test**

Add to `apps/web/src/lib/rt.test.ts` (it already has `hirOf`, `blocks`, `ids`, `place`):

```typescript
const review = { uri: "at://did:plc:a/town.roundabout.guide.venueReview/v1", cid: "bafyreview" };
const REVIEW = ids.TownRoundaboutGuideFacet + "#review";

describe("review blocks", () => {
  it("emits a review block carrying the venueReview ref in attrs", async () => {
    const json: PMDoc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Best spots:" }] },
      { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's Cafe", rating: 4 } },
    ] };
    const hir = hirOf(await tiptapToDocument(json, { "review-1": review }));
    const bs = blocks(hir);
    const reviewNode = bs.find((b: any) => b.name === "review");
    expect(reviewNode).toBeDefined();
    expect(reviewNode.attrs).toMatchObject({ ref: review, intent: "card" });
    // the paragraph's prose is intact and the marker chars do not leak
    const para = bs.find((b: any) => b.name === "paragraph");
    expect((para.children ?? []).map((c: any) => c.content).join("")).toBe("Best spots:");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/rt.test.ts`
Expected: FAIL — no block named "review" (the `reviewBlock` node is ignored by `tiptapToDocument`, or its marker leaks).

- [ ] **Step 4: Register the review block type in `ensureInit`**

In `apps/web/src/lib/rt.ts`, change the imports and `ensureInit`:

```typescript
import { Document, registerFeatureType } from "relational-text/core";
import { init } from "relational-text/registry";
```

```typescript
const REVIEW = `${ids.TownRoundaboutGuideFacet}#review`;

let _ready: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (!_ready) {
    _ready = init().then(() => {
      // A review is a block-class feature; without registration it would render
      // as an inline mark and its block marker char would leak into the text.
      registerFeatureType({ typeId: REVIEW, featureClass: "block", void: true });
    });
  }
  return _ready;
}
```

(Keep the existing `PLACE`/`EVENT` consts.)

- [ ] **Step 5: Emit the review block in `tiptapToDocument`**

In `tiptapToDocument`, the loop currently assumes every content node is a paragraph. Replace the `json.content.forEach(...)` body so it branches on node type. Replace the `markers` accumulation + the loop with:

```typescript
  // Each top-level node contributes a one-char block marker; the block facet
  // covers only that marker. Paragraphs then add their prose; review blocks add
  // nothing (the card is self-contained, rendered from the hydrated record).
  const reviewMarkers: { start: number; end: number; ref: { uri: string; cid: string } }[] = [];

  json.content.forEach((node, idx) => {
    const markerStart = byteLen(text);
    text += idx === 0 ? FIRST_BLOCK_MARKER : NEXT_BLOCK_MARKER;
    const markerEnd = byteLen(text);

    if (node.type === "reviewBlock") {
      const ref = refMap[node.attrs.refId];
      if (ref) reviewMarkers.push({ start: markerStart, end: markerEnd, ref: { uri: ref.uri, cid: ref.cid } });
      else markers.push({ start: markerStart, end: markerEnd }); // unresolved → plain paragraph, no leak
      return;
    }

    markers.push({ start: markerStart, end: markerEnd });
    for (const tn of node.content ?? []) {
      const start = byteLen(text);
      text += tn.text;
      const end = byteLen(text);
      for (const m of tn.marks ?? []) {
        const mi = markInput(m, refMap);
        if (mi) spans.push({ byteStart: start, byteEnd: end, mark: mi });
      }
    }
  });
```

Then after `for (const m of markers) doc = doc.addBlock(...)`, add the review blocks:

```typescript
  for (const r of reviewMarkers) {
    doc = doc.addBlock(r.start, r.end, {
      $type: REVIEW,
      name: "review",
      parents: [],
      attrs: { ref: r.ref, intent: "card" },
    } as any);
  }
```

Keep the existing `markers` declaration (`const markers: { start: number; end: number }[] = []`). Remove the old paragraph-only `markers.push` inside the original `forEach` (it's now inside the branch above).

- [ ] **Step 6: Run the test to confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/rt.test.ts`
Expected: PASS (existing place/bold tests still green; new review test green).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/doc.ts apps/web/src/lib/rt.ts apps/web/src/lib/rt.test.ts
git commit -m "feat(web): emit relationaltext review block in rt codec"
```

---

### Task 3: `draft.ts` — validate review refIds

**Files:**
- Modify: `apps/web/src/lib/draft.ts`
- Test: `apps/web/src/lib/draft.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/draft.test.ts` (mirror existing style; import `buildDraft`):

```typescript
it("includes reviews and accepts a doc whose reviewBlock refId has a payload", () => {
  const doc: PMDoc = { type: "doc", content: [
    { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's", rating: 4 } },
  ] };
  const reviews = { "review-1": { place: { name: "Joe's" }, text: "Good", rating: 4, vibes: ["cozy"] } };
  const draft = buildDraft(doc, "T", "list", {}, {}, reviews);
  expect(draft.reviews).toBe(reviews);
});

it("rejects a reviewBlock refId with no review payload", () => {
  const doc: PMDoc = { type: "doc", content: [
    { type: "reviewBlock", attrs: { refId: "review-9", placeName: "X", rating: 3 } },
  ] };
  expect(() => buildDraft(doc, "T", "list", {}, {}, {})).toThrow(/review-9/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/draft.test.ts`
Expected: FAIL — `buildDraft` has 5 params, not 6; `draft.reviews` undefined.

- [ ] **Step 3: Update `draft.ts`**

Replace `referencedRefIds` and `buildDraft` with:

```typescript
import type { PMDoc } from "./doc";
import type { Draft, PlacePayload, EventPayload, ReviewPayload } from "./publish";

function referencedRefIds(doc: PMDoc): string[] {
  const out: string[] = [];
  for (const node of doc.content) {
    if (node.type === "reviewBlock") {
      out.push(node.attrs.refId);
      continue;
    }
    for (const tn of node.content ?? []) {
      for (const mark of tn.marks ?? []) {
        if ((mark.type === "placeRef" || mark.type === "eventRef") && mark.attrs?.refId) {
          out.push(mark.attrs.refId);
        }
      }
    }
  }
  return out;
}

export function buildDraft(
  doc: PMDoc,
  title: string,
  type: "curated" | "list",
  places: Record<string, PlacePayload>,
  events: Record<string, EventPayload>,
  reviews: Record<string, ReviewPayload>,
): Draft {
  if (!title.trim()) throw new Error("title is required");
  for (const refId of referencedRefIds(doc)) {
    if (!(refId in places) && !(refId in events) && !(refId in reviews)) {
      throw new Error(`referenced refId "${refId}" has no place/event/review payload`);
    }
  }
  return { title, type, doc, places, events, reviews };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/draft.test.ts`
Expected: PASS. (`ReviewPayload`/`Draft.reviews` are defined in Task 4; if running tasks out of order this won't typecheck until Task 4 — run Task 4 first or together. They share `publish.ts` types.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/draft.ts apps/web/src/lib/draft.test.ts
git commit -m "feat(web): validate review refIds in buildDraft"
```

---

### Task 4: `publish.ts` — create place→venueReview, map ref

**Files:**
- Modify: `apps/web/src/lib/publish.ts`
- Test: `apps/web/src/lib/publish.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/publish.test.ts`:

```typescript
it("creates a review's place then venueReview, points the ref at the venueReview, then the doc", async () => {
  const placeUri = "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/rp1";
  const reviewUri = "at://did:plc:me/" + ids.TownRoundaboutGuideVenueReview + "/rv1";
  const createRecord = vi
    .fn()
    .mockResolvedValueOnce({ uri: placeUri, cid: "bafyrplace" })
    .mockResolvedValueOnce({ uri: reviewUri, cid: "bafyrreview" })
    .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1", cid: "bafydoc" });

  const doc: PMDoc = { type: "doc", content: [
    { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's", rating: 4 } },
  ] };
  const draft: Draft = {
    title: "Cafes", type: "list", doc, places: {}, events: {},
    reviews: { "review-1": { place: { name: "Joe's" }, text: "Great", rating: 4, vibes: ["cozy"] } },
  };

  await publishGuide("did:plc:me", createRecord, draft);

  expect(createRecord.mock.calls[0][0]).toBe(ids.TownRoundaboutGuidePlace);
  expect(createRecord.mock.calls[1][0]).toBe(ids.TownRoundaboutGuideVenueReview);
  const reviewRec = createRecord.mock.calls[1][1];
  expect(reviewRec.place).toEqual({ uri: placeUri, cid: "bafyrplace" });
  expect(reviewRec.rating).toBe(4);
  expect(reviewRec.vibes).toEqual(["cozy"]);
  const docRec = createRecord.mock.calls[2][1];
  const REVIEW = ids.TownRoundaboutGuideFacet + "#review";
  const feat = (docRec.facets as any[]).flatMap((f) => f.features).find((x) => x.$type === REVIEW);
  expect(feat.attrs.ref).toEqual({ uri: reviewUri, cid: "bafyrreview" });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/publish.test.ts`
Expected: FAIL — `Draft` has no `reviews`; review records never created.

- [ ] **Step 3: Update `publish.ts`**

Add the payload type and `Draft.reviews`, and a creation loop. Add near the other payload interfaces:

```typescript
export interface ReviewPayload {
  place: PlacePayload;
  text: string;
  rating: number;
  vibes: string[];
}
```

Add `reviews` to `Draft`:

```typescript
export interface Draft {
  title: string;
  type: "curated" | "list";
  doc: PMDoc;
  places: Record<string, PlacePayload>;
  events: Record<string, EventPayload>;
  reviews: Record<string, ReviewPayload>;
}
```

In `publishGuide`, after the events loop and before building the document, add:

```typescript
  for (const [refId, review] of Object.entries(draft.reviews)) {
    const placeRecord = {
      $type: ids.TownRoundaboutGuidePlace,
      name: review.place.name,
      location: review.place.location,
      createdAt: nowIso(),
    };
    const placeRef = await createRecord(ids.TownRoundaboutGuidePlace, placeRecord);
    const reviewRecord = {
      $type: ids.TownRoundaboutGuideVenueReview,
      place: { uri: placeRef.uri, cid: placeRef.cid },
      text: review.text,
      rating: review.rating,
      vibes: review.vibes,
      createdAt: nowIso(),
    };
    const reviewRef = await createRecord(ids.TownRoundaboutGuideVenueReview, reviewRecord);
    refMap[refId] = { uri: reviewRef.uri, cid: reviewRef.cid } satisfies StrongRef;
  }
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/publish.test.ts`
Expected: PASS (existing place test still green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/publish.ts apps/web/src/lib/publish.test.ts
git commit -m "feat(web): publish creates place->venueReview and refs the review"
```

---

### Task 5: AppView — two-hop hydration

**Files:**
- Modify: `apps/appview/src/hydrate.ts`
- Test: `apps/appview/src/hydrate.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/appview/src/hydrate.test.ts` (inside the existing `describe("hydration", ...)`). It reuses that file's existing imports (`openDb`, `cidForRecord`, `ids`, `DocumentRow`). Real cids make `verified` true:

```typescript
  it("resolves a review block two hops: facet -> venueReview -> place", async () => {
    const db = openDb(":memory:");
    const rPlaceValue = { $type: ids.TownRoundaboutGuidePlace, name: "Joe's", createdAt: "2026-01-01T00:00:00Z" };
    const rPlaceUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/rp1";
    const rPlaceCid = await cidForRecord(rPlaceValue);
    const reviewValue = {
      $type: ids.TownRoundaboutGuideVenueReview,
      place: { uri: rPlaceUri, cid: rPlaceCid },
      text: "Great espresso", rating: 4, vibes: ["cozy"],
      createdAt: "2026-01-01T00:00:00Z",
    };
    const reviewUri = "at://did:plc:a/" + ids.TownRoundaboutGuideVenueReview + "/rv1";
    const reviewCid = await cidForRecord(reviewValue);

    const doc: DocumentRow = {
      uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/2",
      cid: "bafydoc", did: "did:plc:a", rkey: "2",
      record: {
        $type: ids.TownRoundaboutGuideDocument, title: "Cafes", text: "￼",
        createdAt: "2026-01-01T00:00:00Z",
        facets: [{ index: { byteStart: 0, byteEnd: 3 }, features: [
          { $type: ids.TownRoundaboutGuideFacet + "#review", name: "review", parents: [], attrs: { ref: { uri: reviewUri, cid: reviewCid }, intent: "card" } },
        ] }],
      },
    };

    const fetchRecord = async (uri: string) =>
      uri === reviewUri ? { cid: reviewCid, value: reviewValue }
      : uri === rPlaceUri ? { cid: rPlaceCid, value: rPlaceValue }
      : null;

    const view = await hydrateGuide(db, doc, fetchRecord, { did: "did:plc:a", handle: null, pds: null });

    expect(view.references[reviewUri].verified).toBe(true);
    expect(view.references[reviewUri].value).toEqual(reviewValue);
    expect(view.references[rPlaceUri].verified).toBe(true);
    expect((view.references[rPlaceUri].value as any).name).toBe("Joe's");
  });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @guides/appview exec vitest run src/hydrate.test.ts`
Expected: FAIL — `references[placeUri]` is undefined (current `refsFromDocument` reads `feature.ref` top-level, missing `feature.attrs.ref`; and no nested resolution).

- [ ] **Step 3: Update `hydrate.ts`**

Make `refsFromDocument` also read `feature.attrs?.ref`, add a generic nested-strongRef collector, and make `hydrateGuide` a worklist that follows nested refs:

```typescript
/** Pull all strongRef (uri, cid) pairs out of a document's facet features. */
export function refsFromDocument(record: Record<string, unknown>): RefSpec[] {
  const out: RefSpec[] = [];
  const facets = (record.facets as any[]) ?? [];
  for (const facet of facets) {
    for (const feature of facet.features ?? []) {
      // Marks carry `ref` top-level; block features (e.g. review) carry it under attrs.
      const ref = (feature?.ref ?? feature?.attrs?.ref) as { uri?: string; cid?: string } | undefined;
      if (ref?.uri && ref?.cid) out.push({ uri: ref.uri, expectedCid: ref.cid });
    }
  }
  return out;
}

/** Find every strongRef-shaped object ({uri, cid}) nested anywhere in a value. */
export function strongRefsInValue(value: unknown): RefSpec[] {
  const out: RefSpec[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.uri === "string" && typeof o.cid === "string") {
        out.push({ uri: o.uri, expectedCid: o.cid });
        return; // a strongRef is a leaf
      }
      for (const k of Object.keys(o)) visit(o[k]);
    }
  };
  visit(value);
  return out;
}

/** Assemble a fully hydrated guide view, following nested strongRefs (e.g. review → place). */
export async function hydrateGuide(
  db: Db,
  doc: DocumentRow,
  fetchRecord: FetchRecord,
  author: Actor,
): Promise<HydratedGuide> {
  const references: Record<string, ResolvedRef> = {};
  const queue = refsFromDocument(doc.record);
  while (queue.length > 0) {
    const spec = queue.shift()!;
    if (references[spec.uri]) continue; // visited (also breaks cycles)
    const resolved = await resolveRef(db, spec, fetchRecord);
    references[spec.uri] = resolved;
    if (resolved.value) {
      for (const nested of strongRefsInValue(resolved.value)) {
        if (!references[nested.uri]) queue.push(nested);
      }
    }
  }
  return { uri: doc.uri, cid: doc.cid, author, record: doc.record, references };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm --filter @guides/appview exec vitest run src/hydrate.test.ts`
Expected: PASS (existing one-hop tests still green — place/event records have no nested strongRefs, so the worklist behaves as before).

- [ ] **Step 5: Commit**

```bash
git add apps/appview/src/hydrate.ts apps/appview/src/hydrate.test.ts
git commit -m "feat(appview): two-hop hydration (facet -> venueReview -> place)"
```

---

### Task 6: Editor — Tiptap `reviewBlock` node, popup, wiring

**Files:**
- Create: `apps/web/src/lib/tiptap/reviewBlock.ts`
- Create: `apps/web/src/components/CreateReviewPopup.tsx`
- Modify: `apps/web/src/components/GuideEditor.tsx`

This task is UI; verified by `next build` + manual (consistent with the project's UI-test posture). No new vitest.

- [ ] **Step 1: Create the Tiptap block node**

`apps/web/src/lib/tiptap/reviewBlock.ts`:

```typescript
import { Node, mergeAttributes } from "@tiptap/core";

/** A block-level node standing in for a venueReview; resolved to a strongRef at publish. */
export const ReviewBlock = Node.create({
  name: "reviewBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      refId: { default: null },
      placeName: { default: "" },
      rating: { default: 0 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-review-block]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const rating = Number(node.attrs.rating) || 0;
    const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-review-block": "", class: "review-card review-card-editor" }),
      `${stars}  ${node.attrs.placeName || "Review"}`,
    ];
  },
});
```

- [ ] **Step 2: Create the authoring popup**

`apps/web/src/components/CreateReviewPopup.tsx` (mirrors `CreatePlacePopup`):

```tsx
"use client";
import { useState } from "react";
import type { ReviewPayload } from "../lib/publish";
import { ids } from "@guides/lexicons";

export function CreateReviewPopup({ onSubmit, onCancel }: { onSubmit: (r: ReviewPayload) => void; onCancel: () => void }) {
  const [placeName, setPlaceName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [vibes, setVibes] = useState("");
  return (
    <div role="dialog" aria-label="Add review">
      <input placeholder="Place name" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
      <input placeholder="Latitude (optional)" value={lat} onChange={(e) => setLat(e.target.value)} />
      <input placeholder="Longitude (optional)" value={lng} onChange={(e) => setLng(e.target.value)} />
      <label>
        Rating:
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <textarea placeholder="Review" value={text} onChange={(e) => setText(e.target.value)} />
      <input placeholder="Vibes (comma-separated)" value={vibes} onChange={(e) => setVibes(e.target.value)} />
      <button
        onClick={() => {
          const location =
            lat && lng ? { $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng } : undefined;
          onSubmit({
            place: { name: placeName, location },
            text,
            rating,
            vibes: vibes.split(",").map((v) => v.trim()).filter(Boolean),
          });
        }}
        disabled={!placeName.trim() || !text.trim()}
      >
        Add review
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `GuideEditor`**

In `apps/web/src/components/GuideEditor.tsx`:
- Import `ReviewBlock` and `CreateReviewPopup` and `ReviewPayload`.
- Add `ReviewBlock` to the editor `extensions` array: `extensions: [StarterKit, PlaceRef, EventRef, ReviewBlock]`.
- Add `"review"` to the `Popup` union type: `type Popup = "none" | "place" | "event" | "review";`
- Add review state: `const [reviews, setReviews] = useState<Record<string, ReviewPayload>>({});`
- Add an `addReview` handler:

```tsx
  const addReview = (r: ReviewPayload) => {
    const refId = `review-${counter}`;
    setCounter((c) => c + 1);
    setReviews((m) => ({ ...m, [refId]: r }));
    editor.chain().focus().insertContent({
      type: "reviewBlock",
      attrs: { refId, placeName: r.place.name, rating: r.rating },
    }).run();
    setPopup("none");
  };
```

- Add a toolbar button (no `disabled` — a block needs no selection): `<button onClick={() => setPopup("review")}>Add review</button>`
- Render the popup: `{popup === "review" && <CreateReviewPopup onSubmit={addReview} onCancel={() => setPopup("none")} />}`
- Update the `onPublish` callback signature and call to pass `reviews`. Change the prop type to `onPublish: (doc: PMDoc, places: ..., events: ..., reviews: Record<string, ReviewPayload>) => void;` and the Publish button to `onClick={() => onPublish(editor.getJSON() as PMDoc, places, events, reviews)}`.

- [ ] **Step 4: Update the publish call site (`compose/page.tsx`)**

In `apps/web/src/app/(editor)/compose/page.tsx`:

Add `ReviewPayload` to the type import:

```typescript
import type { PlacePayload, EventPayload, ReviewPayload } from "../../../lib/publish";
```

Change the `onPublish` signature and `buildDraft` call to thread `reviews`:

```typescript
  const onPublish = async (
    doc: PMDoc,
    places: Record<string, PlacePayload>,
    events: Record<string, EventPayload>,
    reviews: Record<string, ReviewPayload>,
  ) => {
    setError(null);
    try {
      if (!agent || !did) throw new Error("not signed in");
      const draft = buildDraft(doc, title, type, places, events, reviews);
      const uri = await publishGuide(did, makeCreateRecord(agent, did), draft);
      setResultUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
```

- [ ] **Step 5: Build**

Run: `pnpm --filter @guides/web build`
Expected: compiles; `/compose` route present; no TS errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tiptap/reviewBlock.ts apps/web/src/components/CreateReviewPopup.tsx apps/web/src/components/GuideEditor.tsx "apps/web/src/app/(editor)/compose/page.tsx"
git commit -m "feat(web): author review blocks in the editor"
```

---

### Task 7: Viewer — review card block component + styles

**Files:**
- Modify: `apps/web/src/components/GuideView.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add the review card component to `GuideView.tsx`**

Add a `reviewCard` factory mirroring `chip(...)`, and register it under the block name `review`. It reads the venueReview value, then follows `value.place.uri` into `references` for the place:

```tsx
function reviewCard(refs: Record<string, ResolvedRef>) {
  return function ReviewCard({ attrs }: MarkProps) {
    const ref = attrs.ref as { uri?: string } | undefined;
    const review = ref?.uri ? refs[ref.uri]?.value : null;
    if (!review) return null;
    const rating = Number(review.rating) || 0;
    const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
    const placeRef = review.place as { uri?: string } | undefined;
    const place = placeRef?.uri ? refs[placeRef.uri]?.value : null;
    const placeName = (place?.name as string) ?? null;
    const vibes = Array.isArray(review.vibes) ? (review.vibes as string[]) : [];
    return (
      <div className="review-card">
        <div className="review-card-head">
          <span className="review-stars" aria-label={`${rating} out of 5`}>{stars}</span>
          {placeName && <span className="review-place">{placeName}</span>}
        </div>
        {review.text ? <p className="review-text">{String(review.text)}</p> : null}
        {vibes.length > 0 && (
          <div className="review-vibes">{vibes.map((v) => <span key={v} className="review-vibe">{v}</span>)}</div>
        )}
      </div>
    );
  };
}
```

Then add it to the `components` map in `GuideView`:

```tsx
  const components = {
    bold: Bold,
    italic: Italic,
    link: Anchor,
    place: chip("place", guide.references),
    event: chip("event", guide.references),
    review: reviewCard(guide.references),
  };
```

(The `MarkProps` type already has `attrs`; block components receive the same `{ name, attrs, children }` shape.)

- [ ] **Step 2: Add styles to `globals.css`**

```css
/* venueReview block card (viewer) */
.review-card {
  border: 1px solid #e2e2e2;
  border-radius: 0.6rem;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  background: #fafafa;
}
.review-card-editor { color: #444; font-style: normal; }
.review-card-head { display: flex; align-items: baseline; gap: 0.6rem; }
.review-stars { color: #e0a106; letter-spacing: 0.05em; }
.review-place { font-weight: 600; }
.review-text { margin: 0.4rem 0 0; }
.review-vibes { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.review-vibe {
  font-size: 0.8rem;
  background: #eef1f5;
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
  color: #445;
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @guides/web build`
Expected: compiles, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/GuideView.tsx apps/web/src/app/globals.css
git commit -m "feat(web): render venueReview block card in viewer"
```

---

### Task 8: AppView round-trip integration test (review path)

**Files:**
- Modify: `apps/appview/src/roundtrip.test.ts`

- [ ] **Step 1: Write the test case**

Add a second `it(...)` inside the existing `describe(...)` in `apps/appview/src/roundtrip.test.ts` (reuses its imports: `openDb`, `applyEvent`, `createApi`, `cidForRecord`, `ids`, `CommitEvent`):

```typescript
  it("hydrates a review block two hops (facet -> venueReview -> place)", async () => {
    const db = openDb(":memory:");
    const placeValue = { $type: ids.TownRoundaboutGuidePlace, name: "Joe's", createdAt: "2026-05-30T00:00:00.000Z" };
    const placeUri = "at://did:plc:author/" + ids.TownRoundaboutGuidePlace + "/rp1";
    const placeCid = await cidForRecord(placeValue);
    const reviewValue = {
      $type: ids.TownRoundaboutGuideVenueReview,
      place: { uri: placeUri, cid: placeCid },
      text: "Great espresso", rating: 4, vibes: ["cozy"],
      createdAt: "2026-05-30T00:00:00.000Z",
    };
    const reviewUri = "at://did:plc:author/" + ids.TownRoundaboutGuideVenueReview + "/rv1";
    const reviewCid = await cidForRecord(reviewValue);

    const docEvent: CommitEvent = {
      did: "did:plc:author",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "g2", operation: "create", cid: "bafyguide2",
      record: {
        $type: ids.TownRoundaboutGuideDocument, title: "Cafes", type: "list", text: "￼",
        createdAt: "2026-05-30T00:00:00.000Z",
        facets: [{ index: { byteStart: 0, byteEnd: 3 }, features: [
          { $type: ids.TownRoundaboutGuideFacet + "#review", name: "review", parents: [], attrs: { ref: { uri: reviewUri, cid: reviewCid }, intent: "card" } },
        ] }],
      },
    };
    applyEvent(db, docEvent);

    const fetchRecord = async (uri: string) =>
      uri === reviewUri ? { cid: reviewCid, value: reviewValue }
      : uri === placeUri ? { cid: placeCid, value: placeValue }
      : null;
    const resolveActorFn = async (did: string) => ({ did, handle: "author.test", pds: "https://pds.example" });
    const api = createApi({ db, fetchRecord, resolveActorFn });

    const res = await api.request("/guide/did:plc:author/g2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.references[reviewUri].verified).toBe(true);
    expect(body.references[reviewUri].value.rating).toBe(4);
    expect(body.references[placeUri].verified).toBe(true);
    expect(body.references[placeUri].value.name).toBe("Joe's");
  });
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @guides/appview exec vitest run src/roundtrip.test.ts`
Expected: PASS (Task 5's two-hop hydration makes both refs resolve + verify; the existing place case still green).

- [ ] **Step 3: Commit**

```bash
git add apps/appview/src/roundtrip.test.ts
git commit -m "test(appview): hermetic round-trip covers the review two-hop"
```

---

### Final verification

- [ ] Run the full gate locally (matches CI):

```bash
pnpm -r test && pnpm -r typecheck && pnpm --filter @guides/web build
```
Expected: all green.

- [ ] Manual: start both servers (`pnpm --filter @guides/appview start`, `pnpm --filter @guides/web dev`), sign in at `http://127.0.0.1:3000/compose`, click **Add review**, fill the form, publish. Confirm the editor shows a placeholder card, and the published guide page renders the review card (stars, text, place name, vibes) — with both hops verified.

## Notes for the implementer

- **Order:** Tasks 3 and 4 share `publish.ts` types (`ReviewPayload`, `Draft.reviews`); do Task 4 before or together with Task 3 so the web package typechecks.
- **DRY/YAGNI:** reuse `CreatePlacePopup`'s geo handling; don't add place-dedup, photos, or edit-existing (explicitly out of scope in the spec).
- The two-hop hydration is intentionally generic (`strongRefsInValue` + worklist) so it also covers any future nested ref without special-casing.

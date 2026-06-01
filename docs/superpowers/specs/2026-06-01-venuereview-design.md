# venueReview — design

Status: approved (brainstorm), 2026-06-01. Implements the backlog's
"highest-value demonstration extension": wiring `town.roundabout.guide.venueReview`
through the full round-trip. This is the architecture's frontier — it adds the
two capabilities the spike has not yet shown: **block-level entities** and
**two-hop nested references**.

Orientation: see `docs/BACKLOG.md`, the spike spec
(`docs/superpowers/specs/2026-05-30-guides-spike-design.md`), and the relationaltext
adoption (`docs/superpowers/plans/2026-06-01-adopt-relationaltext.md`).

## Decisions (from brainstorm)

- **Render as a block card**, not an inline chip — rating stars, review text,
  place name/location, and vibe tags. This builds the first block-card renderer
  (previously deferred).
- **Scope = lexicon as-is + `vibes`**: keep `place`/`text`/`rating`/`createdAt`,
  add a lightweight `vibes` string array. No blob/photo machinery.
- **Model = a relationaltext block carrying a strongRef** (Approach A). The
  review is a *block* feature whose `attrs` hold the strongRef; all card content
  comes from hydration. Rejected: (B) an inline entity with `intent:"card"`
  promoted to block-level (semantically muddy, fights the flat HIR, needs a text
  selection); (C) putting the review prose in the guide document text
  (duplicates `venueReview.text`, breaks the record-is-source-of-truth symmetry
  that place/event already use).

## Reference graph

```
town.roundabout.guide.document
  └─ facets[i]  (block, $type town.roundabout.guide.facet#review, attrs.ref ─┐)
                                                                              │ hop 1
  town.roundabout.guide.venueReview ◀─────────────────────────────────────── ┘
    ├─ rating, text, vibes, createdAt
    └─ place: strongRef ───┐ hop 2
  town.roundabout.guide.place ◀──┘
    └─ name, location?
```

Two strongRef hops is the novel part: today every facet resolves in one hop.

## §1 Data model & lexicon (`@guides/lexicons`)

- **`venueReview.json`**: add
  `"vibes": { "type": "array", "items": { "type": "string", "maxGraphemes": 64 }, "maxLength": 8 }`.
  Keep `place` (strongRef), `text` (≤3000 graphemes), `rating` (1–5),
  `createdAt`. `vibes` is optional.
- **`facet.json`**: add a `review` def mirroring `place`/`event`:
  `{ "required": ["ref"], "properties": { "ref": strongRef, "intent": { knownValues: ["card"], default: "card" } } }`.
- Regenerate types with `pnpm gen` (interactive lex-cli; generated TS is
  committed — see CI note in BACKLOG). New ids: the `venueReview` record type
  already exists in generated output; confirm the regen picks up `vibes` and the
  new `facet#review` def.

## §2 Authoring — editor write path (`@guides/web`)

- **`CreateReviewPopup.tsx`** (new): a form capturing place name, optional geo
  (lat/lng, like `CreatePlacePopup`), review text (textarea), rating (1–5 star
  picker), and vibes (tags entered comma/enter-separated). Mirrors the existing
  popup components.
- **`GuideEditor`**: add an **"Add review"** toolbar button. Unlike "Add
  place"/"Add event" (inline marks requiring a selection), a review is a block —
  the button is enabled with an empty selection and inserts a review block at the
  cursor. Editor state gains `reviews: Record<string, ReviewPayload>` where
  `ReviewPayload = { place: PlacePayload; text: string; rating: number; vibes: string[] }`.
- **Tiptap `reviewBlock` node** (new, `lib/tiptap/reviewBlock.ts`): a block-level
  atom/leaf node (not a mark), rendered in the editor as a placeholder card
  (`★★★★☆ <place name>`) using the shared chip/card CSS. Holds `refId` + display
  attrs (place name, rating) so the editor can draw the placeholder before
  publish resolves the strongRef.

## §3 Publish & two-hop write (`apps/web/src/lib/publish.ts`, `lib/rt.ts`)

- `publishGuide`: for each review (before building the document), create the
  **place** record first, then the **venueReview** record referencing that
  place's strongRef, then set `refMap[refId] = venueReview strongRef`.
- `rt.ts` `tiptapToDocument`: handle the `reviewBlock` node — emit an `addBlock`
  over the block's marker char with `$type: town.roundabout.guide.facet#review`
  and top-level `ref`/`intent` (following the existing convention where
  place/event marks put `ref`/`intent` at the feature top level and they surface
  as HIR `attrs`). Confirm via round-trip test that block attrs survive.
- The document still validates via `lexicons.assertValidRecord` before write.

## §4 AppView two-hop hydration (`apps/appview`)

- Hydration resolves `document.facets` refs into the `references` map. Today it
  resolves one hop (facet → record). For a `facet#review`, after resolving the
  `venueReview` record, also resolve that record's `place` strongRef and add the
  place to `references` (keyed by URI). Both records get explicit DAG-CBOR CID
  verification (the existing `verified` flag), reusing the cache.
- The contract is unchanged: `HydratedGuide.references[uri] = { value, verified, … }`.
  The viewer follows URIs through the map; no schema change to `HydratedGuide`.

## §5 Viewer rendering (`apps/web/src/components/GuideView.tsx`, `globals.css`)

- Add a `review` **block** component to the `components` map passed to
  `DocumentRenderer` (alongside the `place`/`event` mark chips). The renderer
  resolves custom block components by `node.name` and renders them even with no
  text children (verified in `DocumentRenderer.tsx`).
- The component reads `attrs.ref.uri` → `references` → the `venueReview` value
  (rating/text/vibes), then follows `value.place.uri` → `references` → the place
  (name/location), and renders the card: rating stars, review text, place name +
  location, vibe tags. Missing/unverified refs degrade gracefully (skip or show
  a minimal placeholder).
- New `.review-card` styles in `globals.css`.

## §6 Testing (TDD)

- **`rt.ts`**: round-trip — a doc with a `reviewBlock` → wire (block facet with
  `$type` `facet#review` and `attrs.ref`) → back; byte ranges and ref intact.
- **`publish.ts`**: a review creates place then venueReview in that order; the
  venueReview record references the place strongRef; `refMap` points at the
  venueReview; the document validates.
- **Lexicon**: `assertValidRecord` accepts a valid `venueReview` with `vibes`
  and rejects out-of-bounds (`vibes` too long, rating outside 1–5).
- **AppView**: ingest a document with a review facet; hydration resolves both
  hops; `verified` true for both records; CID-compat holds.
- **Viewer**: covered by `next build` + manual, consistent with the existing
  UI-test posture (logic is unit-tested; React pages are build-checked).

## Out of scope (explicit)

- Photos/blob uploads (separate large concern: `uploadBlob`, MIME/size, blob
  serving).
- Referencing an *existing* place (dedup) — each review creates a new place
  inline, consistent with current place authoring.
- Editing an existing review / loading reviews back into the editor (the
  create-only posture of the current editor; edit-existing is its own backlog
  item).
- Nested review blocks, review-of-review, or reviews outside a guide document.

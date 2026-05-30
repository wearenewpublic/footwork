# Guides — Spike Design

**Date:** 2026-05-30
**Status:** Approved (design); pre-implementation
**Authors:** Blaine Cook + Claude

## 1. Goal & framing

Guides is a collaborative, place-based recommendation tool: structured, utility-first
collections of places and events enriched with narrative and personal perspective, designed
to help people discover and act on local knowledge.

**This document specifies an experimental spike, not the product.** The spike is a
**reference implementation** whose primary purpose is to teach *new-to-atproto developers*
how a full round-trip works on the **live public AT Protocol network**:

> OAuth-authenticated write to your own PDS → record propagates over the network → an
> AppView indexes it → a public, search-indexable page renders it back.

The legibility of the codebase is a deliverable equal to its function. We build on existing
atproto infrastructure (real PDSes, the relay/firehose via Jetstream, existing community
lexicons), which keeps the surface area deliberately constrained.

### What this spike proves
A thin, honest end-to-end vertical that de-risks the whole stack at once and serves as a
teaching artifact. We already believe the data model works and that discovery is trivial;
the value is showing the *whole loop* working idiomatically with minimal moving parts.

## 2. Architecture & round-trip data flow

Three **conceptual** apps, two **deployables**:

- **Editor** (authenticated writer) — talks to a **PDS** via atproto OAuth. Writes records.
- **AppView** (Hono service) — consumes **Jetstream**, stores to **SQLite**, hydrates
  referenced records, serves a read API.
- **Viewer** (public reader) — server-rendered Next.js, reads *only* from the AppView.
  Indexable by search engines.

Editor + Viewer are **one Next.js app** with route groups that keep the separation legible:
`(editor)` is authenticated and writes to the PDS; `(viewer)` is public and reads the
AppView. They are bundled for expediency but structured so the conceptual split is obvious
(different data sources, different auth posture). The AppView is a separate Hono process.
A shared `lexicons` package holds lexicon JSON + generated types.

```
[Editor / Next.js] --OAuth write--> [Your PDS] --commit--> [Relay / Firehose]
                                                                |
                                                            [Jetstream]
                                                                |
                                                          [AppView / Hono]
                            (index documents + saves from firehose; hydrate place/review
                             refs via getRecord + CID verify; cache in SQLite)
                                                                |
                                                            read API
                                                                |
                                              [Viewer / Next.js SSR] --> public, indexable page
```

The two-sided split is itself a teaching point: the **writer** talks to a PDS; the
**reader** talks to an AppView. They never talk to each other directly.

## 3. Lexicons

NSID authority **`town.roundabout.guide`** (anchored to the domain `guide.roundabout.town`).
Lexicons are **designed for publication** but DNS binding and `com.atproto.lexicon.schema`
publication are **deferred**. We define them locally and reference the namespace as if
published.

General principle (from relationaltext): **standalone, reusable metadata lives in standalone
records; intrinsic, non-reusable data lives inline.** Reuse existing community lexicons
rather than reinventing geo/event types.

### Built end-to-end in the spike
- **`town.roundabout.guide.document`** — the guide. UTF-8 `text` + `facets[]` (the
  relational-text model, see §4) + `title` + a `type` display flag (`curated` | `list`,
  behavior-neutral; purely a rendering hint).
- **`town.roundabout.guide.place`** — a standalone record wrapping
  `community.lexicon.location.*` (address / geo / fsq) as its payload, plus a display name.
  *Reuse, not reinvent.*
- **`town.roundabout.guide.save`** — a `strongRef` (URI + CID) to a `document` record. The
  teachable cross-repo reference.
- **`community.lexicon.calendar.event`** — reused for events, **built end-to-end but
  extremely minimal** (e.g. name + `startsAt`). Note the instructive contrast with `place`:
  a community *location* is an embedded **object**, so it needs our `place` wrapper record to
  become referenceable; a community *event* is already a **record** with its own rkey, so a
  facet `strongRef`s it directly — no wrapper. The editor can create a minimal event record
  and facet-link it.

### Designed + stubbed as extension points (NOT fully built)
- **`town.roundabout.guide.venueReview`** — the "rich wrapper": intrinsic review copy +
  rating, `strongRef`s a `place`, and may point at further standalone records (photos,
  vibes). Lexicon is written and a render-lens stub exists, but it is not the focus of the
  round-trip. (Building it fully is the clearest demo of facet → review → place depth, at
  real cost — explicitly out of scope for the spike unless revisited.)

## 4. The relational-text document & rendering lenses

The document model follows [relationaltext](https://relationaltext.org):

- A document is **UTF-8 text + a flat `facets[]` of typed, byte-ranged annotations**. There
  is **no separate `embeds[]`/blocks array**. Structurally this is Bluesky-richtext-shaped.
- A **facet** = a byte range (`byteStart`/`byteEnd`) + a `feature` that either:
  - **formats** the span (bold/italic — Bluesky-compatible), or
  - carries a **typed `strongRef`** to a standalone record (`place`, later `venueReview`,
    `event`) **plus an optional rendering *intent*** (e.g. `hero` | `card` | `inline`).
- **Intent is not layout.** The facet declares the *relation* plus an optional intent hint;
  the **viewer applies a lens** that maps `(annotation type + intent + context)` →
  concrete presentation (bare link, inline chip, or full card). This is how we get
  block-card expressiveness out of a uniform inline-facet structure: the "block card" is a
  *rendering outcome of a lens*, not a different schema shape.
- **Prose is primary; structure decorates anchored text spans.** A place card anchors to the
  place's name where it appears in the narrative — text first, structure draped over it.

The spike ships a **small fixed set of lenses**, not a general lens engine:
- `link → anchor`
- `placeRef → card | chip` (driven by intent)
- `eventRef → card` (minimal)
- formatting → markup
- (`venueReview` → stub lens)

## 5. Editor flow

- **atproto OAuth confidential client**, implemented server-side in the Next.js app, using
  the `atproto-oauth` skill (PAR, DPoP, PKCE, `private_key_jwt`). A single OAuth client for
  the spike, with a client-metadata document.
- Compose prose; selecting text and inserting a place (or event) creates/links the
  standalone record (`place` wrapper, or a minimal `community.lexicon.calendar.event`) and
  adds a facet over the selected span.
- **Publish** writes the record(s) to your PDS via `com.atproto.repo.*`.
- The editor UX is intentionally minimal. The hardest interaction-design problems (rich
  facet authoring, remix) are explicitly deferred.

### Editor surface (decision deferred to the plan)
The prose-plus-byte-ranged-facets model needs a rich-text editing surface that can maintain
facet ranges as text is edited. Leading candidate is **ProseMirror** (or a variant /
wrapper such as Tiptap) because its document model maps cleanly onto typed inline marks over
text ranges. A more **Next-aligned** option (e.g. a React-native rich-text approach) is also
on the table. The implementation plan will choose the surface; the key requirement is that
inserting/maintaining facet ranges is first-class, since facets are the core of the model.

## 6. AppView (Hono + SQLite)

- **Jetstream consumer** filtered to `town.roundabout.guide.document` +
  `town.roundabout.guide.save`. Upserts records into SQLite.
- **Resolution strategy = hybrid (Approach 3):**
  - Index `document` + `save` from the firehose.
  - On read, hydrate each facet's `strongRef` via `com.atproto.repo.getRecord` against the
    **referent's** PDS, **verify the CID** matches, and **cache** the resolved record in
    SQLite.
  - Opportunistically backfill the cache if a referenced record happens to appear on the
    firehose.
  - This deliberately exercises *both* firehose ingestion **and** direct authenticated repo
    reads + content-addressing integrity — the richest atproto teaching surface in the spike.
- **Identity:** resolve author DID → handle and a minimal profile for display, using the
  `atproto-identity-resolution` skill.
- **Read API (JSON):**
  - `GET /guide/:aturi` — denormalized, hydrated, CID-verified view of one guide.
  - `GET /guides` — recent guides list.
  - `GET /profile/:did/saves` — a user's saved guides.

## 7. Viewer (public, indexable)

- Next.js **SSR** page per guide, reading the AppView read API.
- Server-rendered HTML + canonical URL + OpenGraph/JSON-LD metadata so pages are genuinely
  search-indexable. (Discovery is "trivial" — the point is to do it *properly*.)
- Renders prose with the §4 lenses applied.

## 8. Save feature

- A **Save** button in the viewer (authenticated) writes a `save` record (`strongRef` to the
  guide) to *your own* repo.
- The AppView indexes `save` records from the firehose; a profile page lists them.
- Demonstrates cross-repo references, content-addressing, and referential integrity with
  minimal code.
- **Remix is deferred** — it is mostly an interaction-design problem.

## 9. Explicitly deferred / out of scope

- Remix.
- Forum integration / crossposting (the eventual "social loop" destination).
- Verified-author attestations (verification is author-level metadata, independent of the
  guide; a display-side flag only).
- Real DNS-bound lexicon publication (`com.atproto.lexicon.schema`).
- Ranking / rich discovery beyond a simple list + lookup.
- **panproto** — its likely future home is the AppView ingestion phase as a universal
  any-vocabulary-in compatibility bridge, and lexicon versioning/breaking-change discipline
  at publication time. Not used in the spike. (panproto's "protolens" is a schema-migration
  morphism, a different concept from relationaltext's rendering "lens"; it does not write our
  renderer.)
- Full editor interaction design.

## 10. Testing

Test-driven (superpowers TDD). The centerpiece is a **round-trip integration test**:

1. Write `document` + `place` records (to a test PDS or fixture).
2. Ingest via the Jetstream consumer path.
3. Query the read API.
4. Assert the hydrated, CID-verified, denormalized view.

Plus unit tests for: facet parse/render and lens application, CID verification, and lexicon
validation (`@atproto/lexicon`).

## 11. Repo structure

pnpm monorepo:

- `packages/lexicons` — lexicon JSON + generated TypeScript types (`@atproto/lex-cli`).
- `apps/web` — Next.js app containing both editor (`(editor)`, authenticated, writes to PDS)
  and viewer (`(viewer)`, public, reads AppView).
- `apps/appview` — Hono service: Jetstream consumer + SQLite + read API.

The README is framed as a **guided tour for the newcomer audience**, walking the round-trip
in the order data actually flows.

## 12. Foundational decisions (summary)

| Axis | Decision |
|------|----------|
| Foundation | AT Protocol, **live public network** (real PDSes, existing lexicons) |
| Spike goal | Thin end-to-end round-trip **reference implementation** for new-to-atproto devs |
| Language/stack | TypeScript throughout; **Hono** AppView; **Next.js** editor + viewer |
| Guide types | One record; `curated`/`list` is a display flag; verification deferred |
| In-scope loop | Editor (OAuth write) + Save (strongRef) + AppView (index + hydrate) + Viewer (SSR) |
| Data model | relationaltext: UTF-8 + typed byte-ranged facets → standalone records; intent/render split |
| Reused lexicons | `community.lexicon.location.*` (place wrapper); `community.lexicon.calendar.event` (event, built minimal) |
| Editor surface | TBD in plan — ProseMirror/variant (leading) vs Next-aligned rich text |
| NSID authority | `town.roundabout.guide` (publication designed, DNS deferred) |
| Storage | SQLite |
| Ref resolution | Hybrid: firehose index + on-demand `getRecord` hydration + CID verify + cache |
| panproto | Deferred (future AppView-ingestion compatibility bridge) |

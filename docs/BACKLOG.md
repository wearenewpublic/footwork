# Guides — Backlog

> Status as of 2026-06-01: the **5-plan spike is complete and merged to `main`**. The full
> round-trip is live-verified on the public AT Protocol network: OAuth write → PDS → Jetstream
> ingest → identity resolution → `getRecord` hydration → CID verification → public SSR render.
> Nothing below blocks that thesis; this is the "if we keep going" list.

## Orientation (how to pick up)

- **Architecture & decisions:** `docs/superpowers/specs/2026-05-30-guides-spike-design.md`
- **Plans (one per subsystem, each with full rationale):** `docs/superpowers/plans/`
  - `2026-05-30-guides-foundation.md` — `@guides/lexicons`
  - `2026-05-30-guides-appview.md` — `@guides/appview` (Hono + SQLite + Jetstream)
  - `2026-05-31-guides-editor-writepath.md` + `2026-05-31-guides-editor-ui.md` — `@guides/web` editor
  - `2026-06-01-adopt-relationaltext.md` — viewer + the relational-text adoption (supersedes `2026-06-01-guides-viewer.md`)
- **Live-verification notes (incl. CID-compat + the accepted render limitation):** `docs/superpowers/notes/`
- **Working method:** brainstorming → writing-plans → subagent-driven-development (fresh subagent per task + spec & quality review). Use git worktrees/branches per plan; merge via finishing-a-development-branch.
- **Verify a published guide's CID-compat:** `pnpm --filter @guides/appview exec tsx scripts/verify-cid.ts <guide-at-uri>` (run where the network reaches atproto).
- Packages: `@guides/lexicons` (compiles to `dist/`, `prepare` hook), `@guides/appview`, `@guides/web` (Next 16, Tiptap, `relational-text`). `relational-text`: import narrow subpaths (`/core`, `/registry`) — the barrel drags in `@automerge/automerge`.

---

## Highest-leverage next steps (gate "someone else can use it")

- [ ] **Production OAuth.** The editor only runs the **localhost dev client** (`http://localhost` loopback). `auth.tsx` has the production branch (`${origin}/client-metadata.json`) but it's **untested and there's no hosted metadata doc**. _Where:_ `apps/web/src/lib/auth.tsx`. _Approach:_ serve a `client-metadata.json`, test the hosted-client flow, document deploy.
- [ ] **Discovery surface.** `/guides` is a flat "recent 50" with **no pagination/search/ranking** — the brief's "publicly discoverable" is half-done (per-guide pages are indexable via OG/JSON-LD). _Where:_ `apps/appview/src/{db,api}.ts`, a new web route. _Approach:_ cursor pagination on `listDocuments`, a `/` discovery page, optional search.
- [ ] **CI.** No automated test/build/lint gate. _Approach:_ GH Actions running `pnpm -r test` + `tsc --noEmit` + `next build`. Note `pnpm gen` (lexicons) is interactive — needs a non-interactive flag for CI.

## Deferred by design (product scope — see spec §9)

- [ ] **Remix** — fork/copy another user's guide. (Save exists; remix is mostly interaction design.)
- [ ] **Forum integration / crossposting** — the editorial↔grassroots "social loop" from the original brief. Nothing built.
- [ ] **Verified-author attestations** — `curated`/`list` is a display-only flag today; verification is author-level metadata, unbuilt. _Approach:_ `atproto-attestation` skill (badge.blue) is installed.
- [ ] **DNS-bound lexicon publication** — bind `town.roundabout.guide.*` to `guide.roundabout.town` and publish as `com.atproto.lexicon.schema`. Currently local-only. _Approach:_ `atproto-publish-lexicon` skill.
- [ ] **panproto at AppView ingestion** — the "universal any-vocabulary-in compatibility bridge." (relational-text, already adopted, is built on panproto.)

## Built minimal / stubbed (present but thin)

- [ ] **`venueReview`** — the richest demo of the architecture (facet → review → place → photos/vibes). Lexicon record type exists but is **never built or wired**. _Where:_ `packages/lexicons/lexicons/town/roundabout/guide/venueReview.json`. **Highest-value demonstration extension.**
- [ ] **Events** — only `name` + `startsAt`. `community.lexicon.calendar.event` also has description/endsAt/mode/status/locations/rsvpExpected.
- [ ] **Places** — editor captures `name` + optional **geo** lat/lng only; lexicon union also allows address/fsq. No geocoding/map.
- [ ] **Editor UX** — bold/italic + add-place/event popups. No link-authoring UI (the lens supports a link mark), no headings/lists, no media, no drag/drop.
- [ ] **Viewer chips** — inline only; **block cards** (map, RSVP, photos) deferred.
- [ ] **Edit existing guides** — create-only. The lens round-trips (`documentFromWire` → Tiptap); only the load-into-editor wiring is missing. _Where:_ `apps/web/src/lib/rt.ts`, editor.

## Technical follow-ups (discovered during the build)

- [ ] **Jetstream backoff reconnect.** The `error` handler is in place (a drop no longer crashes) and `APPVIEW_CURSOR` replay works, but **auto-reconnect is not** — a naive `close→start()` loop SIGABRT'd and was reverted. _Where:_ `apps/appview/src/jetstream.ts`. _Approach:_ single in-flight attempt + exponential backoff, or the client's built-in reconnect.
- [ ] **Validate ingested records.** AppView trusts firehose shape (validates-by-use at hydration). _Where:_ `apps/appview/src/ingest.ts`. _Approach:_ `lexicons.assertValidRecord` before indexing.
- [ ] **Opportunistic place/event backfill.** Cache is populated only by on-read `getRecord`. _Approach:_ also subscribe those collections on Jetstream and warm the cache.
- [ ] **Relational-text format adapters.** We build docs via the `Document` API (`addMark`/`addBlock`), not the registered ProseMirror/Tiptap adapter. Registering formats (`registerFormat`) unlocks paste-from-Markdown, import/export across the 40+ formats, and full lens round-tripping. _Where:_ `apps/web/src/lib/rt.ts`.

## Accepted limitation (today's known bug)

- [ ] **Entity partially overlapping a format span → two chips** instead of one chip with nested formatting. Upstream gap: `toHIR` emits flat per-segment marks (even with `featureClass: "entity"` — verified), and `relational-text-react`'s `DocumentRenderer` wraps each text node independently (no coalescing/nesting). Rare in practice; left as-is. _Fix path:_ a coalescing/nesting inline renderer over the flat HIR, or an upstream fix. _Detail:_ `docs/superpowers/notes/2026-06-01-relationaltext-verification.md`.

## Production-readiness gaps

- [ ] **AppView hardening** — no auth, no rate limiting, single-file SQLite, indexer + API in one process; not horizontally scalable.
- [ ] **No UI-layer tests** — React components/pages verified by `next build` + manual only. (Logic is well-tested: lexicons, rt builder, publish, AppView ingest/hydrate/CID, hermetic round-trip.) _Approach:_ component tests + an e2e harness across editor↔appview↔viewer.
- [ ] **Web UX** — minimal error/loading states (a 404 + Save button states). No styling system beyond `globals.css`.

## Minor cleanups

- [ ] `publishGuide(repo, …)` — unused `repo` param (kept for signature symmetry). _Where:_ `apps/web/src/lib/publish.ts`.
- [ ] `listDocuments` orders by ms-granularity `indexedAt` → nondeterministic for same-ms inserts (irrelevant at spike volume). _Where:_ `apps/appview/src/db.ts`.
- [ ] **Package READMEs** — `@guides/lexicons`/`appview`/`web` each want a short "what this is / how it fits the round-trip" README (it's a teaching/reference artifact).

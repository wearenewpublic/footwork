# Live Round-Trip Verification — 2026-05-31

Plan 4, Task 7: the first real end-to-end round-trip on the live AT Protocol network.

## Outcome: ✅ FULL ROUND-TRIP VERIFIED

Published guide: `at://did:plc:3vdrgzr2zybocs45yfhcr6ur/town.roundabout.guide.document/3mn6k4jgkxs2a`
(author `blaine.bsky.social`, PDS `morel.us-east.host.bsky.network`; title "test", text "pelmeni eating festival", referencing a `place` and a `community.lexicon.calendar.event`).

Every stage confirmed against the real network:

1. **Write** — OAuth sign-in (BrowserOAuthClient) + Tiptap editor + publish pipeline created the place, event, and document records on the real PDS.
2. **Firehose ingest** — the AppView (Jetstream consumer, replayed via `APPVIEW_CURSOR`) indexed the document; it appears in `GET /guides`.
3. **Identity resolution** — `GET /guide/:did/:rkey` resolved the author DID → handle `blaine.bsky.social` + PDS endpoint.
4. **Hydration + CID verification** — referenced place/event records were fetched via `getRecord` and their CIDs recomputed; both `verified: true`.

## CID-compat caveat (Plan 2): RESOLVED

The AppView's `cidForRecord` (DAG-CBOR → SHA-256 → CIDv1) produces **byte-identical** CIDs to what the PDS computed, confirmed by `scripts/verify-cid.ts`:

- place `pelmeni`  → `bafyreiez4txipkrhfukd4d7uw3ec4dl7xxzvvcaxuch2rpcl6ruopwwlbu` (facet = pds = computed)
- event           → `bafyreibxcievfoxksnbqzkbl6ch7ttjsvz3rqmgxvwppq6h7e6ixffwfym` (facet = pds = computed)

Our scalar-only-record assumption holds; no reconciliation needed.

## Bugs found & fixed during manual testing

- web: `allowedDevOrigins: ["127.0.0.1"]` (Next 16 blocked cross-origin dev resources; OAuth requires the loopback IP).
- web: added `/auth/callback` route (Next file-routing needs it; the ionosphere reference was a Vite SPA).
- web: `GuideEditor` toolbar now reacts to selection changes (Tiptap v3 `useEditor` doesn't re-render React on selection; buttons were stuck disabled).
- appview: Jetstream `error` handler so a transient WS drop no longer crashes the process; `APPVIEW_CURSOR` replay added. (A naive auto-reconnect was reverted — it tight-looped to SIGABRT against an unreachable endpoint; proper backoff reconnect is a follow-up.)

## Environment note

The agent's command environment could not complete TLS to AWS-hosted atproto endpoints (plc.directory, *.host.bsky.network, jetstream) until the network config was updated mid-session; the browser's path was unaffected throughout.

## Observations / follow-ups

- The document carried several facets referencing the same event (event mark applied across multiple text-node runs); the `references` map dedupes by URI — benign, both verified.
- Follow-ups: backoff-guarded Jetstream reconnect; opportunistic place/event firehose backfill; pagination.

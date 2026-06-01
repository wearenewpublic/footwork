# Guides

A place-based, collaborative recommendation tool built as a **reference implementation** for [AT Protocol](https://atproto.com). It demonstrates a full round-trip on the live public network: an OAuth write to your PDS → the firehose → an AppView indexes it → a public server-rendered page renders it back.

It's a teaching spike — the goal is to show *how the pieces fit*, end to end, with real lexicons on the live network.

## What it does

- **Write:** sign in with your atproto handle (client-side OAuth) and compose a guide in a rich editor — prose plus inline **place**/**event** chips and **review** cards.
- **Model:** a guide is a [relationaltext](https://www.npmjs.com/package/relational-text) document — UTF-8 text + byte-ranged typed facets that `strongRef` standalone records (`place`, `community.lexicon.calendar.event`, `venueReview`). NSID authority `town.roundabout.guide`.
- **Index:** an AppView ingests the Jetstream firehose, verifies each record's CID byte-for-byte, and hydrates references (including two-hop: a review → its venueReview record → its place).
- **Read:** public SSR guide pages, profiles, discovery list, OG/JSON-LD — all rendered from the AppView's hydrated view.

## Layout

```
packages/lexicons   @guides/lexicons — lexicon JSON + lex-cli-generated types/validators + facet helpers
apps/appview        @guides/appview  — Hono + SQLite + Jetstream; pure ingest, CID verification, read API
apps/web            @guides/web      — Next.js editor (Tiptap) + public viewer; client-side OAuth
docs/               design specs, plans, and verification notes (docs/superpowers/)
```

## Develop

Requires Node 22+ and [pnpm](https://pnpm.io) 10.

```bash
pnpm install                         # builds @guides/lexicons dist via its prepare hook
pnpm -r test                         # unit + hermetic round-trip tests
pnpm -r typecheck
pnpm --filter @guides/appview start  # AppView on :3001 (connects to the live Jetstream)
pnpm --filter @guides/web dev        # editor + viewer on :3000 (use http://127.0.0.1:3000 — atproto OAuth needs the loopback host)
```

Deploying behind a public HTTPS origin: see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (production OAuth `client-metadata.json`).

## Status

Spike complete and live-verified end to end on the public AT Protocol network. Remaining/deferred work is tracked in [`docs/BACKLOG.md`](docs/BACKLOG.md).

## License

[Apache-2.0](LICENSE) © New Public

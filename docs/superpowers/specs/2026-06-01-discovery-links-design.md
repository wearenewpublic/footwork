# Discovery links — design

Status: approved (brainstorm), 2026-06-01.

## Problem

The pages exist but nothing links them: the home page (`/`) is an intro with no
links (you can't reach `/compose`), the guide-page byline is plain text (not a
link to the author's `/profile`), and there's no listing of published guides
anywhere (the AppView's `GET /guides` recent-50 endpoint has no web consumer).

## Goal

Make the app navigable and published guides findable, with minimal links — not
the full discovery surface (search/pagination/ranking stay deferred).

## §1 Global nav

In the root layout (`apps/web/src/app/layout.tsx`), add a `<nav className="nav">`
inside `<body>` above `{children}`: a **Guides** link (`/`) and a **Compose**
link (`/compose`). Present on every page. Minimal styling in `globals.css`
(flex row; Compose pushed right).

## §2 Recent guides on the home page

- Add `listGuides()` to `apps/web/src/lib/appview.ts`: `GET /guides` →
  `{ guides: { uri: string; did: string; record: Record<string,unknown> }[] }`;
  return the array (or `[]` on non-OK), `cache: "no-store"` like the siblings.
- `apps/web/src/app/page.tsx` becomes an async server component: keeps the intro,
  then a "Recent guides" section. Each item: the guide **title**
  (`record.title`, fallback "Untitled guide") as a `<Link>` to
  `/guide/<did>/<rkey>` (rkey via `parseAtUri`), and a small "by <did>"
  (`.byline`) linking to `/profile/<did>` with the did shortened for display
  (e.g. first 16 chars + "…"). Empty state: "No guides yet — " + a `<Link
  href="/compose">compose the first one</Link>".
- The `/guides` endpoint stays unchanged (returns `did`, not handle — resolving
  handles for all 50 would be N identity lookups per load; handle-on-listing is
  deferred with the discovery surface).

## §3 Cross-links

Guide page (`apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx`): wrap the
byline author in `<Link href={`/profile/${guide.author.did}`}>` (link text stays
`guide.author.handle ?? guide.author.did`). The profile page already links its
saved-guide items.

## §4 Shared AT-URI parser

Extract `parseAtUri(uri): { did: string; collection: string; rkey: string } | null`
into `apps/web/src/lib/aturi.ts`. Use it in the home list and in the profile
page (which currently inlines the regex `^at:\/\/([^/]+)\/[^/]+\/([^/]+)$`).

## §5 Testing

- **Unit (vitest, node):**
  - `parseAtUri`: a valid `at://did:plc:x/town.roundabout.guide.document/abc` →
    `{ did:"did:plc:x", collection:"town.roundabout.guide.document", rkey:"abc" }`;
    a malformed string → `null`.
  - `listGuides`: mocked fetch returning `{ guides: [...] }` → the array;
    non-OK response → `[]`.
- **UI:** nav + home list + byline link verified by `next build` + manual
  (project editor/viewer UI posture).

## Out of scope

- Search, pagination, ranking, filtering (the deferred "discovery surface").
- Resolving author handles in the listing (show did for now).
- Listing a user's *authored* guides on their profile (profile shows saves).

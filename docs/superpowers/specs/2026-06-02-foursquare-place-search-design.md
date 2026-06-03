# Foursquare-backed place search — design

Status: approved (brainstorm), 2026-06-02.

## Problem

Place capture is manual today: in `CreatePlacePopup` (and the place section of
`CreateReviewPopup`) the user types a name and optionally raw latitude/longitude.
That's error-prone and yields no structured address. We want real place search.

## Why Foursquare (not Google)

Google Maps Platform terms forbid what this app does: persisting Places content
(name/address/lat-lng) in **public, permanent, portable** atproto records that
**independent** viewers render on **any** map. Only `place_id` is storable
indefinitely; other content can't be cached/stored beyond ~30 days, and results
shown on a map must use a Google map. That's incompatible with an open,
decentralized reference implementation.

**Foursquare Open Source Places** (Apache-2.0 open dataset, served via the
Foursquare Places API) permits storage/redistribution and rendering on any map,
and the community lexicon already models it (`community.lexicon.location.fsq`).
Decision (from brainstorm): use Foursquare; server-side key handling.
Sources: Google Maps security guidance + Places policies; Foursquare Places API
docs (see brainstorm notes).

## §1 Data model (`@guides/lexicons`)

- `town.roundabout.guide.place.json`: change `location` from a single union
  member to an **array**:
  `"location": { "type": "array", "items": { "type": "union", "refs": ["community.lexicon.location.address","community.lexicon.location.geo","community.lexicon.location.fsq"] } }`.
  (`name`/`createdAt` unchanged.) Regenerate types via `pnpm gen`.
- On selecting a Foursquare place we persist three encodings from one result:
  - `community.lexicon.location.geo` — `latitude`, `longitude`, `name`
  - `community.lexicon.location.address` — `street`, `locality`, `region`,
    `country`, `postalCode`, `name` (omit absent fields; `country` is required by
    the lexicon — if Foursquare returns no country, the address encoding is
    skipped rather than written invalid)
  - `community.lexicon.location.fsq` — `fsq_place_id`, `latitude`, `longitude`,
    `name`
- No new lexicon type needed. Note: this is a breaking shape change to `place`
  (single → array); acceptable at spike data volume (we don't re-validate stored
  records).

## §2 Server-side proxy (`apps/web`)

`FOURSQUARE_API_KEY` is server-only (never in the client bundle/network). Two
Next route handlers under `apps/web/src/app/api/places/`:

- `GET /api/places/autocomplete?q=<text>&session=<token>` → proxies Foursquare
  `GET https://places-api.foursquare.com/autocomplete` (headers:
  `Authorization: Bearer $FOURSQUARE_API_KEY`, the required Places API version
  header, `Accept: application/json`; query: the search text + session token,
  `types=place`). Returns a trimmed list `{ results: { fsqPlaceId, name, formatted }[] }`.
- `GET /api/places/details?id=<fsqPlaceId>&session=<token>` → proxies the
  Foursquare Place Details endpoint for that id, returns
  `{ fsqPlaceId, name, latitude, longitude, address: { street?, locality?, region?, country?, postalCode? } }`.

A pure module `apps/web/src/lib/places.ts` owns Foursquare request construction
and **response→our-shape mapping** (no I/O) so it is unit-testable without
network; the route handlers are thin (read query, call fetch, map, JSON). Basic
input validation (missing `q`/`id` → 400); upstream/non-OK → `{ error }` + 502.
The exact Foursquare response JSON paths (e.g. `latitude`/`longitude`,
`location.address`/`locality`/`region`/`postcode`/`country`, `fsq_place_id`/`fsq_id`,
and the version header value) are confirmed against the live API during planning;
the mapper centralizes them.

## §3 Editor UX (`apps/web`)

New client component `PlaceSearch` (`src/components/PlaceSearch.tsx`):
- A search `<input>`; on input (debounced ~250ms, min ~3 chars) it calls
  `/api/places/autocomplete` with a per-session 32-char alphanumeric token
  (generated when a search session starts) and renders a suggestions dropdown.
- On selecting a suggestion it calls `/api/places/details`, then surfaces a
  read-only summary (name + formatted address) and holds the resulting
  `PlacePayload`. The display name defaults to the Foursquare name and is
  editable.
- Exposes `onSelect(payload: PlacePayload)` / a controlled value + a clear
  action.
- A small "Powered by Foursquare" attribution is shown in the component.

It **replaces** the name+lat+lng inputs in both `CreatePlacePopup` and the place
section of `CreateReviewPopup`. Submit is enabled only once a place is selected.
Network/empty states handled (no results, request error → inline message).

## §4 Publish + payload (`apps/web/src/lib/publish.ts`)

- `PlacePayload` becomes `{ name: string; location: LocationEncoding[] }` where
  `LocationEncoding` is a `Record<string, unknown>` carrying a community
  `$type` (geo/address/fsq). `ReviewPayload.place` uses the same.
- `makePlaceRecord` writes `{ $type: place, name, location, createdAt }` with
  `location` as the array (built by `PlaceSearch`/a helper from the details
  response). `rt.ts` and the AppView are unaffected (place is hydrated; the chip
  shows `name`). Update existing publish/draft/appview tests for the array shape.

## §5 Attribution & licensing

Display "Powered by Foursquare" in the search UI. The OS Places dataset's
license permits storing and redistributing the place data in public records.

## §6 Testing

- **Unit (vitest, node):** `lib/places.ts` mappers — a sample Foursquare
  autocomplete response → trimmed suggestions; a sample details response → our
  `{ fsqPlaceId, name, lat, lng, address }`; and the details→`PlacePayload`
  location-array builder (produces geo + address + fsq; skips address when
  `country` is absent).
- **Existing tests** updated for `location: []` array (publish, draft, appview
  hydrate/roundtrip as needed).
- **UI/routes:** `next build` + manual (a live autocomplete once the key is set).

## §7 Config / deploy

- Plan includes **Foursquare setup**: create a Foursquare developer account,
  a project, and a Places **Service API key**; note the required API version
  header value.
- `FOURSQUARE_API_KEY`: local `apps/web/.env.local` (gitignored); on the sprite,
  set on the `web` service env (`sprite-env services` env). Never committed.
- `docs/DEPLOYMENT.md`: add a short note about the env var.

## Out of scope

- Rich venue metadata (categories/website/hours/ratings) — location encodings
  only.
- A map view / pin rendering (the deferred viewer map card; coords are now
  stored to enable it later).
- Backfilling/migrating existing single-`location` place records.
- Client-side Foursquare calls (key stays server-side).

## Revision (2026-06-03) — manual "near" via Place Search

Live verification revealed Foursquare **autocomplete ignores a textual location**
and returns ~nothing for specific venue names without an `ll` coordinate bias
(e.g. "blue bottle coffee" → 0 results un-biased, 8 with `ll`). Rather than
prompt for browser geolocation, we use a **manual "near" field** (user decision)
— and the **Place Search** endpoint (`/places/search?query=&near=<text>`), which
*does* accept a textual `near` and returns full place objects (fsq_place_id,
name, latitude, longitude, location incl. formatted_address) in one call.

Changes from the original design:
- Endpoint: `/autocomplete` + `/places/{id}` (+ session token) → a single
  **`/places/search?query=&near=&fields=fsq_place_id,name,latitude,longitude,location&limit=8`**.
  No session token (search isn't session-billed like autocomplete).
- Proxy: one route `GET /api/places/search?q=&near=` (replaces the autocomplete +
  details routes). Returns `{ results: { name, formatted, payload }[] }` where
  `payload` is the full `PlacePayload` (each result reuses `mapDetails` +
  `detailsToPayload`, since a search result has the same shape as a details
  response). `formatted` = `location.formatted_address`.
- UX: `PlaceSearch` gains a **"near"** input (city/area) alongside the query;
  results show name + formatted address; on pick → `onSelect(payload)`. No
  geolocation permission.
- The `geo`+`address`+`fsq` persistence and the lexicon array are unchanged.

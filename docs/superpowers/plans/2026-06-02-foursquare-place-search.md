# Foursquare Place Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual place entry (name + raw lat/lng) with Foursquare-backed place search, persisting `geo` + `address` + `fsq` community-location encodings on each place record.

**Architecture:** A server-side proxy (`/api/places/*`) holds `FOURSQUARE_API_KEY` and calls the Foursquare Places API (autocomplete → details); a pure `lib/places.ts` builds requests and maps responses (unit-tested); a `PlaceSearch` client component does type-ahead and feeds a `PlacePayload` into both popups; `place.location` becomes an array of community encodings.

**Tech Stack:** Next 16 route handlers, TypeScript, vitest, Foursquare Places API (v `2025-06-17`).

**Spec:** `docs/superpowers/specs/2026-06-02-foursquare-place-search-design.md`

## Confirmed Foursquare facts (from docs)
- Autocomplete: `GET https://places-api.foursquare.com/autocomplete?query=<q>&types=place&session_token=<t>&limit=8`
- Details: `GET https://places-api.foursquare.com/places/<fsq_place_id>?fields=fsq_place_id,name,latitude,longitude,location`
- Headers: `Authorization: Bearer <key>`, `X-Places-Api-Version: 2025-06-17`, `Accept: application/json`
- Place object: top-level `fsq_place_id`, `name`, `latitude` (number), `longitude` (number); `location: { address, locality, region, postcode, country, ... }`.
- The **details** response shape is documented (used for stored data). The **autocomplete** result nesting is not fully public, so its mapper is defensive + has a live-verify step (suggestions only need an id + label; the authoritative data comes from details).

## File structure

| File | Responsibility | Action |
|---|---|---|
| `packages/lexicons/lexicons/town/roundabout/guide/place.json` | `location` → array of encodings | Modify + regen |
| `packages/lexicons/src/validation.test.ts` | place-with-array validation test | Modify |
| `apps/web/src/lib/publish.ts` | `LocationEncoding`, `PlacePayload.location?: LocationEncoding[]`, omit-empty | Modify |
| `apps/web/src/lib/publish.test.ts` | fixture → array | Modify |
| `apps/web/src/lib/places.ts` | pure Foursquare URL/header builders + response mappers + `detailsToPayload` | Create |
| `apps/web/src/lib/places.test.ts` | unit tests | Create |
| `apps/web/src/app/api/places/autocomplete/route.ts` | proxy | Create |
| `apps/web/src/app/api/places/details/route.ts` | proxy | Create |
| `apps/web/src/components/PlaceSearch.tsx` | type-ahead component | Create |
| `apps/web/src/components/CreatePlacePopup.tsx` | use PlaceSearch | Modify |
| `apps/web/src/components/CreateReviewPopup.tsx` | use PlaceSearch | Modify |
| `apps/web/src/app/globals.css` | search dropdown + attribution styles | Modify |
| `docs/DEPLOYMENT.md` | `FOURSQUARE_API_KEY` note | Modify |

---

### Task 1: Lexicon — `place.location` becomes an array

**Files:** Modify `packages/lexicons/lexicons/town/roundabout/guide/place.json`; regenerate; Modify `packages/lexicons/src/validation.test.ts`.

- [ ] **Step 1: Edit `place.json`.** Replace the `location` property with an array of the union:

```json
          "location": {
            "type": "array",
            "items": {
              "type": "union",
              "refs": [
                "community.lexicon.location.address",
                "community.lexicon.location.geo",
                "community.lexicon.location.fsq"
              ]
            }
          },
```

(Keep `name`/`createdAt`; `location` stays optional — not in `required`.)

- [ ] **Step 2: Regenerate + build.** Run `pnpm --filter @guides/lexicons gen` then `pnpm --filter @guides/lexicons build`. (The `gen` script already passes `--yes`.)

- [ ] **Step 3: Write the validation test.** Add to `packages/lexicons/src/validation.test.ts` (reuse the file's existing `describe`/`it`/`expect` + `ids`/`lexicons` imports):

```typescript
describe("place location array", () => {
  const geo = { $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42", name: "Tartine" };
  const addr = { $type: ids.CommunityLexiconLocationAddress, country: "US", region: "CA", locality: "San Francisco", street: "600 Guerrero St", postalCode: "94110", name: "Tartine" };
  const fsq = { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: "abc123", latitude: "37.76", longitude: "-122.42", name: "Tartine" };

  it("accepts a place with multiple location encodings", () => {
    const rec = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", location: [geo, addr, fsq], createdAt: "2026-06-02T00:00:00.000Z" };
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuidePlace, rec)).not.toThrow();
  });

  it("accepts a place with no location", () => {
    const rec = { $type: ids.TownRoundaboutGuidePlace, name: "Somewhere", createdAt: "2026-06-02T00:00:00.000Z" };
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuidePlace, rec)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run.** `pnpm --filter @guides/lexicons exec vitest run src/validation.test.ts` → all pass. If "accepts multiple encodings" fails, the regen didn't pick up the array — re-run gen+build.

- [ ] **Step 5: Commit.**
```bash
git add packages/lexicons
git commit -m "feat(lexicons): place.location is an array of community encodings"
```

---

### Task 2: `publish.ts` — `PlacePayload` location array

**Files:** Modify `apps/web/src/lib/publish.ts`, `apps/web/src/lib/publish.test.ts`.

- [ ] **Step 1: Write/adjust the failing test.** In `apps/web/src/lib/publish.test.ts`, update the `draftWithPlace()` helper's place payload so `location` is an array, and assert the place record carries it. Change the `places` entry to:

```typescript
    places: { "place-1": { name: "Tartine", location: [{ $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42", name: "Tartine" }] } },
```

And add an assertion inside the existing first test (after the existing place-name assertion):

```typescript
    expect(createRecord.mock.calls[0][1].location).toEqual([
      { $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42", name: "Tartine" },
    ]);
```

- [ ] **Step 2: Run, confirm it fails.** `pnpm --filter @guides/web exec vitest run src/lib/publish.test.ts` → FAIL (current `makePlaceRecord` passes `location` through, but `PlacePayload.location` is `Record<string,unknown>` and the new fixture is an array — TS error and/or the assertion mismatches once shape changes). (If it still passes by coincidence, proceed — Step 3 makes the type correct.)

- [ ] **Step 3: Update `publish.ts`.** Add the encoding type, make `location` an optional array, and omit it when empty:

```typescript
/** A community.lexicon.location.* object (geo/address/fsq), tagged by $type. */
export type LocationEncoding = { $type: string } & Record<string, unknown>;

export interface PlacePayload {
  name: string;
  location?: LocationEncoding[];
}
```

Replace `makePlaceRecord`:

```typescript
function makePlaceRecord(p: PlacePayload): Record<string, unknown> {
  const rec: Record<string, unknown> = { $type: ids.TownRoundaboutGuidePlace, name: p.name, createdAt: nowIso() };
  if (p.location && p.location.length > 0) rec.location = p.location;
  return rec;
}
```

(Leave `ReviewPayload.place: PlacePayload`, `Draft`, and the rest unchanged.)

- [ ] **Step 4: Run, confirm pass.** `pnpm --filter @guides/web exec vitest run src/lib/publish.test.ts` → PASS.

  Note: `pnpm --filter @guides/web exec tsc --noEmit` will now report errors in `CreatePlacePopup.tsx` / `CreateReviewPopup.tsx` (they still build `location` as a single object). That is expected and fixed in Task 5 — do not fix here.

- [ ] **Step 5: Commit.**
```bash
git add apps/web/src/lib/publish.ts apps/web/src/lib/publish.test.ts
git commit -m "feat(web): PlacePayload.location is an array of community encodings"
```

---

### Task 3: `lib/places.ts` — pure Foursquare builders + mappers

**Files:** Create `apps/web/src/lib/places.ts`, `apps/web/src/lib/places.test.ts`.

- [ ] **Step 1: Write the failing tests.** Create `apps/web/src/lib/places.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ids } from "@guides/lexicons";
import { autocompleteUrl, detailsUrl, fsqHeaders, mapAutocomplete, mapDetails, detailsToPayload } from "./places";

describe("places request builders", () => {
  it("builds the autocomplete URL with query, types, session, limit", () => {
    const u = new URL(autocompleteUrl("tartine", "sess123"));
    expect(u.origin + u.pathname).toBe("https://places-api.foursquare.com/autocomplete");
    expect(u.searchParams.get("query")).toBe("tartine");
    expect(u.searchParams.get("types")).toBe("place");
    expect(u.searchParams.get("session_token")).toBe("sess123");
    expect(u.searchParams.get("limit")).toBe("8");
  });

  it("builds the details URL with fields", () => {
    const u = new URL(detailsUrl("abc 123"));
    expect(u.pathname).toBe("/places/abc%20123");
    expect(u.searchParams.get("fields")).toBe("fsq_place_id,name,latitude,longitude,location");
  });

  it("sets bearer auth + version header", () => {
    expect(fsqHeaders("KEY")).toEqual({
      Authorization: "Bearer KEY",
      "X-Places-Api-Version": "2025-06-17",
      Accept: "application/json",
    });
  });
});

describe("mapAutocomplete (defensive: place id + label)", () => {
  it("extracts place suggestions, skipping non-place results", () => {
    const json = { results: [
      { type: "place", place: { fsq_place_id: "p1", name: "Tartine", location: { address: "600 Guerrero St" } }, text: { primary: "Tartine", secondary: "600 Guerrero St, San Francisco" } },
      { type: "geo", text: { primary: "San Francisco" } },
    ] };
    expect(mapAutocomplete(json)).toEqual([
      { fsqPlaceId: "p1", name: "Tartine", formatted: "600 Guerrero St, San Francisco" },
    ]);
  });
  it("returns [] for a non-array body", () => {
    expect(mapAutocomplete({})).toEqual([]);
  });
});

describe("mapDetails + detailsToPayload", () => {
  const detailsJson = {
    fsq_place_id: "p1", name: "Tartine", latitude: 37.7615, longitude: -122.4241,
    location: { address: "600 Guerrero St", locality: "San Francisco", region: "CA", postcode: "94110", country: "US" },
  };

  it("maps details to our shape", () => {
    expect(mapDetails(detailsJson)).toEqual({
      fsqPlaceId: "p1", name: "Tartine", latitude: 37.7615, longitude: -122.4241,
      location: { address: "600 Guerrero St", locality: "San Francisco", region: "CA", postcode: "94110", country: "US" },
    });
  });

  it("builds geo + address + fsq encodings from details", () => {
    const payload = detailsToPayload(mapDetails(detailsJson));
    expect(payload.name).toBe("Tartine");
    expect(payload.location).toEqual([
      { $type: ids.CommunityLexiconLocationGeo, latitude: "37.7615", longitude: "-122.4241", name: "Tartine" },
      { $type: ids.CommunityLexiconLocationAddress, country: "US", name: "Tartine", street: "600 Guerrero St", locality: "San Francisco", region: "CA", postalCode: "94110" },
      { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: "p1", name: "Tartine", latitude: "37.7615", longitude: "-122.4241" },
    ]);
  });

  it("skips the address encoding when country is absent (lexicon requires country)", () => {
    const payload = detailsToPayload(mapDetails({ fsq_place_id: "p2", name: "X", latitude: 1, longitude: 2, location: { locality: "Nowhere" } }));
    expect(payload.location?.some((l) => l.$type === ids.CommunityLexiconLocationAddress)).toBe(false);
    expect(payload.location?.map((l) => l.$type)).toEqual([ids.CommunityLexiconLocationGeo, ids.CommunityLexiconLocationFsq]);
  });
});
```

- [ ] **Step 2: Run, confirm fail.** `pnpm --filter @guides/web exec vitest run src/lib/places.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `apps/web/src/lib/places.ts`:**

```typescript
import { ids } from "@guides/lexicons";
import type { PlacePayload, LocationEncoding } from "./publish";

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_API_VERSION = "2025-06-17";

export function fsqHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "X-Places-Api-Version": FSQ_API_VERSION, Accept: "application/json" };
}

export function autocompleteUrl(query: string, session: string): string {
  const p = new URLSearchParams({ query, types: "place", session_token: session, limit: "8" });
  return `${FSQ_BASE}/autocomplete?${p.toString()}`;
}

export function detailsUrl(fsqPlaceId: string): string {
  const p = new URLSearchParams({ fields: "fsq_place_id,name,latitude,longitude,location" });
  return `${FSQ_BASE}/places/${encodeURIComponent(fsqPlaceId)}?${p.toString()}`;
}

export interface Suggestion {
  fsqPlaceId: string;
  name: string;
  formatted: string;
}

/** Defensive: the autocomplete result nesting isn't fully public; pull the place id + a label tolerantly. */
export function mapAutocomplete(json: unknown): Suggestion[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const out: Suggestion[] = [];
  for (const r of results as Record<string, any>[]) {
    const place = r?.place ?? r;
    const id = place?.fsq_place_id ?? place?.fsq_id;
    if (!id) continue; // skip geo/address/search suggestions — we only take places
    const name = place?.name ?? r?.text?.primary ?? "";
    const formatted = r?.text?.secondary ?? place?.location?.formatted_address ?? "";
    out.push({ fsqPlaceId: String(id), name: String(name), formatted: String(formatted) });
  }
  return out;
}

export interface PlaceDetails {
  fsqPlaceId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location?: Record<string, unknown>;
}

export function mapDetails(json: unknown): PlaceDetails {
  const p = (json ?? {}) as Record<string, any>;
  return {
    fsqPlaceId: String(p.fsq_place_id ?? ""),
    name: String(p.name ?? ""),
    latitude: typeof p.latitude === "number" ? p.latitude : undefined,
    longitude: typeof p.longitude === "number" ? p.longitude : undefined,
    location: p.location && typeof p.location === "object" ? (p.location as Record<string, unknown>) : undefined,
  };
}

/** Build a PlacePayload (name + community-typed encodings) from place details. */
export function detailsToPayload(d: PlaceDetails): PlacePayload {
  const location: LocationEncoding[] = [];
  const hasGeo = d.latitude != null && d.longitude != null;
  const lat = hasGeo ? String(d.latitude) : undefined;
  const lng = hasGeo ? String(d.longitude) : undefined;

  if (hasGeo) {
    location.push({ $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng, name: d.name });
  }

  const loc = d.location ?? {};
  const country = loc.country;
  if (typeof country === "string" && country) {
    const addr: LocationEncoding = { $type: ids.CommunityLexiconLocationAddress, country, name: d.name };
    if (typeof loc.address === "string") addr.street = loc.address;
    if (typeof loc.locality === "string") addr.locality = loc.locality;
    if (typeof loc.region === "string") addr.region = loc.region;
    if (typeof loc.postcode === "string") addr.postalCode = loc.postcode;
    location.push(addr);
  }

  if (d.fsqPlaceId) {
    const fsq: LocationEncoding = { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: d.fsqPlaceId, name: d.name };
    if (hasGeo) { fsq.latitude = lat; fsq.longitude = lng; }
    location.push(fsq);
  }

  return { name: d.name, location };
}
```

- [ ] **Step 4: Run, confirm pass.** `pnpm --filter @guides/web exec vitest run src/lib/places.test.ts` → PASS (the test's expected object key order matches the construction order above).

- [ ] **Step 5: Commit.**
```bash
git add apps/web/src/lib/places.ts apps/web/src/lib/places.test.ts
git commit -m "feat(web): pure Foursquare place mappers + payload builder"
```

---

### Task 4: API proxy routes

**Files:** Create `apps/web/src/app/api/places/autocomplete/route.ts`, `apps/web/src/app/api/places/details/route.ts`. Verified by `tsc` + `next build` (+ live manual once the key is set).

- [ ] **Step 1: Autocomplete route** — `apps/web/src/app/api/places/autocomplete/route.ts`:

```typescript
import { autocompleteUrl, fsqHeaders, mapAutocomplete } from "../../../../lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q");
  const session = params.get("session") ?? "";
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return Response.json({ error: "place search not configured" }, { status: 503 });
  const res = await fetch(autocompleteUrl(q, session), { headers: fsqHeaders(key) });
  if (!res.ok) return Response.json({ error: "upstream error" }, { status: 502 });
  return Response.json({ results: mapAutocomplete(await res.json()) });
}
```

- [ ] **Step 2: Details route** — `apps/web/src/app/api/places/details/route.ts`:

```typescript
import { detailsUrl, fsqHeaders, mapDetails, detailsToPayload } from "../../../../lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return Response.json({ error: "place search not configured" }, { status: 503 });
  const res = await fetch(detailsUrl(id), { headers: fsqHeaders(key) });
  if (!res.ok) return Response.json({ error: "upstream error" }, { status: 502 });
  return Response.json(detailsToPayload(mapDetails(await res.json())));
}
```

- [ ] **Step 3: Verify.** `pnpm --filter @guides/web exec tsc --noEmit` (expect only the known Task-5 popup errors, if Task 5 not yet done — note them); `pnpm --filter @guides/web build` should still succeed for the routes. Confirm the routes appear in build output (`/api/places/autocomplete`, `/api/places/details`).

- [ ] **Step 4: Commit.**
```bash
git add "apps/web/src/app/api/places/autocomplete/route.ts" "apps/web/src/app/api/places/details/route.ts"
git commit -m "feat(web): /api/places autocomplete + details proxy routes"
```

---

### Task 5: `PlaceSearch` component + both popups + styles

**Files:** Create `apps/web/src/components/PlaceSearch.tsx`; Modify `CreatePlacePopup.tsx`, `CreateReviewPopup.tsx`, `globals.css`. Verified by `tsc` + `next build` + manual.

- [ ] **Step 1: Create `apps/web/src/components/PlaceSearch.tsx`:**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { PlacePayload } from "../lib/publish";
import type { Suggestion } from "../lib/places";

function newSession(): string {
  // 32-char alphanumeric session token (Foursquare autocomplete billing/session grouping).
  let s = "";
  while (s.length < 32) s += Math.random().toString(36).slice(2);
  return s.slice(0, 32);
}

export function PlaceSearch({ onSelect }: { onSelect: (p: PlacePayload | null) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<PlacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(newSession());

  useEffect(() => {
    if (selected) return; // a place is chosen; stop searching
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${session.current}`);
        if (!res.ok) { setError("search unavailable"); setSuggestions([]); return; }
        const body = (await res.json()) as { results: Suggestion[] };
        setError(null);
        setSuggestions(body.results ?? []);
      } catch {
        setError("search unavailable"); setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  const pick = async (s: Suggestion) => {
    setSuggestions([]);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(s.fsqPlaceId)}&session=${session.current}`);
      if (!res.ok) { setError("could not load place"); return; }
      const payload = (await res.json()) as PlacePayload;
      setSelected(payload);
      setQuery(payload.name);
      setError(null);
      onSelect(payload);
      session.current = newSession(); // new session for the next search
    } catch {
      setError("could not load place");
    }
  };

  const clear = () => { setSelected(null); setQuery(""); setSuggestions([]); onSelect(null); };

  if (selected) {
    return (
      <div className="place-search">
        <div className="place-selected">
          <strong>{selected.name}</strong>
          <button type="button" onClick={clear}>Change</button>
        </div>
        <p className="place-attribution">Powered by Foursquare</p>
      </div>
    );
  }

  return (
    <div className="place-search">
      <input
        placeholder="Search for a place"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="place-error">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="place-suggestions">
          {suggestions.map((s) => (
            <li key={s.fsqPlaceId}>
              <button type="button" onClick={() => pick(s)}>
                <span className="place-name">{s.name}</span>
                {s.formatted && <span className="place-formatted"> — {s.formatted}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="place-attribution">Powered by Foursquare</p>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `CreatePlacePopup.tsx`** to use `PlaceSearch`:

```tsx
"use client";
import { useState } from "react";
import type { PlacePayload } from "../lib/publish";
import { PlaceSearch } from "./PlaceSearch";

export function CreatePlacePopup({ onSubmit, onCancel }: { onSubmit: (p: PlacePayload) => void; onCancel: () => void }) {
  const [place, setPlace] = useState<PlacePayload | null>(null);
  return (
    <div role="dialog" aria-label="Add place">
      <PlaceSearch onSelect={setPlace} />
      <button onClick={() => place && onSubmit(place)} disabled={!place}>Add place</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 3: Update `CreateReviewPopup.tsx`** — replace the place name/lat/lng inputs with `PlaceSearch`, keep rating/text/vibes:

```tsx
"use client";
import { useState } from "react";
import type { ReviewPayload, PlacePayload } from "../lib/publish";
import { PlaceSearch } from "./PlaceSearch";

export function CreateReviewPopup({ onSubmit, onCancel }: { onSubmit: (r: ReviewPayload) => void; onCancel: () => void }) {
  const [place, setPlace] = useState<PlacePayload | null>(null);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [vibes, setVibes] = useState("");
  return (
    <div role="dialog" aria-label="Add review">
      <PlaceSearch onSelect={setPlace} />
      <label>
        Rating:
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <textarea placeholder="Review" value={text} onChange={(e) => setText(e.target.value)} />
      <input placeholder="Vibes (comma-separated)" value={vibes} onChange={(e) => setVibes(e.target.value)} />
      <button
        onClick={() => place && onSubmit({ place, text, rating, vibes: vibes.split(",").map((v) => v.trim()).filter(Boolean) })}
        disabled={!place || !text.trim()}
      >
        Add review
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 4: Styles** — append to `apps/web/src/app/globals.css`:

```css
/* Foursquare place search */
.place-search { position: relative; }
.place-search input { width: 100%; }
.place-suggestions { list-style: none; margin: 0.25rem 0; padding: 0; border: 1px solid #ddd; border-radius: 0.4rem; }
.place-suggestions li { border-bottom: 1px solid #f0f0f0; }
.place-suggestions li:last-child { border-bottom: none; }
.place-suggestions button { display: block; width: 100%; text-align: left; padding: 0.4rem 0.6rem; background: none; border: none; cursor: pointer; }
.place-suggestions button:hover { background: #f5f7fa; }
.place-name { font-weight: 600; }
.place-formatted { color: #666; font-size: 0.9rem; }
.place-selected { display: flex; align-items: baseline; gap: 0.6rem; }
.place-error { color: #b3245a; font-size: 0.85rem; }
.place-attribution { color: #999; font-size: 0.75rem; margin: 0.3rem 0 0; }
```

- [ ] **Step 5: Verify.** `pnpm --filter @guides/web exec tsc --noEmit` → clean. `pnpm --filter @guides/web build` → success. `pnpm --filter @guides/web test` → all pass.

- [ ] **Step 6: Commit.**
```bash
git add apps/web/src/components/PlaceSearch.tsx apps/web/src/components/CreatePlacePopup.tsx apps/web/src/components/CreateReviewPopup.tsx apps/web/src/app/globals.css
git commit -m "feat(web): Foursquare place search in place + review popups"
```

---

### Task 6: Config, docs, and Foursquare key setup

**Files:** Modify `docs/DEPLOYMENT.md`. (Plus operator steps — not code.)

- [ ] **Step 1: Foursquare key (operator step).** In the [Foursquare developer portal](https://docs.foursquare.com/), create an account → a project → generate a **Places Service API key**. (This is required for live search; the unit-tested code builds without it.)

- [ ] **Step 2: Local env.** Create `apps/web/.env.local` (already gitignored via `.env.local`) containing:
```
FOURSQUARE_API_KEY=<your-key>
```
Confirm it's ignored: `git check-ignore apps/web/.env.local` prints the path.

- [ ] **Step 3: Document in `docs/DEPLOYMENT.md`.** Add a short section:

```markdown
## Place search (Foursquare)

The editor's place search proxies the Foursquare Places API server-side. Set
`FOURSQUARE_API_KEY` (a Foursquare Places Service key) as a server env var —
never in the client. Locally: `apps/web/.env.local`. On the sprite: set it on
the `web` service (see below). Without it, `/api/places/*` return 503 and the
search box shows "search unavailable" (the rest of the app is unaffected).
```

- [ ] **Step 4: Sprite env (operator step, at deploy).** When redeploying, set the key on the web service, e.g. recreate the service with `--env FOURSQUARE_API_KEY=<key>` (merge with existing env), or use the sprite env mechanism. Documented in DEPLOYMENT.md.

- [ ] **Step 5: Commit.**
```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: document FOURSQUARE_API_KEY for place search"
```

---

### Final verification

- [ ] `pnpm -r test && pnpm -r typecheck && pnpm --filter @guides/web build` — all green.
- [ ] **Live verify (needs the key):** with `FOURSQUARE_API_KEY` set, `pnpm --filter @guides/web dev`, open `/compose`, click **Add place**, type a place name → suggestions appear → select → name + "Powered by Foursquare" shows → publish → the place record's `location` has geo+address+fsq. **If suggestions are empty or fields look wrong**, capture one real autocomplete + details JSON response and adjust `mapAutocomplete`/`mapDetails` field paths + the corresponding test fixtures together (the details fields are documented; autocomplete nesting is the likely spot).

## Notes for the implementer
- Order matters: Task 2 changes `PlacePayload` and will make the two popups' old code fail `tsc` until Task 5 — that's expected; the unit suites stay green throughout.
- DRY/YAGNI: no categories/website/hours, no map rendering, no client-side Foursquare calls, no migration of old place records.
- The autocomplete response nesting is the one not-fully-documented spot; `mapAutocomplete` is deliberately tolerant and isolated so a live tweak is a one-function change.

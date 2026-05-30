# Guides Foundation (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo and the `@guides/lexicons` foundation package — lexicon definitions (custom + vendored community), runtime validation, record types, and UTF-8-correct facet helpers — that every other app in the spike depends on.

**Architecture:** A single shared package holds the data-model truth: lexicon JSON loaded into an `@atproto/lexicon` `Lexicons` instance for runtime validation, hand-authored TypeScript record types for ergonomics, and pure helper functions for building/reading byte-ranged facets. No app code yet; this package is consumed by Plans 2–4.

**Tech Stack:** pnpm workspaces, TypeScript (ESM, `moduleResolution: bundler`), Vitest, `@atproto/lexicon`.

> **Deviation from spec (§11):** The spec mentioned generating types via `@atproto/lex-cli`. This plan uses **runtime `Lexicons` validation + concise hand-authored TS types** instead, because it is more legible for the new-to-atproto reader and avoids a codegen toolchain in a spike. Validation correctness still comes from the canonical lexicon JSON. Flagged for reviewer; revert to codegen if preferred.

---

## File Structure

- `pnpm-workspace.yaml` — workspace globs.
- `package.json` (root) — private root, shared dev scripts.
- `tsconfig.base.json` (root) — shared compiler options.
- `packages/lexicons/package.json` — the foundation package manifest.
- `packages/lexicons/tsconfig.json` — extends base.
- `packages/lexicons/lexicons/com/atproto/repo/strongRef.json` — vendored.
- `packages/lexicons/lexicons/community/lexicon/location/{address,geo,fsq,hthree}.json` — vendored.
- `packages/lexicons/lexicons/community/lexicon/calendar/event.json` — vendored.
- `packages/lexicons/lexicons/town/roundabout/guide/{document,place,save,venueReview}.json` — authored here.
- `packages/lexicons/src/lexicon-docs.ts` — loads all JSON files from `lexicons/`.
- `packages/lexicons/src/validation.ts` — the `Lexicons` instance + `assertValidRecord`.
- `packages/lexicons/src/types.ts` — hand-authored record/feature TS types + NSID constants.
- `packages/lexicons/src/facets.ts` — UTF-8 byte-range + segmentation + strongRef helpers.
- `packages/lexicons/src/index.ts` — barrel export.
- Test files alongside: `src/*.test.ts`.

---

### Task 0: Monorepo scaffold + lexicons package skeleton

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`
- Create: `packages/lexicons/package.json`, `packages/lexicons/tsconfig.json`

- [ ] **Step 1: Create the workspace file**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create the root package.json**

`package.json`:
```json
{
  "name": "guides",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 3: Create the shared tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Create the lexicons package manifest**

`packages/lexicons/package.json`:
```json
{
  "name": "@guides/lexicons",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`packages/lexicons/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "lexicons"]
}
```

- [ ] **Step 5: Install dependencies (versions resolve at install time)**

Run:
```bash
cd /Users/blainecook/Code/footwork
pnpm add --filter @guides/lexicons @atproto/lexicon
pnpm add --filter @guides/lexicons -D vitest typescript @types/node
```
Expected: `pnpm-lock.yaml` created, `node_modules/` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo and lexicons package"
```

---

### Task 1: Vendor external lexicon JSON

These are external schemas we depend on. Do not transcribe from memory — write the exact content below (verified against canonical sources).

**Files:**
- Create: `packages/lexicons/lexicons/com/atproto/repo/strongRef.json`
- Create: `packages/lexicons/lexicons/community/lexicon/location/address.json`
- Create: `packages/lexicons/lexicons/community/lexicon/location/geo.json`
- Create: `packages/lexicons/lexicons/community/lexicon/location/fsq.json`
- Create: `packages/lexicons/lexicons/community/lexicon/location/hthree.json`
- Create: `packages/lexicons/lexicons/community/lexicon/calendar/event.json`

- [ ] **Step 1: Write `com/atproto/repo/strongRef.json`**

```json
{
  "lexicon": 1,
  "id": "com.atproto.repo.strongRef",
  "description": "A URI with a content-hash fingerprint.",
  "defs": {
    "main": {
      "type": "object",
      "required": ["uri", "cid"],
      "properties": {
        "uri": { "type": "string", "format": "at-uri" },
        "cid": { "type": "string", "format": "cid" }
      }
    }
  }
}
```

- [ ] **Step 2: Write `community/lexicon/location/address.json`**

```json
{
  "lexicon": 1,
  "id": "community.lexicon.location.address",
  "defs": {
    "main": {
      "type": "object",
      "description": "A physical location in the form of a street address.",
      "required": ["country"],
      "properties": {
        "country": { "type": "string", "description": "The ISO 3166 country code. Preferably the 2-letter code.", "minLength": 2, "maxLength": 10 },
        "postalCode": { "type": "string", "description": "The postal code of the location." },
        "region": { "type": "string", "description": "The administrative region of the country. For example, a state in the USA." },
        "locality": { "type": "string", "description": "The locality of the region. For example, a city in the USA." },
        "street": { "type": "string", "description": "The street address." },
        "name": { "type": "string", "description": "The name of the location." }
      }
    }
  }
}
```

- [ ] **Step 3: Write `community/lexicon/location/geo.json`**

```json
{
  "lexicon": 1,
  "id": "community.lexicon.location.geo",
  "defs": {
    "main": {
      "type": "object",
      "description": "A physical location in the form of a WGS84 coordinate.",
      "required": ["latitude", "longitude"],
      "properties": {
        "latitude": { "type": "string" },
        "longitude": { "type": "string" },
        "altitude": { "type": "string" },
        "name": { "type": "string", "description": "The name of the location." }
      }
    }
  }
}
```

- [ ] **Step 4: Write `community/lexicon/location/fsq.json`**

```json
{
  "lexicon": 1,
  "id": "community.lexicon.location.fsq",
  "defs": {
    "main": {
      "type": "object",
      "description": "A physical location contained in the Foursquare Open Source Places dataset.",
      "required": ["fsq_place_id"],
      "properties": {
        "fsq_place_id": { "type": "string", "description": "The unique identifier of a Foursquare POI." },
        "latitude": { "type": "string" },
        "longitude": { "type": "string" },
        "name": { "type": "string", "description": "The name of the location." }
      }
    }
  }
}
```

- [ ] **Step 5: Write `community/lexicon/location/hthree.json`**

```json
{
  "lexicon": 1,
  "id": "community.lexicon.location.hthree",
  "defs": {
    "main": {
      "type": "object",
      "description": "A physical location in the form of a H3 encoded location.",
      "required": ["value"],
      "properties": {
        "value": { "type": "string", "description": "The h3 encoded location." },
        "name": { "type": "string", "description": "The name of the location." }
      }
    }
  }
}
```

- [ ] **Step 6: Write `community/lexicon/calendar/event.json`**

```json
{
  "lexicon": 1,
  "id": "community.lexicon.calendar.event",
  "defs": {
    "main": {
      "type": "record",
      "description": "A calendar event.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["createdAt", "name"],
        "properties": {
          "name": { "type": "string", "description": "The name of the event." },
          "description": { "type": "string", "description": "The description of the event." },
          "createdAt": { "type": "string", "format": "datetime", "description": "Client-declared timestamp when the event was created." },
          "startsAt": { "type": "string", "format": "datetime", "description": "Client-declared timestamp when the event starts." },
          "endsAt": { "type": "string", "format": "datetime", "description": "Client-declared timestamp when the event ends." },
          "mode": { "type": "ref", "ref": "community.lexicon.calendar.event#mode", "description": "The attendance mode of the event." },
          "status": { "type": "ref", "ref": "community.lexicon.calendar.event#status", "description": "The status of the event." },
          "locations": {
            "type": "array",
            "description": "The locations where the event takes place.",
            "items": {
              "type": "union",
              "refs": [
                "community.lexicon.calendar.event#uri",
                "community.lexicon.location.address",
                "community.lexicon.location.fsq",
                "community.lexicon.location.geo",
                "community.lexicon.location.hthree"
              ]
            }
          },
          "uris": { "type": "array", "description": "URIs associated with the event.", "items": { "type": "ref", "ref": "community.lexicon.calendar.event#uri" } },
          "rsvpExpected": { "type": "boolean", "description": "Whether a response is requested from attendees." }
        }
      }
    },
    "mode": { "type": "string", "description": "The mode of the event.", "default": "community.lexicon.calendar.event#inperson", "knownValues": ["community.lexicon.calendar.event#hybrid", "community.lexicon.calendar.event#inperson", "community.lexicon.calendar.event#virtual"] },
    "virtual": { "type": "token", "description": "A virtual event that takes place online." },
    "inperson": { "type": "token", "description": "An in-person event that takes place offline." },
    "hybrid": { "type": "token", "description": "A hybrid event that takes place both online and offline." },
    "status": { "type": "string", "description": "The status of the event.", "default": "community.lexicon.calendar.event#scheduled", "knownValues": ["community.lexicon.calendar.event#cancelled", "community.lexicon.calendar.event#planned", "community.lexicon.calendar.event#postponed", "community.lexicon.calendar.event#rescheduled", "community.lexicon.calendar.event#scheduled"] },
    "planned": { "type": "token", "description": "The event has been created, but not finalized." },
    "scheduled": { "type": "token", "description": "The event has been created and scheduled." },
    "rescheduled": { "type": "token", "description": "The event has been rescheduled." },
    "cancelled": { "type": "token", "description": "The event has been cancelled." },
    "postponed": { "type": "token", "description": "The event has been postponed and a new start date has not been set." },
    "uri": {
      "type": "object",
      "description": "A URI associated with the event.",
      "required": ["uri"],
      "properties": {
        "uri": { "type": "string", "format": "uri" },
        "name": { "type": "string", "description": "The display name of the URI." }
      }
    }
  }
}
```

- [ ] **Step 7: Verify all vendored files parse as JSON**

Run:
```bash
cd /Users/blainecook/Code/footwork/packages/lexicons
for f in $(find lexicons/com lexicons/community -name '*.json'); do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('ok $f')"; done
```
Expected: one `ok <path>` line per file, no parse errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(lexicons): vendor com.atproto.repo.strongRef and community lexicons"
```

---

### Task 2: Author the custom `town.roundabout.guide.*` lexicons

**Files:**
- Create: `packages/lexicons/lexicons/town/roundabout/guide/document.json`
- Create: `packages/lexicons/lexicons/town/roundabout/guide/place.json`
- Create: `packages/lexicons/lexicons/town/roundabout/guide/save.json`
- Create: `packages/lexicons/lexicons/town/roundabout/guide/venueReview.json`

- [ ] **Step 1: Write `town/roundabout/guide/document.json`**

The guide: UTF-8 `text` + byte-ranged `facets`. Facet features are a union of formatting, link, place reference, and event reference. Place/event refs carry a `strongRef` plus a rendering `intent`.

```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.document",
  "defs": {
    "main": {
      "type": "record",
      "description": "A guide: narrative prose with byte-ranged facets referencing places and events.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["title", "text", "createdAt"],
        "properties": {
          "title": { "type": "string", "maxLength": 1200, "maxGraphemes": 300 },
          "type": { "type": "string", "knownValues": ["curated", "list"], "description": "Display-only flag; behavior-neutral." },
          "text": { "type": "string", "maxLength": 100000, "maxGraphemes": 30000 },
          "facets": { "type": "array", "items": { "type": "ref", "ref": "#facet" } },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    },
    "facet": {
      "type": "object",
      "description": "A typed annotation over a byte range of the document text.",
      "required": ["index", "features"],
      "properties": {
        "index": { "type": "ref", "ref": "#byteSlice" },
        "features": { "type": "array", "items": { "type": "union", "refs": ["#format", "#link", "#placeRef", "#eventRef"] } }
      }
    },
    "byteSlice": {
      "type": "object",
      "description": "A byte index range into the UTF-8 encoded text. End-exclusive.",
      "required": ["byteStart", "byteEnd"],
      "properties": {
        "byteStart": { "type": "integer", "minimum": 0 },
        "byteEnd": { "type": "integer", "minimum": 0 }
      }
    },
    "format": {
      "type": "object",
      "description": "Inline text formatting.",
      "required": ["kind"],
      "properties": { "kind": { "type": "string", "knownValues": ["bold", "italic"] } }
    },
    "link": {
      "type": "object",
      "description": "A hyperlink.",
      "required": ["uri"],
      "properties": { "uri": { "type": "string", "format": "uri" } }
    },
    "placeRef": {
      "type": "object",
      "description": "A reference to a town.roundabout.guide.place record, with a rendering intent.",
      "required": ["ref"],
      "properties": {
        "ref": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
        "intent": { "type": "string", "knownValues": ["hero", "card", "chip"], "default": "card" }
      }
    },
    "eventRef": {
      "type": "object",
      "description": "A reference to a community.lexicon.calendar.event record, with a rendering intent.",
      "required": ["ref"],
      "properties": {
        "ref": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
        "intent": { "type": "string", "knownValues": ["card"], "default": "card" }
      }
    }
  }
}
```

- [ ] **Step 2: Write `town/roundabout/guide/place.json`**

A standalone wrapper record giving a community location object its own rkey so facets can `strongRef` it.

```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.place",
  "defs": {
    "main": {
      "type": "record",
      "description": "A standalone place: a display name plus a community.lexicon location payload.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["name", "createdAt"],
        "properties": {
          "name": { "type": "string", "maxLength": 1200, "maxGraphemes": 300 },
          "location": {
            "type": "union",
            "refs": [
              "community.lexicon.location.address",
              "community.lexicon.location.geo",
              "community.lexicon.location.fsq"
            ]
          },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Write `town/roundabout/guide/save.json`**

```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.save",
  "defs": {
    "main": {
      "type": "record",
      "description": "A user saving a guide document into their own repo.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["subject", "createdAt"],
        "properties": {
          "subject": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Write `town/roundabout/guide/venueReview.json` (stub extension point)**

```json
{
  "lexicon": 1,
  "id": "town.roundabout.guide.venueReview",
  "defs": {
    "main": {
      "type": "record",
      "description": "A rich review wrapper: intrinsic copy and rating, referencing a place. Extension point; not wired into the spike round-trip.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["place", "text", "createdAt"],
        "properties": {
          "place": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
          "text": { "type": "string", "maxLength": 10000, "maxGraphemes": 3000 },
          "rating": { "type": "integer", "minimum": 1, "maximum": 5 },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

- [ ] **Step 5: Verify the custom files parse as JSON**

Run:
```bash
cd /Users/blainecook/Code/footwork/packages/lexicons
for f in $(find lexicons/town -name '*.json'); do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('ok $f')"; done
```
Expected: four `ok <path>` lines, no parse errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lexicons): author town.roundabout.guide document/place/save/venueReview"
```

---

### Task 3: Lexicon loader + runtime validation

**Files:**
- Create: `packages/lexicons/src/lexicon-docs.ts`
- Create: `packages/lexicons/src/validation.ts`
- Test: `packages/lexicons/src/validation.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { lexicons, assertValidRecord } from "./validation";

describe("lexicon validation", () => {
  it("loads every lexicon doc including custom and community ids", () => {
    const ids = lexicons.docs.size ?? 0;
    expect(ids).toBeGreaterThanOrEqual(10);
    expect(() => lexicons.getDefOrThrow("town.roundabout.guide.document")).not.toThrow();
    expect(() => lexicons.getDefOrThrow("community.lexicon.location.geo")).not.toThrow();
    expect(() => lexicons.getDefOrThrow("com.atproto.repo.strongRef")).not.toThrow();
  });

  it("accepts a well-formed guide document with a placeRef facet", () => {
    const record = {
      $type: "town.roundabout.guide.document",
      title: "A morning in the Mission",
      type: "list",
      text: "Start at Tartine, then walk to Dolores Park.",
      facets: [
        {
          index: { byteStart: 9, byteEnd: 16 },
          features: [
            {
              $type: "town.roundabout.guide.document#placeRef",
              ref: {
                uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/town.roundabout.guide.place/3jzfcijpj2z2a",
                cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a",
              },
              intent: "card",
            },
          ],
        },
      ],
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    expect(() => assertValidRecord("town.roundabout.guide.document", record)).not.toThrow();
  });

  it("rejects a guide document missing required title", () => {
    const bad = {
      $type: "town.roundabout.guide.document",
      text: "no title here",
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    expect(() => assertValidRecord("town.roundabout.guide.document", bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: FAIL — cannot resolve `./validation`.

- [ ] **Step 3: Write the loader**

`packages/lexicons/src/lexicon-docs.ts`:
```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { LexiconDoc } from "@atproto/lexicon";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "lexicons");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".json") ? [p] : [];
  });
}

export const lexiconDocs: LexiconDoc[] = walk(root).map(
  (p) => JSON.parse(readFileSync(p, "utf8")) as LexiconDoc,
);
```

- [ ] **Step 4: Write the validation module**

`packages/lexicons/src/validation.ts`:
```ts
import { Lexicons } from "@atproto/lexicon";
import { lexiconDocs } from "./lexicon-docs";

export const lexicons = new Lexicons(lexiconDocs);

export function assertValidRecord(nsid: string, record: unknown): void {
  lexicons.assertValidRecord(nsid, record);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: PASS (3 tests). If the first test's `lexicons.docs.size` accessor differs in the installed `@atproto/lexicon` version, replace that assertion with `expect(lexiconDocs.length).toBeGreaterThanOrEqual(10)` — the loader array is the source of truth.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lexicons): runtime Lexicons instance and record validation"
```

---

### Task 4: Record & feature TypeScript types

**Files:**
- Create: `packages/lexicons/src/types.ts`
- Test: `packages/lexicons/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NSID, type GuideDocument, type PlaceRefFeature } from "./types";
import { assertValidRecord } from "./validation";

describe("record types", () => {
  it("exposes NSID constants", () => {
    expect(NSID.document).toBe("town.roundabout.guide.document");
    expect(NSID.place).toBe("town.roundabout.guide.place");
    expect(NSID.save).toBe("town.roundabout.guide.save");
    expect(NSID.event).toBe("community.lexicon.calendar.event");
  });

  it("a typed GuideDocument validates against the lexicon", () => {
    const placeRef: PlaceRefFeature = {
      $type: "town.roundabout.guide.document#placeRef",
      ref: {
        uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/town.roundabout.guide.place/3jzfcijpj2z2a",
        cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a",
      },
      intent: "card",
    };
    const doc: GuideDocument = {
      $type: NSID.document,
      title: "Test",
      type: "list",
      text: "Tartine is great.",
      facets: [{ index: { byteStart: 0, byteEnd: 7 }, features: [placeRef] }],
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    expect(() => assertValidRecord(NSID.document, doc)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write the types**

`packages/lexicons/src/types.ts`:
```ts
export const NSID = {
  document: "town.roundabout.guide.document",
  place: "town.roundabout.guide.place",
  save: "town.roundabout.guide.save",
  venueReview: "town.roundabout.guide.venueReview",
  event: "community.lexicon.calendar.event",
} as const;

export interface StrongRef {
  uri: string;
  cid: string;
}

export interface ByteSlice {
  byteStart: number;
  byteEnd: number;
}

export interface FormatFeature {
  $type: "town.roundabout.guide.document#format";
  kind: "bold" | "italic";
}

export interface LinkFeature {
  $type: "town.roundabout.guide.document#link";
  uri: string;
}

export interface PlaceRefFeature {
  $type: "town.roundabout.guide.document#placeRef";
  ref: StrongRef;
  intent?: "hero" | "card" | "chip";
}

export interface EventRefFeature {
  $type: "town.roundabout.guide.document#eventRef";
  ref: StrongRef;
  intent?: "card";
}

export type FacetFeature =
  | FormatFeature
  | LinkFeature
  | PlaceRefFeature
  | EventRefFeature;

export interface Facet {
  index: ByteSlice;
  features: FacetFeature[];
}

export interface GuideDocument {
  $type: typeof NSID.document;
  title: string;
  type?: "curated" | "list";
  text: string;
  facets?: Facet[];
  createdAt: string;
}

export type LocationPayload =
  | ({ $type: "community.lexicon.location.address" } & Record<string, string>)
  | ({ $type: "community.lexicon.location.geo" } & Record<string, string>)
  | ({ $type: "community.lexicon.location.fsq" } & Record<string, string>);

export interface GuidePlace {
  $type: typeof NSID.place;
  name: string;
  location?: LocationPayload;
  createdAt: string;
}

export interface GuideSave {
  $type: typeof NSID.save;
  subject: StrongRef;
  createdAt: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: PASS (all tests across both test files).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(lexicons): hand-authored record and facet feature types"
```

---

### Task 5: UTF-8 facet helpers (byte ranges, segmentation, strongRef)

The classic atproto gotcha: facet indices are **UTF-8 byte** offsets, not JS string (UTF-16) offsets. These helpers make that correct and teach it.

**Files:**
- Create: `packages/lexicons/src/facets.ts`
- Test: `packages/lexicons/src/facets.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/facets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { byteSliceFromChars, facetSegments, strongRef } from "./facets";
import type { Facet, PlaceRefFeature } from "./types";

describe("facet helpers", () => {
  it("computes byte offsets that differ from char offsets for multibyte text", () => {
    // "👋" is 2 UTF-16 code units but 4 UTF-8 bytes.
    const text = "👋 Tartine";
    const slice = byteSliceFromChars(text, text.indexOf("Tartine"), text.length);
    expect(slice).toEqual({ byteStart: 5, byteEnd: 12 }); // 4 (wave) + 1 (space) = 5
  });

  it("segments text into ordered plain and faceted runs", () => {
    const text = "Go to Tartine now";
    const place: PlaceRefFeature = {
      $type: "town.roundabout.guide.document#placeRef",
      ref: { uri: "at://x/y/z", cid: "bafytest" },
      intent: "card",
    };
    const facets: Facet[] = [
      { index: byteSliceFromChars(text, 6, 13), features: [place] },
    ];
    const segs = [...facetSegments(text, facets)];
    expect(segs.map((s) => s.text)).toEqual(["Go to ", "Tartine", " now"]);
    expect(segs[0].features).toEqual([]);
    expect(segs[1].features).toEqual([place]);
    expect(segs[2].features).toEqual([]);
  });

  it("builds a strongRef", () => {
    expect(strongRef("at://x/y/z", "bafytest")).toEqual({
      uri: "at://x/y/z",
      cid: "bafytest",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: FAIL — cannot resolve `./facets`.

- [ ] **Step 3: Write the helpers**

`packages/lexicons/src/facets.ts`:
```ts
import type { ByteSlice, Facet, FacetFeature, StrongRef } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Number of UTF-8 bytes in a string. */
export function utf8Len(s: string): number {
  return encoder.encode(s).length;
}

/** Build a UTF-8 byte slice from JS string (char) indices. */
export function byteSliceFromChars(
  text: string,
  charStart: number,
  charEnd: number,
): ByteSlice {
  return {
    byteStart: utf8Len(text.slice(0, charStart)),
    byteEnd: utf8Len(text.slice(0, charEnd)),
  };
}

export interface Segment {
  text: string;
  features: FacetFeature[];
}

/**
 * Split text into ordered segments by facet byte ranges. Plain runs carry an
 * empty features array. Assumes non-overlapping facets (sufficient for the spike).
 */
export function* facetSegments(
  text: string,
  facets: Facet[],
): Generator<Segment> {
  const bytes = encoder.encode(text);
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );
  let cursor = 0;
  for (const f of sorted) {
    if (f.index.byteStart > cursor) {
      yield { text: decoder.decode(bytes.slice(cursor, f.index.byteStart)), features: [] };
    }
    yield {
      text: decoder.decode(bytes.slice(f.index.byteStart, f.index.byteEnd)),
      features: f.features,
    };
    cursor = f.index.byteEnd;
  }
  if (cursor < bytes.length) {
    yield { text: decoder.decode(bytes.slice(cursor)), features: [] };
  }
}

export function strongRef(uri: string, cid: string): StrongRef {
  return { uri, cid };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(lexicons): UTF-8 byte-range facet helpers and segmentation"
```

---

### Task 6: Barrel export

**Files:**
- Create: `packages/lexicons/src/index.ts`
- Test: `packages/lexicons/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as pkg from "./index";

describe("package barrel", () => {
  it("re-exports the public API", () => {
    expect(typeof pkg.assertValidRecord).toBe("function");
    expect(typeof pkg.byteSliceFromChars).toBe("function");
    expect(typeof pkg.facetSegments).toBe("function");
    expect(typeof pkg.strongRef).toBe("function");
    expect(pkg.NSID.document).toBe("town.roundabout.guide.document");
    expect(pkg.lexicons).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the barrel**

`packages/lexicons/src/index.ts`:
```ts
export * from "./types";
export * from "./facets";
export { lexicons, assertValidRecord } from "./validation";
export { lexiconDocs } from "./lexicon-docs";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: PASS (all test files green).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(lexicons): public barrel export"
```

---

## Definition of Done

- `pnpm -r test` passes from the repo root.
- `@guides/lexicons` exports: `lexicons`, `assertValidRecord`, `lexiconDocs`, `NSID`, all record/feature types, and `byteSliceFromChars` / `utf8Len` / `facetSegments` / `strongRef`.
- A well-formed guide document with a `placeRef` facet validates; a malformed one is rejected.
- Facet byte-offset correctness is proven against multibyte (emoji) text.
- All work committed in small, green increments.

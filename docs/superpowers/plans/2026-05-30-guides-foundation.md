# Guides Foundation (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo and the `@guides/lexicons` foundation package — lexicon definitions (custom + vendored community), **code-generated** TypeScript types + validators, and UTF-8-correct facet helpers — that every other app in the spike depends on.

**Architecture:** A single shared package holds the data-model truth. Lexicon JSON (our custom `town.roundabout.guide.*` plus vendored community/`com.atproto` schemas) is the source; `@atproto/lex-cli` generates typed record interfaces, `validateRecord`/`isRecord` validators, and a runtime `Lexicons` instance (`lexicons` + `ids`). Pure helper functions build/read byte-ranged facets. No app code yet; this package is consumed by Plans 2–4.

**Tech Stack:** pnpm workspaces, TypeScript (ESM, `moduleResolution: bundler`), Vitest, `@atproto/lex-cli` (codegen, bin `lex`), `@atproto/lexicon` (runtime).

> **Toolchain note:** We use **`@atproto/lex-cli`** (`lex gen-api`), not the newer `@atproto/lex`/`ts-lex`. The newer tool is oriented toward network-*installed*, published lexicons (manifest + CIDs) and currently does not support purely-local lexicons ([atproto#4472](https://github.com/bluesky-social/atproto/issues/4472)). Our `town.roundabout.guide.*` lexicons are deliberately local/unpublished for this spike, so `lex-cli` — which generates directly from local JSON files — is the correct, still-real-world choice. Generated code is committed (standard atproto practice).

---

## File Structure

- `pnpm-workspace.yaml` — workspace globs.
- `package.json` (root) — private root, shared test script.
- `tsconfig.base.json` (root) — shared compiler options.
- `packages/lexicons/package.json` — manifest + codegen script.
- `packages/lexicons/tsconfig.json` — extends base.
- `packages/lexicons/lexicons/com/atproto/repo/strongRef.json` — vendored.
- `packages/lexicons/lexicons/community/lexicon/location/{address,geo,fsq,hthree}.json` — vendored.
- `packages/lexicons/lexicons/community/lexicon/calendar/event.json` — vendored.
- `packages/lexicons/lexicons/town/roundabout/guide/{document,place,save,venueReview}.json` — authored here.
- `packages/lexicons/src/lexicon/**` — **generated** (`lexicons.ts` exporting `ids`/`lexicons`/`schemas`; `types/**` with `Record` interfaces, `isRecord`, `validateRecord`). Committed.
- `packages/lexicons/src/facets.ts` — UTF-8 byte-range + segmentation + strongRef helpers (hand-written, decoupled from generated types).
- `packages/lexicons/src/index.ts` — barrel: re-exports generated lexicon module + facet helpers.
- Test files alongside: `packages/lexicons/src/*.test.ts`.

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

`packages/lexicons/package.json` — the `gen` script generates the client API, then removes the generated `index.ts` client scaffold (it imports `@atproto/xrpc`, which a shared types package should not depend on; we only consume `lexicons.ts` + `types/`):
```json
{
  "name": "@guides/lexicons",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "gen": "lex gen-api ./src/lexicon $(find lexicons -name '*.json') && rm -f src/lexicon/index.ts",
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
pnpm add --filter @guides/lexicons -D @atproto/lex-cli vitest typescript @types/node
```
Expected: `pnpm-lock.yaml` created/updated, `node_modules/` populated, no errors. Verify the codegen bin is present:
```bash
pnpm --filter @guides/lexicons exec lex --help
```
Expected: usage text listing `gen-api` and `gen-server` subcommands.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo and lexicons package"
```

---

### Task 1: Vendor external lexicon JSON

These are external schemas we depend on. Do not transcribe from memory — write the exact content below (verified against canonical sources). `lex-cli` must receive every referenced lexicon to resolve refs, so all of these are required.

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
Expected: one `ok <path>` line per file (6 files), no parse errors.

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

### Task 3: Generate types + validators with lex-cli

**Files:**
- Create (generated, committed): `packages/lexicons/src/lexicon/**`

- [ ] **Step 1: Run codegen**

Run:
```bash
cd /Users/blainecook/Code/footwork/packages/lexicons
pnpm gen
```
Expected: generation succeeds with no unresolved-ref errors; `src/lexicon/` is created. (The `gen` script removes the generated `index.ts` client scaffold afterward.)

- [ ] **Step 2: Verify the generated structure and key exports**

Run:
```bash
cd /Users/blainecook/Code/footwork/packages/lexicons
ls src/lexicon
ls src/lexicon/types/town/roundabout/guide
grep -E "export (interface Record|function isRecord|function validateRecord)" src/lexicon/types/town/roundabout/guide/document.ts
grep -E "export const ids|export const lexicons|export const schemas" src/lexicon/lexicons.ts
test ! -f src/lexicon/index.ts && echo "index.ts removed OK"
```
Expected: `lexicons.ts` and `types/` exist; `document.ts` exports `Record`, `isRecord`, and `validateRecord`; `lexicons.ts` exports `ids`, `lexicons`, `schemas`; `index.ts removed OK`. (If lex-cli's generated symbol names differ in v0.10.0, record the actual names here — they are consumed by Tasks 4 and 6.)

- [ ] **Step 3: Commit generated code**

```bash
cd /Users/blainecook/Code/footwork
git add -A
git commit -m "feat(lexicons): generate types and validators via lex-cli"
```

---

### Task 4: Validation test against generated validators

**Files:**
- Test: `packages/lexicons/src/validation.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/validation.test.ts` (imports the generated `validateRecord` for the document lexicon and the `ids` map):
```ts
import { describe, it, expect } from "vitest";
import { ids, lexicons } from "./lexicon/lexicons";
import { validateRecord } from "./lexicon/types/town/roundabout/guide/document";

describe("generated lexicon validation", () => {
  it("exposes the ids map and a populated Lexicons instance", () => {
    expect(ids.TownRoundaboutGuideDocument).toBe("town.roundabout.guide.document");
    expect(ids.ComAtprotoRepoStrongRef).toBe("com.atproto.repo.strongRef");
    expect(() => lexicons.getDefOrThrow("community.lexicon.location.geo")).not.toThrow();
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
    const result = validateRecord(record);
    expect(result.success).toBe(true);
  });

  it("rejects a guide document missing required title", () => {
    const bad = {
      $type: "town.roundabout.guide.document",
      text: "no title here",
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    const result = validateRecord(bad);
    expect(result.success).toBe(false);
  });
});
```

> Note: `validateRecord` returns a `ValidationResult` discriminated on `success`. The `ids` keys are PascalCased NSIDs (lex-cli convention). If Task 3 Step 2 recorded different names, align the imports/assertions here accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: FAIL — the test file references modules under `./lexicon` correctly, but the suite is the first to exercise them; it should fail only if a fixture or symbol name is wrong. If `validateRecord`/`ids` resolve and fixtures are valid, this test passes immediately. (This task has no implementation step because generation already produced the code under test; the "failing" gate is the import/symbol-name check.)

- [ ] **Step 3: Make it pass**

If Step 2 failed on symbol names, correct the imports/assertions to match the names recorded in Task 3 Step 2, then re-run:

Run: `cd /Users/blainecook/Code/footwork/packages/lexicons && pnpm test`
Expected: PASS (3 assertions in this file).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(lexicons): validate guide documents against generated schema"
```

---

### Task 5: UTF-8 facet helpers (byte ranges, segmentation, strongRef)

The classic atproto gotcha: facet indices are **UTF-8 byte** offsets, not JS string (UTF-16) offsets. These helpers make that correct and teach it. They are intentionally decoupled from the generated record types — they operate on structural byte ranges and a generic feature list.

**Files:**
- Create: `packages/lexicons/src/facets.ts`
- Test: `packages/lexicons/src/facets.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/lexicons/src/facets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { byteSliceFromChars, facetSegments, strongRef } from "./facets";
import type { FacetLike } from "./facets";

describe("facet helpers", () => {
  it("computes byte offsets that differ from char offsets for multibyte text", () => {
    // "👋" is 2 UTF-16 code units but 4 UTF-8 bytes.
    const text = "👋 Tartine";
    const slice = byteSliceFromChars(text, text.indexOf("Tartine"), text.length);
    expect(slice).toEqual({ byteStart: 5, byteEnd: 12 }); // 4 (wave) + 1 (space) = 5
  });

  it("segments text into ordered plain and faceted runs", () => {
    const text = "Go to Tartine now";
    const place = {
      $type: "town.roundabout.guide.document#placeRef",
      ref: { uri: "at://x/y/z", cid: "bafytest" },
      intent: "card",
    };
    const facets: FacetLike[] = [
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
export interface ByteSlice {
  byteStart: number;
  byteEnd: number;
}

/** A facet shape sufficient for segmentation: a byte range plus opaque features. */
export interface FacetLike {
  index: ByteSlice;
  features: unknown[];
}

export interface Segment {
  text: string;
  features: unknown[];
}

export interface StrongRef {
  uri: string;
  cid: string;
}

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

/**
 * Split text into ordered segments by facet byte ranges. Plain runs carry an
 * empty features array. Assumes non-overlapping facets (sufficient for the spike).
 */
export function* facetSegments(
  text: string,
  facets: FacetLike[],
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
Expected: PASS (all tests across both files).

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
    expect(typeof pkg.byteSliceFromChars).toBe("function");
    expect(typeof pkg.facetSegments).toBe("function");
    expect(typeof pkg.strongRef).toBe("function");
    expect(pkg.ids.TownRoundaboutGuideDocument).toBe("town.roundabout.guide.document");
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
// Generated lexicon runtime: ids, lexicons (Lexicons instance), schemas.
export { ids, lexicons, schemas } from "./lexicon/lexicons";
// Facet helpers.
export * from "./facets";
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
- `pnpm --filter @guides/lexicons gen` regenerates `src/lexicon/**` deterministically from the JSON.
- `@guides/lexicons` exports the generated `lexicons` (Lexicons instance), `ids`, `schemas`, generated record types/validators (under `./lexicon/types/**`), and `byteSliceFromChars` / `utf8Len` / `facetSegments` / `strongRef`.
- A well-formed guide document with a `placeRef` facet validates via the generated `validateRecord`; a malformed one is rejected.
- Facet byte-offset correctness is proven against multibyte (emoji) text.
- All work committed in small, green increments.

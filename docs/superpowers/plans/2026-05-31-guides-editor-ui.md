# Guides Editor — Tiptap UI (Plan 4 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tiptap editing surface for the Guides editor: custom `placeRef`/`eventRef` marks, create-place/create-event popups, a toolbar (bold/italic + add place/event), and the `(editor)` compose page that gates on OAuth, drives the editor, and publishes via Plan 3's pipeline. Conclude with a **live round-trip** against a real PDS + the Plan 2 AppView — the first real CID-compat check.

**Architecture:** Tiptap (`@tiptap/react`) produces a ProseMirror doc whose JSON is exactly the `PMDoc` shape Plan 3 consumes. Place/event references are Tiptap **marks** carrying a `refId` + `intent`; the actual place/event data is held in React state maps keyed by those `refId`s and created as records at publish time. The compose page assembles a `Draft` and calls `publishGuide(did, makeCreateRecord(agent, did), draft)` from Plan 3. This plan is integration/UI — verified by `next build`, type-checking, and a manual live round-trip; the pure logic was unit-tested in Plan 3.

**Tech Stack:** Next.js (App Router, client components), `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/core`/`@tiptap/pm`, React, and Plan 3's `auth.tsx` / `agent.ts` / `publish.ts` / `richtext-lens.ts`.

> **Decisions (vetoable on review):**
> - **Marks, not nodes,** for place/event refs — they decorate a text span (the relationaltext model), and Tiptap's JSON for a marked text node maps 1:1 onto `PMDoc`.
> - **Defer record creation to publish** — popups only capture data into React state maps keyed by a generated `refId` (`place-1`, `event-1`, …); `publishGuide` creates the records. No orphan records from abandoned drafts.
> - **Verification is build + manual** for components/pages. The one piece of pure glue (assembling a `Draft` from editor JSON + state maps) gets a unit test. The live round-trip is a documented manual checklist (requires a real Bluesky/atproto account + browser).
> - **Editor UX is intentionally minimal** (the spec defers the hard interaction design). Toolbar buttons + simple popups; no drag/drop, no inline previews, no editing-existing-guides (create-only for the spike).

---

## File Structure

- `apps/web/src/lib/tiptap/placeRef.ts`, `eventRef.ts` — custom Tiptap marks.
- `apps/web/src/lib/draft.ts` — `buildDraft(editorJson, title, type, places, events)` glue (unit-tested).
- `apps/web/src/components/AuthGate.tsx` — sign-in form / loading / children-when-authed (client).
- `apps/web/src/components/GuideEditor.tsx` — the Tiptap editor + toolbar + popups (client).
- `apps/web/src/components/CreatePlacePopup.tsx`, `CreateEventPopup.tsx` — data-capture forms.
- `apps/web/src/app/providers.tsx` — client wrapper mounting `AuthProvider`.
- `apps/web/src/app/layout.tsx` — modified to mount providers.
- `apps/web/src/app/(editor)/compose/page.tsx` — the compose page.

---

### Task 0: Install Tiptap

- [ ] **Step 1: Install**
```bash
cd /Users/blainecook/Code/footwork
pnpm add --filter @guides/web @tiptap/react @tiptap/core @tiptap/pm @tiptap/starter-kit
```
If network is blocked, retry once with `dangerouslyDisableSandbox: true`; else BLOCKED. Report the installed Tiptap version (the `Mark.create` API used here is stable across v2/v3; if v3 renamed anything used below, note it).

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "chore(web): add Tiptap"
```

---

### Task 1: Custom marks (placeRef, eventRef)

**Files:**
- Create: `apps/web/src/lib/tiptap/placeRef.ts`, `apps/web/src/lib/tiptap/eventRef.ts`

- [ ] **Step 1: Write `placeRef.ts`**
```ts
import { Mark, mergeAttributes } from "@tiptap/core";

/** A mark over a text span that references a place record (resolved to a strongRef at publish). */
export const PlaceRef = Mark.create({
  name: "placeRef",
  inclusive: false,
  addAttributes() {
    return {
      refId: { default: null },
      intent: { default: "card" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-place-ref]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-place-ref": "", class: "ref ref-place" }), 0];
  },
});
```

- [ ] **Step 2: Write `eventRef.ts`** (identical shape, `name: "eventRef"`, `data-event-ref`, class `ref ref-event`)
```ts
import { Mark, mergeAttributes } from "@tiptap/core";

export const EventRef = Mark.create({
  name: "eventRef",
  inclusive: false,
  addAttributes() {
    return {
      refId: { default: null },
      intent: { default: "card" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-event-ref]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-event-ref": "", class: "ref ref-event" }), 0];
  },
});
```

- [ ] **Step 3: Type-check** `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(web): Tiptap placeRef/eventRef marks"`

---

### Task 2: `buildDraft` glue (unit-tested)

**Files:**
- Create: `apps/web/src/lib/draft.ts`
- Test: `apps/web/src/lib/draft.test.ts`

`buildDraft` is the pure function the compose page uses to turn editor state into a Plan 3 `Draft`. It validates that every `refId` referenced by a mark in the doc has a corresponding payload in the maps (so we never publish a dangling ref), and that the title is non-empty.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/draft.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildDraft } from "./draft";
import type { PMDoc } from "./doc";

const doc: PMDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "place-1", intent: "card" } }] }] },
  ],
};

describe("buildDraft", () => {
  it("assembles a Draft from editor json + payload maps", () => {
    const draft = buildDraft(doc, "Title", "list", { "place-1": { name: "Tartine" } }, {});
    expect(draft.title).toBe("Title");
    expect(draft.type).toBe("list");
    expect(draft.places["place-1"].name).toBe("Tartine");
    expect(draft.doc).toBe(doc);
  });

  it("throws when a referenced refId has no payload", () => {
    expect(() => buildDraft(doc, "Title", "list", {}, {})).toThrow(/place-1/);
  });

  it("throws on an empty title", () => {
    expect(() => buildDraft(doc, "  ", "list", { "place-1": { name: "Tartine" } }, {})).toThrow(/title/i);
  });
});
```

- [ ] **Step 2: Run; confirm FAIL.**

- [ ] **Step 3: Write `apps/web/src/lib/draft.ts`**
```ts
import type { PMDoc } from "./doc";
import type { Draft, PlacePayload, EventPayload } from "./publish";

function referencedRefIds(doc: PMDoc): string[] {
  const out: string[] = [];
  for (const para of doc.content) {
    for (const node of para.content ?? []) {
      for (const mark of node.marks ?? []) {
        if ((mark.type === "placeRef" || mark.type === "eventRef") && mark.attrs?.refId) {
          out.push(mark.attrs.refId);
        }
      }
    }
  }
  return out;
}

export function buildDraft(
  doc: PMDoc,
  title: string,
  type: "curated" | "list",
  places: Record<string, PlacePayload>,
  events: Record<string, EventPayload>,
): Draft {
  if (!title.trim()) throw new Error("title is required");
  for (const refId of referencedRefIds(doc)) {
    if (!(refId in places) && !(refId in events)) {
      throw new Error(`referenced refId "${refId}" has no place/event payload`);
    }
  }
  return { title, type, doc, places, events };
}
```

- [ ] **Step 4: Run; confirm PASS (3 tests).**

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(web): buildDraft glue with dangling-ref guard"`

---

### Task 3: Providers + AuthGate

**Files:**
- Create: `apps/web/src/app/providers.tsx`, `apps/web/src/components/AuthGate.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: `apps/web/src/app/providers.tsx`**
```tsx
"use client";
import { AuthProvider } from "../lib/auth";
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

- [ ] **Step 2: Modify `apps/web/src/app/layout.tsx`** to mount providers
```tsx
import { Providers } from "./providers";

export const metadata = { title: "Guides" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: `apps/web/src/components/AuthGate.tsx`**
```tsx
"use client";
import { useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { agent, loading, signIn } = useAuth();
  const [handle, setHandle] = useState("");

  if (loading) return <p>Loading…</p>;
  if (agent) return <>{children}</>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(handle.trim());
      }}
    >
      <label>
        Sign in with your handle:{" "}
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alice.bsky.social" />
      </label>
      <button type="submit">Sign in</button>
    </form>
  );
}
```

- [ ] **Step 4: Build** `cd apps/web && pnpm exec next build` → succeeds.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(web): auth providers and sign-in gate"`

---

### Task 4: Create-place / create-event popups

**Files:**
- Create: `apps/web/src/components/CreatePlacePopup.tsx`, `apps/web/src/components/CreateEventPopup.tsx`

Each popup is a minimal modal form that, on submit, calls back with a payload; the parent generates a `refId`, stores the payload, and applies the corresponding mark to the current selection.

- [ ] **Step 1: `CreatePlacePopup.tsx`**
```tsx
"use client";
import { useState } from "react";
import type { PlacePayload } from "../lib/publish";
import { ids } from "@guides/lexicons";

export function CreatePlacePopup({ onSubmit, onCancel }: { onSubmit: (p: PlacePayload) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  return (
    <div role="dialog" aria-label="Add place">
      <input placeholder="Place name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Latitude (optional)" value={lat} onChange={(e) => setLat(e.target.value)} />
      <input placeholder="Longitude (optional)" value={lng} onChange={(e) => setLng(e.target.value)} />
      <button
        onClick={() => {
          const location =
            lat && lng ? { $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng } : undefined;
          onSubmit({ name, location });
        }}
        disabled={!name.trim()}
      >
        Add place
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 2: `CreateEventPopup.tsx`**
```tsx
"use client";
import { useState } from "react";
import type { EventPayload } from "../lib/publish";

export function CreateEventPopup({ onSubmit, onCancel }: { onSubmit: (e: EventPayload) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  return (
    <div role="dialog" aria-label="Add event">
      <input placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Starts at (ISO, optional)" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      <button onClick={() => onSubmit({ name, startsAt: startsAt || undefined })} disabled={!name.trim()}>
        Add event
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 3: Build** → succeeds. **Commit** `git add -A && git commit -m "feat(web): create-place/event popups"`

---

### Task 5: The GuideEditor component

**Files:**
- Create: `apps/web/src/components/GuideEditor.tsx`

Wires Tiptap + toolbar + popups + the place/event state maps. Exposes the current editor JSON and maps to the parent via an `onChange`-style ref or a callback on publish. To keep it self-contained, `GuideEditor` owns the maps and renders a "Publish" button that calls a passed `onPublish(doc, places, events)`.

- [ ] **Step 1: `apps/web/src/components/GuideEditor.tsx`**
```tsx
"use client";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PlaceRef } from "../lib/tiptap/placeRef";
import { EventRef } from "../lib/tiptap/eventRef";
import { CreatePlacePopup } from "./CreatePlacePopup";
import { CreateEventPopup } from "./CreateEventPopup";
import type { PMDoc } from "../lib/doc";
import type { PlacePayload, EventPayload } from "../lib/publish";

type Popup = "none" | "place" | "event";

export function GuideEditor({
  onPublish,
}: {
  onPublish: (doc: PMDoc, places: Record<string, PlacePayload>, events: Record<string, EventPayload>) => void;
}) {
  const [places, setPlaces] = useState<Record<string, PlacePayload>>({});
  const [events, setEvents] = useState<Record<string, EventPayload>>({});
  const [popup, setPopup] = useState<Popup>("none");
  const [counter, setCounter] = useState(1);

  const editor = useEditor({
    extensions: [StarterKit, PlaceRef, EventRef],
    content: "<p></p>",
    immediatelyRender: false,
  });

  if (!editor) return null;

  const addPlace = (p: PlacePayload) => {
    const refId = `place-${counter}`;
    setCounter((c) => c + 1);
    setPlaces((m) => ({ ...m, [refId]: p }));
    editor.chain().focus().setMark("placeRef", { refId, intent: "card" }).run();
    setPopup("none");
  };
  const addEvent = (e: EventPayload) => {
    const refId = `event-${counter}`;
    setCounter((c) => c + 1);
    setEvents((m) => ({ ...m, [refId]: e }));
    editor.chain().focus().setMark("eventRef", { refId, intent: "card" }).run();
    setPopup("none");
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button onClick={() => setPopup("place")} disabled={editor.state.selection.empty}>Add place</button>
        <button onClick={() => setPopup("event")} disabled={editor.state.selection.empty}>Add event</button>
      </div>
      <EditorContent editor={editor} />
      {popup === "place" && <CreatePlacePopup onSubmit={addPlace} onCancel={() => setPopup("none")} />}
      {popup === "event" && <CreateEventPopup onSubmit={addEvent} onCancel={() => setPopup("none")} />}
      <button onClick={() => onPublish(editor.getJSON() as PMDoc, places, events)}>Publish</button>
    </div>
  );
}
```

> Note: `editor.getJSON()` returns ProseMirror doc JSON matching `PMDoc` (doc → paragraphs → text nodes with `marks: [{type, attrs}]`). `immediatelyRender: false` avoids Next SSR hydration warnings. If the installed Tiptap names the bold/italic commands differently, adjust the toolbar calls (the mark *names* `bold`/`italic` from StarterKit are what `richtext-lens` keys on — keep those).

- [ ] **Step 2: Build** `cd apps/web && pnpm exec next build` → succeeds.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): GuideEditor (Tiptap + toolbar + ref popups)"`

---

### Task 6: The compose page

**Files:**
- Create: `apps/web/src/app/(editor)/compose/page.tsx`

- [ ] **Step 1: Write the page**
```tsx
"use client";
import { useState } from "react";
import { useAuth } from "../../../lib/auth";
import { AuthGate } from "../../../components/AuthGate";
import { GuideEditor } from "../../../components/GuideEditor";
import { buildDraft } from "../../../lib/draft";
import { publishGuide } from "../../../lib/publish";
import { makeCreateRecord } from "../../../lib/agent";
import type { PMDoc } from "../../../lib/doc";
import type { PlacePayload, EventPayload } from "../../../lib/publish";

function Composer() {
  const { agent, did } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"curated" | "list">("list");
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPublish = async (
    doc: PMDoc,
    places: Record<string, PlacePayload>,
    events: Record<string, EventPayload>,
  ) => {
    setError(null);
    try {
      if (!agent || !did) throw new Error("not signed in");
      const draft = buildDraft(doc, title, type, places, events);
      const uri = await publishGuide(did, makeCreateRecord(agent, did), draft);
      setResultUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main>
      <h1>Compose a guide</h1>
      <input placeholder="Guide title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select value={type} onChange={(e) => setType(e.target.value as "curated" | "list")}>
        <option value="list">List</option>
        <option value="curated">Curated</option>
      </select>
      <GuideEditor onPublish={onPublish} />
      {error && <p role="alert">Error: {error}</p>}
      {resultUri && (
        <p>
          Published: <code>{resultUri}</code>
        </p>
      )}
    </main>
  );
}

export default function ComposePage() {
  return (
    <AuthGate>
      <Composer />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Build** `cd apps/web && pnpm exec next build` → succeeds. Also `pnpm -r test` (no regressions).

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): compose page wiring editor + publish"`

---

### Task 7: Live round-trip verification (manual)

This is the payoff: a real write to a real PDS, indexed by the Plan 2 AppView, with CID verification. It requires a real atproto/Bluesky account and a browser, so it is a documented manual procedure, not an automated test. Record the outcome in the commit message / PR.

- [ ] **Step 1: Start the AppView (Plan 2) and the web app**
```bash
# Terminal A — AppView ingesting the two guide collections from Jetstream
cd /Users/blainecook/Code/footwork/apps/appview && APPVIEW_DB=appview.sqlite PORT=3001 pnpm start
# Terminal B — the editor
cd /Users/blainecook/Code/footwork/apps/web && pnpm dev
```

- [ ] **Step 2: Compose & publish**
  - Open `http://127.0.0.1:3000/compose` (note: 127.0.0.1, not localhost — the OAuth loopback requirement).
  - Sign in with a real handle, approve the scopes.
  - Type prose, select a span, "Add place" (give it a name + optional lat/lng), Publish.
  - Confirm the page shows a `Published: at://…/town.roundabout.guide.document/…` URI.

- [ ] **Step 3: Verify the round-trip through the AppView**
  - From the published URI, extract `:did` and `:rkey` and query:
    ```bash
    curl -s "http://localhost:3001/guide/<did>/<rkey>" | jq
    ```
  - Expect: the document `record` (title, text, facets), `author.handle`, and `references[<placeUri>].verified`.
  - **CID-compat check:** if `verified` is `true`, the AppView's `cidForRecord` matches the PDS's CID for the place record — the Plan 2 caveat is resolved. If `verified` is `false`, capture the place record (`curl` the PDS `getRecord`), compare `cidForRecord(value)` to the PDS `cid`, and reconcile the DAG-CBOR computation (e.g. lex value vs stored bytes for any non-scalar field). Record the finding.

- [ ] **Step 4: Document the outcome**
  - Commit a short note (e.g. `docs/superpowers/notes/2026-05-31-live-roundtrip.md`) recording: the published URI, whether `verified` was true, and any CID reconciliation needed.
```bash
git add -A && git commit -m "docs(web): record live round-trip verification outcome"
```

---

## Definition of Done

- `pnpm -r test` passes from the repo root (incl. `buildDraft` tests).
- `apps/web` type-checks and `next build` succeeds.
- The compose page renders behind the auth gate; signing in, composing with a place/event, and publishing produces a guide document on a real PDS.
- The published guide is retrievable through the Plan 2 AppView, and the CID-compat outcome is recorded (verified true, or reconciled).
- All work committed in small increments.

## Notes for Plan 5 (Viewer) and beyond

- The editor proves the **write** half of the live round-trip; Plan 5 (Viewer) renders the AppView's `HydratedGuide` with the rendering lenses (segment via `facetSegments`, render place/event refs as cards/chips by `intent`), and adds the **Save** button (writes a `save` record).
- Editing existing guides (load via `storageToDoc` into Tiptap) is deferred — the lens already supports it; only the load-into-editor wiring is missing.
- If the live CID-compat check required reconciliation, fold the fix back into the AppView's `cid.ts` and the lexicons if a value-shape adjustment was needed.

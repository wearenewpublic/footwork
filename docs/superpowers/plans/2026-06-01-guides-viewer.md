# Guides Viewer (Plan 5 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public, search-indexable Viewer in `apps/web`: an SSR guide page that renders a `HydratedGuide` from the AppView using an **HIR-style rendering lens** (flat byte-ranged facets → a properly-nested inline tree → React), a Save button that writes a `save` record, and a profile page listing a user's saves. This closes the spike's full loop: write → index → **render publicly**.

**Architecture:** A pure **HIR builder** (`src/lib/hir.ts`) converts `{text, facets}` into paragraph blocks of text nodes, each carrying its active marks **outermost-first** — segmenting at *every* facet boundary (so overlapping facets are handled), ordering marks by type precedence (entities/links outer, bold/italic inner), per the relationaltext HIR model. A React renderer walks the HIR and reverse-wraps marks so links/place/event chips end up outside bold/italic. SSR pages (server components) fetch the AppView read API at request time and render this; the Save button is a client component reusing Plan 3's auth/agent.

**Tech Stack:** Next.js (App Router, server + client components), React, `@guides/lexicons` (`ids`, types), Plan 3's `auth.tsx`/`agent.ts`, the AppView read API. Vitest for the HIR core.

> **Why an HIR builder, not Plan 1's `facetSegments`:** `facetSegments` assumes non-overlapping facets and yields one facet's features per segment. The relationaltext **HIR** model (see `relationaltext`'s `docs/guide/hir.md`) is the correct approach: segment at every mark boundary so a region covered by two overlapping facets becomes one text node carrying *both* marks; then resolve nesting by a stable type precedence (links/entities outermost, display marks innermost) and apply marks in reverse when wrapping. CommonMark-style correctness (a link wraps emphasis, not vice-versa) falls out of this. We implement a focused inline subset (no list containers, no `￼` block sentinels — our docs are simple paragraphs joined by `\n\n`).

> **Decisions (vetoable on review):**
> - **No verification display** (per direction): unresolved/missing references render as plain anchor text; resolved place/event render as inline chips. The `verified` flag is not surfaced in the UI.
> - **Inline chips** for place/event refs (not block cards): the anchored span becomes a styled chip showing the resolved name (+ a `title` detail: place location / event start).
> - **Mark precedence (outermost → innermost):** `link` > `placeRef` > `eventRef` > `bold`/`italic`. Among multiple *entity* marks on one identical span (a rare authoring artifact — we saw `placeRef + eventRef` co-occur), the highest-precedence entity becomes the chip; lower entity marks on that exact span are dropped. Format marks always apply (inner).
> - **AppView base URL** via `NEXT_PUBLIC_APPVIEW_URL` (default `http://localhost:3001`).
> - **Save** adds `repo:town.roundabout.guide.save` to the OAuth scopes in `auth.tsx`.

---

## File Structure

- `apps/web/src/lib/hir.ts` — the HIR builder: `buildHir(text, facets) -> HirBlock[]`. Pure; the testable core.
- `apps/web/src/lib/appview.ts` — read-API client: `fetchGuide(did, rkey)`, `fetchSaves(did)` (+ `HydratedGuide`/`SaveRow` types).
- `apps/web/src/components/GuideView.tsx` — renders an HIR + references map to React (reverse-wrap marks; chips).
- `apps/web/src/components/SaveButton.tsx` — client; writes a `save` record via the agent.
- `apps/web/src/lib/save.ts` — `buildSaveRecord(subject)` (pure; tested).
- `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx` — SSR guide page + `generateMetadata`.
- `apps/web/src/app/(viewer)/profile/[did]/page.tsx` — SSR saves list.
- Modify `apps/web/src/lib/auth.tsx` — add the save scope.
- Tests: `apps/web/src/lib/hir.test.ts`, `apps/web/src/lib/save.test.ts`.

---

### Task 0: AppView read-API client

**Files:**
- Create: `apps/web/src/lib/appview.ts`
- Test: `apps/web/src/lib/appview.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/appview.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { fetchGuide, appviewUrl } from "./appview";

describe("appview client", () => {
  it("derives the base url from env or default", () => {
    expect(appviewUrl("/guides")).toMatch(/\/guides$/);
  });

  it("fetchGuide hits /guide/:did/:rkey and returns parsed json (null on 404)", async () => {
    const json = { uri: "at://did/x/1", record: { title: "Hi" }, references: {}, author: { did: "did", handle: null, pds: null } };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => json });
    expect(await fetchGuide("did:plc:a", "1", f as any)).toEqual(json);

    const f404 = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchGuide("did:plc:a", "nope", f404 as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (`cd apps/web && pnpm test`).

- [ ] **Step 3: Write `apps/web/src/lib/appview.ts`**
```ts
export interface Actor {
  did: string;
  handle: string | null;
  pds: string | null;
}
export interface ResolvedRef {
  uri: string;
  expectedCid: string;
  value: Record<string, unknown> | null;
  verified: boolean;
}
export interface HydratedGuide {
  uri: string;
  cid: string;
  author: Actor;
  record: Record<string, unknown>;
  references: Record<string, ResolvedRef>;
}
export interface SaveRow {
  uri: string;
  did: string;
  subjectUri: string;
  subjectCid: string;
}

const BASE = process.env.NEXT_PUBLIC_APPVIEW_URL ?? "http://localhost:3001";

export function appviewUrl(path: string): string {
  return `${BASE}${path}`;
}

type Fetch = typeof fetch;

export async function fetchGuide(
  did: string,
  rkey: string,
  f: Fetch = fetch,
): Promise<HydratedGuide | null> {
  const res = await f(appviewUrl(`/guide/${did}/${rkey}`), { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as HydratedGuide;
}

export async function fetchSaves(did: string, f: Fetch = fetch): Promise<SaveRow[]> {
  const res = await f(appviewUrl(`/profile/${did}/saves`), { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { saves: SaveRow[] };
  return body.saves ?? [];
}
```

- [ ] **Step 4: Run; confirm PASS.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(web): AppView read-API client"`

---

### Task 1: The HIR builder (the rendering-lens core)

**Files:**
- Create: `apps/web/src/lib/hir.ts`
- Test: `apps/web/src/lib/hir.test.ts`

Build paragraph blocks of text nodes from `{text, facets}`. Segment at **every** facet boundary within a paragraph; each text node carries all marks whose range covers it, ordered **outermost-first** by precedence. Paragraphs split on `\n\n`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/hir.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildHir } from "./hir";
import { ids } from "@guides/lexicons";

const DOC = ids.TownRoundaboutGuideDocument;
const place = { uri: "at://x/place/1", cid: "bafyplace" };

function facet(byteStart: number, byteEnd: number, features: unknown[]) {
  return { index: { byteStart, byteEnd }, features };
}

describe("buildHir", () => {
  it("splits paragraphs and emits plain text nodes", () => {
    const hir = buildHir("Hello\n\nWorld", []);
    expect(hir.length).toBe(2);
    expect(hir[0]).toEqual({ type: "paragraph", children: [{ type: "text", content: "Hello", marks: [] }] });
    expect(hir[1].children[0]).toEqual({ type: "text", content: "World", marks: [] });
  });

  it("segments at facet boundaries and attaches marks", () => {
    // "Go to Tartine" with placeRef over "Tartine" [6,13)
    const hir = buildHir("Go to Tartine", [
      facet(6, 13, [{ $type: `${DOC}#placeRef`, ref: place, intent: "card" }]),
    ]);
    const nodes = hir[0].children;
    expect(nodes.map((n) => n.content)).toEqual(["Go to ", "Tartine"]);
    expect(nodes[0].marks).toEqual([]);
    expect(nodes[1].marks).toEqual([{ kind: "placeRef", attrs: { ref: place, intent: "card" } }]);
  });

  it("handles OVERLAPPING facets — a segment carries all active marks, outermost first", () => {
    // "read the docs": link [0,13), bold [5,13). Overlap "the docs" has both; link is outer.
    const hir = buildHir("read the docs", [
      facet(0, 13, [{ $type: `${DOC}#link`, uri: "https://e.com" }]),
      facet(5, 13, [{ $type: `${DOC}#format`, kind: "bold" }]),
    ]);
    const nodes = hir[0].children;
    expect(nodes.map((n) => n.content)).toEqual(["read ", "the docs"]);
    expect(nodes[0].marks.map((m) => m.kind)).toEqual(["link"]);
    // overlap region: link (outer) then bold (inner)
    expect(nodes[1].marks.map((m) => m.kind)).toEqual(["link", "bold"]);
  });

  it("orders entity over format and dedupes co-located entities by precedence", () => {
    // span [0,7) carries placeRef + eventRef + italic → entity precedence place>event; italic inner
    const hir = buildHir("pelmeni", [
      facet(0, 7, [
        { $type: `${DOC}#placeRef`, ref: place, intent: "card" },
        { $type: `${DOC}#eventRef`, ref: { uri: "at://x/ev/1", cid: "bafyev" }, intent: "card" },
        { $type: `${DOC}#format`, kind: "italic" },
      ]),
    ]);
    expect(hir[0].children[0].marks.map((m) => m.kind)).toEqual(["placeRef", "italic"]);
  });

  it("computes UTF-8 byte boundaries correctly for multibyte text", () => {
    // "👋 Tartine": placeRef over "Tartine" at bytes [5,12)
    const hir = buildHir("👋 Tartine", [facet(5, 12, [{ $type: `${DOC}#placeRef`, ref: place }])]);
    const nodes = hir[0].children;
    expect(nodes.map((n) => n.content)).toEqual(["👋 ", "Tartine"]);
  });
});
```

- [ ] **Step 2: Run; confirm FAIL.**

- [ ] **Step 3: Write `apps/web/src/lib/hir.ts`**
```ts
import { ids } from "@guides/lexicons";

const DOC = ids.TownRoundaboutGuideDocument;

export interface HirMark {
  kind: "link" | "placeRef" | "eventRef" | "bold" | "italic";
  attrs: Record<string, unknown>;
}
export interface HirText {
  type: "text";
  content: string;
  marks: HirMark[];
}
export interface HirBlock {
  type: "paragraph";
  children: HirText[];
}

interface RawFacet {
  index: { byteStart: number; byteEnd: number };
  features: unknown[];
}

// Outermost first. Lower index = wraps further outside.
const PRECEDENCE: HirMark["kind"][] = ["link", "placeRef", "eventRef", "bold", "italic"];
const ENTITIES = new Set<HirMark["kind"]>(["link", "placeRef", "eventRef"]);

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Map a wire feature object to an HirMark (or null if unknown). */
function featureToMark(f: any): HirMark | null {
  if (f?.$type === `${DOC}#format` && (f.kind === "bold" || f.kind === "italic")) {
    return { kind: f.kind, attrs: {} };
  }
  if (f?.$type === `${DOC}#link` && typeof f.uri === "string") {
    return { kind: "link", attrs: { uri: f.uri } };
  }
  if (f?.$type === `${DOC}#placeRef` && f.ref) {
    return { kind: "placeRef", attrs: { ref: f.ref, intent: f.intent ?? "card" } };
  }
  if (f?.$type === `${DOC}#eventRef` && f.ref) {
    return { kind: "eventRef", attrs: { ref: f.ref, intent: f.intent ?? "card" } };
  }
  return null;
}

/** Order marks outermost-first; drop all but the highest-precedence entity. */
function orderMarks(marks: HirMark[]): HirMark[] {
  const sorted = [...marks].sort(
    (a, b) => PRECEDENCE.indexOf(a.kind) - PRECEDENCE.indexOf(b.kind),
  );
  const out: HirMark[] = [];
  let entityTaken = false;
  for (const m of sorted) {
    if (ENTITIES.has(m.kind)) {
      if (entityTaken) continue; // keep only the outermost entity on this span
      entityTaken = true;
    }
    out.push(m);
  }
  return out;
}

/** Build paragraph blocks of marked text nodes from text + flat facets. */
export function buildHir(text: string, facets: RawFacet[]): HirBlock[] {
  const bytes = enc.encode(text);

  // Paragraph boundaries are "\n\n" runs in the text; compute their byte spans.
  // We segment the whole byte string, then split blocks at paragraph separators.
  const sepByte = enc.encode("\n\n");
  const blocks: HirBlock[] = [];

  // Collect every boundary (facet starts/ends) to segment minimally.
  const bounds = new Set<number>([0, bytes.length]);
  for (const f of facets) {
    bounds.add(f.index.byteStart);
    bounds.add(f.index.byteEnd);
  }
  // Also add paragraph-separator boundaries so "\n\n" sits in its own segment.
  for (let i = 0; i + sepByte.length <= bytes.length; i++) {
    if (bytes[i] === 0x0a && bytes[i + 1] === 0x0a) {
      bounds.add(i);
      bounds.add(i + 2);
    }
  }
  const points = [...bounds].sort((a, b) => a - b);

  let current: HirText[] = [];
  const flush = () => {
    blocks.push({ type: "paragraph", children: current });
    current = [];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const segText = dec.decode(bytes.slice(start, end));
    if (segText === "\n\n") {
      flush();
      continue;
    }
    const active = facets
      .filter((f) => f.index.byteStart <= start && f.index.byteEnd >= end)
      .flatMap((f) => f.features.map(featureToMark))
      .filter((m): m is HirMark => m !== null);
    current.push({ type: "text", content: segText, marks: orderMarks(active) });
  }
  flush();

  // Drop empty paragraphs (e.g. trailing) but keep at least one.
  const nonEmpty = blocks.filter((b) => b.children.length > 0);
  return nonEmpty.length ? nonEmpty : [{ type: "paragraph", children: [] }];
}
```

- [ ] **Step 4: Run; confirm PASS (5 tests).**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(web): HIR builder (flat facets -> nested inline tree)"`

---

### Task 2: GuideView renderer

**Files:**
- Create: `apps/web/src/components/GuideView.tsx`

Walks the HIR; renders each text node by **reverse-wrapping** its marks (innermost applied first), so entity/link wraps bold/italic. Place/event marks render as inline chips, resolving display text from the `references` map.

- [ ] **Step 1: Write `apps/web/src/components/GuideView.tsx`**
```tsx
import type { ReactNode } from "react";
import { buildHir, type HirMark } from "../lib/hir";
import type { HydratedGuide, ResolvedRef } from "../lib/appview";

function refValue(refs: Record<string, ResolvedRef>, mark: HirMark): Record<string, unknown> | null {
  const ref = mark.attrs.ref as { uri?: string } | undefined;
  return ref?.uri ? (refs[ref.uri]?.value ?? null) : null;
}

function applyMark(mark: HirMark, inner: ReactNode, refs: Record<string, ResolvedRef>, key: string): ReactNode {
  switch (mark.kind) {
    case "bold":
      return <strong key={key}>{inner}</strong>;
    case "italic":
      return <em key={key}>{inner}</em>;
    case "link":
      return (
        <a key={key} href={String(mark.attrs.uri ?? "#")} rel="noopener noreferrer">
          {inner}
        </a>
      );
    case "placeRef": {
      const v = refValue(refs, mark);
      const name = (v?.name as string) ?? null;
      return (
        <span key={key} className="chip chip-place" title={name ? `Place: ${name}` : undefined}>
          {inner}
        </span>
      );
    }
    case "eventRef": {
      const v = refValue(refs, mark);
      const starts = (v?.startsAt as string) ?? null;
      return (
        <span key={key} className="chip chip-event" title={starts ? `Event • ${starts}` : "Event"}>
          {inner}
        </span>
      );
    }
    default:
      return inner;
  }
}

export function GuideView({ guide }: { guide: HydratedGuide }) {
  const text = String(guide.record.text ?? "");
  const facets = (guide.record.facets as any[]) ?? [];
  const blocks = buildHir(text, facets);

  return (
    <article>
      {blocks.map((block, bi) => (
        <p key={bi}>
          {block.children.map((node, ni) => {
            // Reverse-wrap: innermost mark closest to text, outermost wraps last.
            let el: ReactNode = node.content;
            for (let m = node.marks.length - 1; m >= 0; m--) {
              el = applyMark(node.marks[m], el, guide.references, `${bi}-${ni}-${m}`);
            }
            return <span key={ni}>{el}</span>;
          })}
        </p>
      ))}
    </article>
  );
}
```

- [ ] **Step 2: Verify build** `cd apps/web && pnpm exec next build` → succeeds.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): GuideView HIR renderer with inline chips"`

---

### Task 3: SSR guide page + metadata

**Files:**
- Create: `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx`

- [ ] **Step 1: Write the page**
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchGuide } from "../../../../../lib/appview";
import { GuideView } from "../../../../../components/GuideView";
import { SaveButton } from "../../../../../components/SaveButton";

type Params = { did: string; rkey: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { did, rkey } = await params;
  const guide = await fetchGuide(did, rkey);
  if (!guide) return { title: "Guide not found" };
  const title = String(guide.record.title ?? "Guide");
  const description = String(guide.record.text ?? "").slice(0, 200);
  const canonical = `/guide/${did}/${rkey}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "article", url: canonical },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { did, rkey } = await params;
  const guide = await fetchGuide(did, rkey);
  if (!guide) notFound();

  const title = String(guide.record.title ?? "Guide");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    author: { "@type": "Person", name: guide.author.handle ?? guide.author.did },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1>{title}</h1>
      <p className="byline">by {guide.author.handle ?? guide.author.did}</p>
      <GuideView guide={guide} />
      <SaveButton subjectUri={guide.uri} subjectCid={guide.cid} />
    </main>
  );
}
```

- [ ] **Step 2: Verify build** `cd apps/web && pnpm exec next build` → succeeds and lists `/guide/[did]/[rkey]`.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): SSR guide page with OG/JSON-LD metadata"`

---

### Task 4: Save record + Save button + scope

**Files:**
- Create: `apps/web/src/lib/save.ts`, `apps/web/src/lib/save.test.ts`
- Create: `apps/web/src/components/SaveButton.tsx`
- Modify: `apps/web/src/lib/auth.tsx` (add save scope)

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/save.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSaveRecord } from "./save";
import { ids } from "@guides/lexicons";

describe("buildSaveRecord", () => {
  it("builds a save record with a strongRef subject and createdAt", () => {
    const rec = buildSaveRecord({ uri: "at://did/doc/1", cid: "bafydoc" });
    expect(rec.$type).toBe(ids.TownRoundaboutGuideSave);
    expect(rec.subject).toEqual({ uri: "at://did/doc/1", cid: "bafydoc" });
    expect(typeof rec.createdAt).toBe("string");
  });
});
```

- [ ] **Step 2: Run; confirm FAIL.**

- [ ] **Step 3: Write `apps/web/src/lib/save.ts`**
```ts
import { ids, type StrongRef } from "@guides/lexicons";

export function buildSaveRecord(subject: StrongRef): Record<string, unknown> {
  return {
    $type: ids.TownRoundaboutGuideSave,
    subject: { uri: subject.uri, cid: subject.cid },
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run; confirm PASS.**

- [ ] **Step 5: Add the save scope in `apps/web/src/lib/auth.tsx`** — extend the `SCOPE` array with `"repo:town.roundabout.guide.save"`:
```ts
const SCOPE = [
  "atproto",
  "repo:town.roundabout.guide.document",
  "repo:town.roundabout.guide.place",
  "repo:community.lexicon.calendar.event",
  "repo:town.roundabout.guide.save",
].join(" ");
```

- [ ] **Step 6: Write `apps/web/src/components/SaveButton.tsx`**
```tsx
"use client";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { buildSaveRecord } from "../lib/save";
import { ids } from "@guides/lexicons";

export function SaveButton({ subjectUri, subjectCid }: { subjectUri: string; subjectCid: string }) {
  const { agent, did } = useAuth();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!agent || !did) return null; // only show to signed-in users

  const onSave = async () => {
    setState("saving");
    try {
      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: ids.TownRoundaboutGuideSave,
        record: buildSaveRecord({ uri: subjectUri, cid: subjectCid }),
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <button onClick={onSave} disabled={state === "saving" || state === "saved"}>
      {state === "saved" ? "Saved ✓" : state === "saving" ? "Saving…" : state === "error" ? "Retry save" : "Save"}
    </button>
  );
}
```

- [ ] **Step 7: Verify build** `cd apps/web && pnpm exec next build` → succeeds.
- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(web): Save button writing a save record (+ save scope)"`

---

### Task 5: SSR profile/saves page

**Files:**
- Create: `apps/web/src/app/(viewer)/profile/[did]/page.tsx`

- [ ] **Step 1: Write the page**
```tsx
import { fetchSaves } from "../../../../lib/appview";
import Link from "next/link";

type Params = { did: string };

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const { did } = await params;
  const saves = await fetchSaves(did);

  return (
    <main>
      <h1>Saved guides</h1>
      <p className="byline">{did}</p>
      {saves.length === 0 ? (
        <p>No saved guides yet.</p>
      ) : (
        <ul>
          {saves.map((s) => {
            // subjectUri = at://<did>/<collection>/<rkey> → link to /guide/<did>/<rkey>
            const m = /^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/.exec(s.subjectUri);
            const href = m ? `/guide/${m[1]}/${m[2]}` : "#";
            return (
              <li key={s.uri}>
                <Link href={href}>{s.subjectUri}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify build + full test suite**
```bash
cd /Users/blainecook/Code/footwork/apps/web && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec next build
cd /Users/blainecook/Code/footwork && pnpm -r test
```
Expected: tsc + build succeed; `/guide/[did]/[rkey]` and `/profile/[did]` listed; all tests green (lexicons 7, web 13 + hir 5 + appview 2 + save 1 = 21, appview 29).

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(web): SSR profile saves page"`

---

### Task 6: Live verification (manual)

This requires a browser + the user's account + a network that reaches atproto. Run the AppView (with a replay cursor if needed) and the web app, then:

- [ ] **Step 1:** Open `http://127.0.0.1:3000/guide/<your-did>/<your-guide-rkey>` for a previously published guide. Confirm: the prose renders, place/event spans show as inline chips with the resolved names, and the page has a title/byline. View source → confirm server-rendered HTML + the JSON-LD `<script>` + OG meta tags are present (indexability).
- [ ] **Step 2:** Sign in (the Save button appears when authed), click **Save**; confirm it flips to "Saved ✓". Then open `http://127.0.0.1:3000/profile/<your-did>` and confirm the saved guide is listed (the AppView indexes the `save` record from the firehose — replay the cursor if needed).
- [ ] **Step 3:** Record the outcome in `docs/superpowers/notes/2026-06-01-viewer-verification.md` and commit.

---

## Definition of Done

- `pnpm -r test` passes from the repo root (incl. the HIR builder, appview client, and save-record tests).
- `apps/web` type-checks and `next build` succeeds; `/guide/[did]/[rkey]` and `/profile/[did]` are listed.
- The HIR builder correctly: segments at every facet boundary, carries all active marks on overlapping regions outermost-first, orders entity-over-format with entity dedup, and computes UTF-8 byte boundaries (incl. multibyte).
- The guide page server-renders prose with inline place/event chips (resolved names), unresolved refs degrade to plain text, and emits canonical + OG + JSON-LD.
- The Save button writes a `save` record (save scope added); the profile page lists saves.
- All work committed in small, green increments.

## Notes / follow-ups

- The HIR builder implements the inline subset of the relationaltext HIR (no list containers, no `￼` block sentinels — our editor emits `\n\n` paragraphs). If we later adopt relationaltext's block-marker convention or its `relational-text` library directly (with a format adapter for our `town.roundabout.guide.*` facets), this module is the seam to replace — behind the same `buildHir` contract.
- Block-card rendering (vs inline chips) and richer chip detail (maps, event RSVP) are deferred.
- This completes the 5-plan spike: Foundation → AppView → Editor (write) → Editor (UI) → Viewer. The full round-trip (write → index → render) is live-verified end to end.

# Discovery Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app navigable and published guides findable: a global nav, a recent-guides list on the home page, and a byline→profile link.

**Architecture:** A shared `parseAtUri` helper (unit-tested) + a `listGuides` AppView client fn (unit-tested) underpin a home-page "recent guides" list; a global `<nav>` in the root layout links Guides/Compose; the guide byline links to the author's profile.

**Tech Stack:** Next.js 16 (app router, server components), TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-discovery-links-design.md`

## File structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/lib/aturi.ts` | `parseAtUri` helper | Create |
| `apps/web/src/lib/aturi.test.ts` | unit tests | Create |
| `apps/web/src/lib/appview.ts` | add `listGuides()` + `GuideListItem` type | Modify |
| `apps/web/src/lib/appview.test.ts` | `listGuides` unit test | Create (or add if exists) |
| `apps/web/src/app/layout.tsx` | global `<nav>` | Modify |
| `apps/web/src/app/page.tsx` | recent-guides list | Modify |
| `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx` | byline→profile link | Modify |
| `apps/web/src/app/(viewer)/profile/[did]/page.tsx` | use `parseAtUri` | Modify |
| `apps/web/src/app/globals.css` | `.nav` styles | Modify |

---

### Task 1: `parseAtUri` helper (TDD) + adopt in profile page

**Files:**
- Create: `apps/web/src/lib/aturi.ts`
- Create: `apps/web/src/lib/aturi.test.ts`
- Modify: `apps/web/src/app/(viewer)/profile/[did]/page.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/aturi.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseAtUri } from "./aturi";

describe("parseAtUri", () => {
  it("parses a well-formed at:// uri", () => {
    expect(parseAtUri("at://did:plc:abc/town.roundabout.guide.document/xyz")).toEqual({
      did: "did:plc:abc",
      collection: "town.roundabout.guide.document",
      rkey: "xyz",
    });
  });

  it("returns null for a malformed uri", () => {
    expect(parseAtUri("not-an-at-uri")).toBeNull();
    expect(parseAtUri("at://did:plc:abc/onlytwo")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/aturi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `apps/web/src/lib/aturi.ts`:

```typescript
/** Parse an `at://<did>/<collection>/<rkey>` URI into its parts, or null if malformed. */
export function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m) return null;
  return { did: m[1], collection: m[2], rkey: m[3] };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/aturi.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Adopt in the profile page.** In `apps/web/src/app/(viewer)/profile/[did]/page.tsx`, replace the inline regex with `parseAtUri`. The file currently has:

```tsx
          {saves.map((s) => {
            const m = /^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/.exec(s.subjectUri);
            const href = m ? `/guide/${m[1]}/${m[2]}` : "#";
            return (
              <li key={s.uri}>
                <Link href={href}>{s.subjectUri}</Link>
              </li>
            );
          })}
```

Add the import `import { parseAtUri } from "../../../../lib/aturi";` (alongside the existing imports) and change the body to:

```tsx
          {saves.map((s) => {
            const parts = parseAtUri(s.subjectUri);
            const href = parts ? `/guide/${parts.did}/${parts.rkey}` : "#";
            return (
              <li key={s.uri}>
                <Link href={href}>{s.subjectUri}</Link>
              </li>
            );
          })}
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm --filter @guides/web exec vitest run src/lib/aturi.test.ts` (pass) and `pnpm --filter @guides/web exec tsc --noEmit` (clean).
```bash
git add apps/web/src/lib/aturi.ts apps/web/src/lib/aturi.test.ts "apps/web/src/app/(viewer)/profile/[did]/page.tsx"
git commit -m "feat(web): parseAtUri helper, adopt in profile page"
```

---

### Task 2: `listGuides` AppView client (TDD)

**Files:**
- Modify: `apps/web/src/lib/appview.ts`
- Create: `apps/web/src/lib/appview.test.ts`

Current `apps/web/src/lib/appview.ts` exports interfaces (`Actor`, `ResolvedRef`, `HydratedGuide`, `SaveRow`), `appviewUrl(path)`, `type Fetch = typeof fetch`, `fetchGuide(did, rkey, f?)`, and `fetchSaves(did, f?)`. The AppView `GET /guides` returns `{ guides: { uri: string; did: string; record: Record<string, unknown> }[] }`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/appview.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { listGuides } from "./appview";

describe("listGuides", () => {
  it("returns the guides array from the AppView", async () => {
    const guides = [
      { uri: "at://did:plc:a/town.roundabout.guide.document/g1", did: "did:plc:a", record: { title: "One" } },
    ];
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ guides }) }) as unknown as typeof fetch;
    expect(await listGuides(f)).toEqual(guides);
  });

  it("returns [] on a non-OK response", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
    expect(await listGuides(f)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/appview.test.ts`
Expected: FAIL — `listGuides` not exported.

- [ ] **Step 3: Implement** in `apps/web/src/lib/appview.ts`. Add the item type near the other interfaces:

```typescript
export interface GuideListItem {
  uri: string;
  did: string;
  record: Record<string, unknown>;
}
```

Add the function alongside `fetchGuide`/`fetchSaves` (it uses the existing `appviewUrl` + `Fetch`):

```typescript
export async function listGuides(f: Fetch = fetch): Promise<GuideListItem[]> {
  const res = await f(appviewUrl("/guides"), { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { guides: GuideListItem[] };
  return body.guides ?? [];
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/appview.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/appview.ts apps/web/src/lib/appview.test.ts
git commit -m "feat(web): listGuides AppView client"
```

---

### Task 3: Global nav + home recent-guides list + byline link + styles

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx`
- Modify: `apps/web/src/app/globals.css`

UI — verified by `next build` + manual. No new vitest.

- [ ] **Step 1: Global nav in `layout.tsx`.** Current file:

```tsx
import "./globals.css";
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

Add `import Link from "next/link";` and a `<nav>` inside `<body>` above `<Providers>`:

```tsx
import "./globals.css";
import Link from "next/link";
import { Providers } from "./providers";

export const metadata = { title: "Guides" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="nav-brand">Guides</Link>
          <Link href="/compose">Compose</Link>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Recent guides on the home page.** Replace `apps/web/src/app/page.tsx` entirely:

```tsx
import Link from "next/link";
import { listGuides } from "../lib/appview";
import { parseAtUri } from "../lib/aturi";

function shortDid(did: string): string {
  return did.length > 18 ? did.slice(0, 17) + "…" : did;
}

export default async function Home() {
  const guides = await listGuides();
  return (
    <main>
      <h1>Guides</h1>
      <p>A place-based, collaborative recommendation tool on AT Protocol.</p>
      <h2>Recent guides</h2>
      {guides.length === 0 ? (
        <p>
          No guides yet — <Link href="/compose">compose the first one</Link>.
        </p>
      ) : (
        <ul>
          {guides.map((g) => {
            const parts = parseAtUri(g.uri);
            const href = parts ? `/guide/${parts.did}/${parts.rkey}` : "#";
            const title = String(g.record.title ?? "Untitled guide");
            return (
              <li key={g.uri}>
                <Link href={href}>{title}</Link>{" "}
                <Link href={`/profile/${g.did}`} className="byline">by {shortDid(g.did)}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Byline → profile link on the guide page.** In `apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx`, add `import Link from "next/link";` (top, with the other imports) and replace the byline line:

```tsx
      <p className="byline">by {guide.author.handle ?? guide.author.did}</p>
```

with:

```tsx
      <p className="byline">
        by <Link href={`/profile/${guide.author.did}`}>{guide.author.handle ?? guide.author.did}</Link>
      </p>
```

- [ ] **Step 4: Nav styles** — append to `apps/web/src/app/globals.css`:

```css
/* Global navigation */
.nav {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}
.nav a { text-decoration: none; color: #1a56c4; }
.nav .nav-brand { font-weight: 700; color: #1a1a1a; margin-right: auto; }
```

(`margin-right: auto` on the brand pushes Compose to the right.)

- [ ] **Step 5: Verify**

Run: `pnpm --filter @guides/web exec tsc --noEmit` → clean.
Run: `pnpm --filter @guides/web build` → success.
Run: `pnpm --filter @guides/web test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/page.tsx "apps/web/src/app/(viewer)/guide/[did]/[rkey]/page.tsx" apps/web/src/app/globals.css
git commit -m "feat(web): global nav, recent-guides list, byline profile link"
```

---

### Final verification

- [ ] `pnpm --filter @guides/web test && pnpm --filter @guides/web exec tsc --noEmit && pnpm --filter @guides/web build` — all green.
- [ ] Manual: home page shows the nav + a recent-guides list (or empty state); clicking a title opens the guide; the guide byline links to the author's profile; "Compose" reaches the editor.

## Notes for the implementer

- The home page becomes an async server component (`await listGuides()`); it calls the AppView server-side via the existing `appviewUrl` (localhost in the sprite). Don't add `"use client"`.
- DRY/YAGNI: no search/pagination, no handle resolution in the listing, no authored-guides list on profiles.

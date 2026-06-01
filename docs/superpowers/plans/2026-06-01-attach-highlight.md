# Attach-target Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While the place/event popup is open, keep the selected span visibly highlighted in the editor (it currently goes invisible when focus leaves the editor), so it's obvious where the chip will attach.

**Architecture:** A Tiptap extension wraps a ProseMirror plugin holding an optional range; it renders one inline `Decoration` (class `.attach-target`) over that range, surviving editor blur (unlike native `::selection`). `GuideEditor` sets the highlight when opening the place/event popup and clears it on submit/cancel. The set/clear/map-through-edit transition is a pure reducer, unit-tested without a DOM.

**Tech Stack:** Tiptap v3 (`@tiptap/core`), ProseMirror (`@tiptap/pm/state`, `@tiptap/pm/view`), React, vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-attach-highlight-design.md`

## File structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/lib/tiptap/attachHighlight.ts` | pure reducer + Tiptap extension (plugin + commands) | Create |
| `apps/web/src/lib/tiptap/attachHighlight.test.ts` | unit-test the pure reducer | Create |
| `apps/web/src/components/GuideEditor.tsx` | register extension; set/clear highlight around place/event popups | Modify |
| `apps/web/src/app/globals.css` | `.attach-target` style | Modify |

---

### Task 1: Pure reducer + extension

**Files:**
- Create: `apps/web/src/lib/tiptap/attachHighlight.ts`
- Test: `apps/web/src/lib/tiptap/attachHighlight.test.ts`

- [ ] **Step 1: Write the failing reducer test**

Create `apps/web/src/lib/tiptap/attachHighlight.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { attachHighlightApply, type AttachRange } from "./attachHighlight";

describe("attachHighlightApply", () => {
  it("set stores the range", () => {
    expect(attachHighlightApply(null, { type: "set", range: { from: 3, to: 8 } })).toEqual({ from: 3, to: 8 });
  });

  it("clear resets to null", () => {
    expect(attachHighlightApply({ from: 3, to: 8 }, { type: "clear" })).toBeNull();
  });

  it("map shifts a stored range through the mapping", () => {
    const value: AttachRange = { from: 3, to: 8 };
    // e.g. 2 chars inserted before the range
    const mapped = attachHighlightApply(value, { type: "map", map: (pos) => pos + 2 });
    expect(mapped).toEqual({ from: 5, to: 10 });
  });

  it("map on a null range stays null", () => {
    expect(attachHighlightApply(null, { type: "map", map: (pos) => pos + 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @guides/web exec vitest run src/lib/tiptap/attachHighlight.test.ts`
Expected: FAIL — module/`attachHighlightApply` not found.

- [ ] **Step 3: Implement `attachHighlight.ts`**

Create `apps/web/src/lib/tiptap/attachHighlight.ts`:

```typescript
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type AttachRange = { from: number; to: number } | null;

export type AttachAction =
  | { type: "set"; range: { from: number; to: number } }
  | { type: "clear" }
  | { type: "map"; map: (pos: number) => number };

/** Pure transition for the highlighted range. Unit-tested without a DOM. */
export function attachHighlightApply(value: AttachRange, action: AttachAction): AttachRange {
  switch (action.type) {
    case "set":
      return { from: action.range.from, to: action.range.to };
    case "clear":
      return null;
    case "map":
      return value ? { from: action.map(value.from), to: action.map(value.to) } : null;
  }
}

const attachHighlightKey = new PluginKey<AttachRange>("attachHighlight");

// Transaction meta payloads the plugin reads to build an AttachAction.
type Meta = { type: "set"; range: { from: number; to: number } } | { type: "clear" };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachHighlight: {
      setAttachHighlight: (range: { from: number; to: number }) => ReturnType;
      clearAttachHighlight: () => ReturnType;
    };
  }
}

export const AttachHighlight = Extension.create({
  name: "attachHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<AttachRange>({
        key: attachHighlightKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(attachHighlightKey) as Meta | undefined;
            if (meta?.type === "set") return attachHighlightApply(value, { type: "set", range: meta.range });
            if (meta?.type === "clear") return attachHighlightApply(value, { type: "clear" });
            if (tr.docChanged) return attachHighlightApply(value, { type: "map", map: (pos) => tr.mapping.map(pos) });
            return value;
          },
        },
        props: {
          decorations(state) {
            const range = attachHighlightKey.getState(state);
            if (!range || range.from >= range.to) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, { class: "attach-target" }),
            ]);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setAttachHighlight:
        (range) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(attachHighlightKey, { type: "set", range }));
          return true;
        },
      clearAttachHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(attachHighlightKey, { type: "clear" }));
          return true;
        },
    };
  },
});
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @guides/web exec vitest run src/lib/tiptap/attachHighlight.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @guides/web exec tsc --noEmit`
Expected: clean (the `declare module` augmentation makes the two commands type-check on `editor.commands`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tiptap/attachHighlight.ts apps/web/src/lib/tiptap/attachHighlight.test.ts
git commit -m "feat(web): attach-target highlight extension + reducer"
```

---

### Task 2: Wire into the editor + style

**Files:**
- Modify: `apps/web/src/components/GuideEditor.tsx`
- Modify: `apps/web/src/app/globals.css`

UI wiring — verified by `next build` + manual (project editor-UI posture). No new vitest.

- [ ] **Step 1: Register the extension and set/clear the highlight in `GuideEditor.tsx`**

Current relevant content of `apps/web/src/components/GuideEditor.tsx`:
- imports `PlaceRef`, `EventRef`, `ReviewBlock` from `../lib/tiptap/...`;
- `extensions: [StarterKit, PlaceRef, EventRef, ReviewBlock]`;
- toolbar buttons: `onClick={() => setPopup("place")} disabled={editor.state.selection.empty}` (and `"event"`);
- `addPlace`/`addEvent` end with `editor.chain().focus().setMark(...).run(); setPopup("none");`;
- popups rendered with `onCancel={() => setPopup("none")}`.

Make these edits:

(a) Add the import:
```tsx
import { AttachHighlight } from "../lib/tiptap/attachHighlight";
```

(b) Register it:
```tsx
    extensions: [StarterKit, PlaceRef, EventRef, ReviewBlock, AttachHighlight],
```

(c) Add a helper above the `return` (after `addReview`) that opens a popup while highlighting the current selection, and one that closes any popup while clearing the highlight:
```tsx
  const openWithHighlight = (which: "place" | "event") => {
    const { from, to } = editor.state.selection;
    editor.commands.setAttachHighlight({ from, to });
    setPopup(which);
  };
  const closePopup = () => {
    editor.commands.clearAttachHighlight();
    setPopup("none");
  };
```

(d) Clear the highlight after applying each mark. In `addPlace`, change the tail
`editor.chain().focus().setMark("placeRef", { refId, intent: "card" }).run(); setPopup("none");`
to:
```tsx
    editor.chain().focus().setMark("placeRef", { refId, intent: "card" }).run();
    editor.commands.clearAttachHighlight();
    setPopup("none");
```
and likewise in `addEvent` for `"eventRef"`.

(e) Change the place/event toolbar buttons to use `openWithHighlight`:
```tsx
        <button onClick={() => openWithHighlight("place")} disabled={editor.state.selection.empty}>Add place</button>
        <button onClick={() => openWithHighlight("event")} disabled={editor.state.selection.empty}>Add event</button>
```

(f) Change the place and event popups' `onCancel` to `closePopup`:
```tsx
      {popup === "place" && <CreatePlacePopup onSubmit={addPlace} onCancel={closePopup} />}
      {popup === "event" && <CreateEventPopup onSubmit={addEvent} onCancel={closePopup} />}
```

Leave the review button and `addReview` and the review popup unchanged (the review block has no attached span — out of scope).

- [ ] **Step 2: Add the style to `apps/web/src/app/globals.css`** (append):

```css
/* Pending attachment target: the selected span while the place/event popup is open. */
.attach-target {
  background: #fff3cd;
  box-shadow: inset 0 -0.15em 0 #ffe08a;
  border-radius: 0.15em;
}
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @guides/web exec tsc --noEmit` → clean.
Run: `pnpm --filter @guides/web build` → success.
Run: `pnpm --filter @guides/web test` → all pass (existing + the new reducer test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/GuideEditor.tsx apps/web/src/app/globals.css
git commit -m "feat(web): highlight the attach target while place/event popup is open"
```

---

### Final verification

- [ ] Full web gate: `pnpm --filter @guides/web test && pnpm --filter @guides/web exec tsc --noEmit && pnpm --filter @guides/web build` — all green.
- [ ] Manual: in `/compose`, select some text, click **Add place** — the selected span stays highlighted (pale amber) while the popup is open; on submit it becomes a chip; on cancel the highlight clears and the text is unmarked. Repeat for **Add event**. Confirm **Add review** is unchanged.

## Notes for the implementer

- `@tiptap/pm/state` and `@tiptap/pm/view` are provided by the `@tiptap/pm` dependency (already installed); import `Plugin`/`PluginKey` from state and `Decoration`/`DecorationSet` from view.
- The `declare module "@tiptap/core"` block is required so `editor.commands.setAttachHighlight(...)` / `clearAttachHighlight()` typecheck. If TS still complains about the command types at the call sites, ensure the augmentation is in the same module that's imported by `GuideEditor` (it is — `attachHighlight.ts`).
- DRY/YAGNI: don't add enable/disable options, configurable colors, or highlight for the review flow.

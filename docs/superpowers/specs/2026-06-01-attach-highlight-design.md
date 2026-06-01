# Attach-target highlight — design

Status: approved (brainstorm), 2026-06-01.

## Problem

In the editor, "Add place"/"Add event" apply an inline mark (a chip) to the
**selected text**. The buttons are disabled until there's a non-empty
selection; clicking one opens a popup (`CreatePlacePopup`/`CreateEventPopup`).
While that popup is open, focus moves to its inputs and the browser's native
selection highlight disappears — so it is **not obvious which span the chip
will attach to**. The selection itself is preserved in `editor.state.selection`
(the mark is applied to it on submit); only the *visual* cue is lost.

## Goal

Keep the attachment target visibly highlighted in the editor for the whole time
the place/event popup is open, regardless of editor focus.

Decision (from brainstorm): a **persistent in-editor highlight** — not a popup
echo and not name-prefill. Those were considered and declined to keep the cue
"in the text."

## Approach

A ProseMirror **decoration** is the right primitive: decorations render
independent of selection/focus and survive the editor losing focus to the
popup (unlike the native `::selection`, which the browser hides on blur).

### §1 Extension — `apps/web/src/lib/tiptap/attachHighlight.ts`

A Tiptap `Extension` wrapping a ProseMirror plugin:

- **Plugin state:** an optional range `{ from: number; to: number } | null`.
- **`apply(tr, value)`:** read a meta flag on the transaction:
  - set → store the new range;
  - clear → `null`;
  - otherwise → if a range is stored, map it through `tr.mapping` (so edits
    keep it correct) and return the mapped range.
- **`props.decorations(state):`** when the stored range is non-null and
  non-empty, return a `DecorationSet` with one `Decoration.inline(from, to,
  { class: "attach-target" })`; else empty.
- **Commands:** `setAttachHighlight({ from, to })` and `clearAttachHighlight()`,
  each dispatching a transaction carrying the corresponding meta.

The transition logic (set / clear / map-through-edit) is extracted as a **pure
reducer** so it can be unit-tested without a DOM:

```
type Range = { from: number; to: number } | null;
type Action =
  | { type: "set"; range: { from: number; to: number } }
  | { type: "clear" }
  | { type: "map"; map: (pos: number) => number };
function attachHighlightApply(value: Range, action: Action): Range
```

`set` → `action.range`; `clear` → `null`; `map` → if a range is stored, return
`{ from: action.map(from), to: action.map(to) }`, else `null`. The plugin's real
`apply(tr, value)` reads the transaction meta to build the `Action` (using
`(pos) => tr.mapping.map(pos)` for the `map` case) and delegates to the reducer.

### §2 Wiring — `apps/web/src/components/GuideEditor.tsx`

- Register `AttachHighlight` in the editor `extensions`.
- The "Add place"/"Add event" handlers capture the current selection and set the
  highlight as they open the popup:
  `const { from, to } = editor.state.selection; editor.commands.setAttachHighlight({ from, to }); setPopup("place" /* or "event" */);`
- Clear on every popup exit:
  - submit: after the existing `setMark(...)`, call `clearAttachHighlight()`;
  - cancel: `clearAttachHighlight()` alongside `setPopup("none")`.
- **Scope: place + event only.** "Add review" inserts a block at the cursor (no
  attached text span), so it neither sets nor needs the highlight.

### §3 Styling — `apps/web/src/app/globals.css`

A `.attach-target` rule: a soft amber background (e.g. `background: #fff3cd`)
distinct from the blue/pink chip colors, so "pending attachment" reads
differently from an existing chip. No layout impact (background only).

### §4 Testing

- **Unit (vitest, node):** test the pure reducer `attachHighlightApply`:
  set → range stored; clear → `null`; a map action shifts a stored range by the
  mapping (e.g. text inserted before it); a no-op action leaves it unchanged.
- **UI:** the decoration rendering + popup wiring are verified by `next build`
  + manual (consistent with the project's editor-UI posture — React/ProseMirror
  view behavior isn't unit-tested here).

## Out of scope

- Popup echo of the selected text / name prefill (declined in brainstorm).
- Any highlight for the review block (it has no attached span).
- Changing how marks are applied or how chips render.

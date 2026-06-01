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

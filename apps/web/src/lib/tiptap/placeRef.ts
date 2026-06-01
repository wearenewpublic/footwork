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
    return ["span", mergeAttributes(HTMLAttributes, { "data-place-ref": "", class: "chip chip-place" }), 0];
  },
});

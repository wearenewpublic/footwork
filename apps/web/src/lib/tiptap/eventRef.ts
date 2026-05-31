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

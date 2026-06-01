import { Node, mergeAttributes } from "@tiptap/core";

/** A block-level node standing in for a venueReview; resolved to a strongRef at publish. */
export const ReviewBlock = Node.create({
  name: "reviewBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      refId: { default: null },
      placeName: { default: "" },
      rating: { default: 0 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-review-block]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const rating = Number(node.attrs.rating) || 0;
    const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-review-block": "", class: "review-card review-card-editor" }),
      `${stars}  ${node.attrs.placeName || "Review"}`,
    ];
  },
});

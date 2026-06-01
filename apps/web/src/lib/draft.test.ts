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
    const draft = buildDraft(doc, "Title", "list", { "place-1": { name: "Tartine" } }, {}, {});
    expect(draft.title).toBe("Title");
    expect(draft.type).toBe("list");
    expect(draft.places["place-1"].name).toBe("Tartine");
    expect(draft.doc).toBe(doc);
  });

  it("throws when a referenced refId has no payload", () => {
    expect(() => buildDraft(doc, "Title", "list", {}, {}, {})).toThrow(/place-1/);
  });

  it("throws on an empty title", () => {
    expect(() => buildDraft(doc, "  ", "list", { "place-1": { name: "Tartine" } }, {}, {})).toThrow(/title/i);
  });

  it("includes reviews and accepts a doc whose reviewBlock refId has a payload", () => {
    const reviewDoc: PMDoc = { type: "doc", content: [
      { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's", rating: 4 } },
    ] };
    const reviews = { "review-1": { place: { name: "Joe's" }, text: "Good", rating: 4, vibes: ["cozy"] } };
    const draft = buildDraft(reviewDoc, "T", "list", {}, {}, reviews);
    expect(draft.reviews).toBe(reviews);
  });

  it("rejects a reviewBlock refId with no review payload", () => {
    const reviewDoc: PMDoc = { type: "doc", content: [
      { type: "reviewBlock", attrs: { refId: "review-9", placeName: "X", rating: 3 } },
    ] };
    expect(() => buildDraft(reviewDoc, "T", "list", {}, {}, {})).toThrow(/review-9/);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import { ensureInit, tiptapToDocument, documentWire, documentFromWire } from "./rt";
import { ids } from "@guides/lexicons";
import type { PMDoc } from "./doc";

const place = { uri: "at://did:plc:a/town.roundabout.guide.place/p1", cid: "bafyplace" };
const PLACE = ids.TownRoundaboutGuideFacet + "#place";

beforeAll(async () => {
  await ensureInit();
});

// Render through the full store→reload→HIR path the viewer uses.
function hirOf(doc: Awaited<ReturnType<typeof tiptapToDocument>>) {
  return documentFromWire(documentWire(doc)).toHIR() as any[];
}
const blocks = (hir: any[]) => hir.filter((n) => n.type === "block");
const blockText = (b: any): string => (b.children ?? []).map((c: any) => c.content ?? "").join("");
const markKinds = (b: any): string[] => (b.children ?? []).flatMap((c: any) => (c.marks ?? []).map((m: any) => m.kind));

const review = { uri: "at://did:plc:a/town.roundabout.guide.venueReview/v1", cid: "bafyreview" };
const REVIEW = ids.TownRoundaboutGuideFacet + "#review";

describe("review blocks", () => {
  it("emits a review block carrying the venueReview ref in attrs", async () => {
    const json: PMDoc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Best spots:" }] },
      { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's Cafe", rating: 4 } },
    ] };
    const hir = hirOf(await tiptapToDocument(json, { "review-1": review }));
    const bs = blocks(hir);
    const reviewNode = bs.find((b: any) => b.name === "review");
    expect(reviewNode).toBeDefined();
    expect(reviewNode.attrs).toMatchObject({ ref: review, intent: "card" });
    const para = bs.find((b: any) => b.name === "paragraph");
    expect((para.children ?? []).map((c: any) => c.content).join("")).toBe("Best spots:");
  });
});

describe("tiptapToDocument → HIR", () => {
  it("renders prose into a paragraph block with a place mark on the right span", async () => {
    const json: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "Go to " },
      { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
    ] }] };
    const hir = hirOf(await tiptapToDocument(json, { t1: place }));
    const bs = blocks(hir);
    expect(bs.length).toBe(1);
    expect(blockText(bs[0])).toBe("Go to Tartine"); // prose present, no leading marker
    expect(markKinds(bs[0])).toContain(PLACE);
    // the place mark sits on the "Tartine" span and carries the ref
    const placeChild = bs[0].children.find((c: any) => (c.marks ?? []).some((m: any) => m.kind === PLACE));
    expect(placeChild.content).toBe("Tartine");
    expect(placeChild.marks.find((m: any) => m.kind === PLACE).attrs).toMatchObject({ ref: place, intent: "card" });
  });

  it("handles multibyte prose (emoji) without corrupting the text", async () => {
    const json: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "👋 " },
      { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
    ] }] };
    const hir = hirOf(await tiptapToDocument(json, { t1: place }));
    expect(blockText(blocks(hir)[0])).toBe("👋 Tartine");
    expect(markKinds(blocks(hir)[0])).toContain(PLACE);
  });

  it("two paragraphs; bold maps to a hub mark; unresolved refIds drop the entity but keep text", async () => {
    const json: PMDoc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "placeRef", attrs: { refId: "missing" } }] }] },
    ] };
    const hir = hirOf(await tiptapToDocument(json, {}));
    const bs = blocks(hir);
    expect(bs.length).toBe(2);
    expect(blockText(bs[0])).toBe("hi");
    expect(markKinds(bs[0])).toContain("org.relationaltext.facet#bold");
    expect(blockText(bs[1])).toBe("x"); // text kept
    expect(markKinds(bs[1])).not.toContain(PLACE); // unresolved entity dropped
  });
});

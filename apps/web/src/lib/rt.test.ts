import { describe, it, expect, beforeAll } from "vitest";
import { ensureInit, tiptapToDocument, documentWire } from "./rt";
import { ids } from "@guides/lexicons";
import type { PMDoc } from "./doc";

const place = { uri: "at://did:plc:a/town.roundabout.guide.place/p1", cid: "bafyplace" };
const PLACE = ids.TownRoundaboutGuideFacet + "#place";

beforeAll(async () => { await ensureInit(); });

describe("tiptapToDocument", () => {
  it("emits a place entity facet over the correct UTF-8 byte range", async () => {
    const json: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "Go to " },
      { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
    ] }] };
    const { text, facets } = documentWire(await tiptapToDocument(json, { t1: place }));
    expect(text).toBe("Go to Tartine");
    const placeFacet = (facets as any[]).find((f) => f.features.some((x: any) => x.$type === PLACE));
    expect(placeFacet.index).toEqual({ byteStart: 6, byteEnd: 13 });
    const feat = (facets as any[]).flatMap((f) => f.features).find((f: any) => f.$type === PLACE);
    expect(feat).toMatchObject({ ref: place, intent: "card" });
  });

  it("multibyte: byte offsets account for emoji", async () => {
    const json: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "👋 " },
      { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
    ] }] };
    const { facets } = documentWire(await tiptapToDocument(json, { t1: place }));
    const f = (facets as any[]).find((x) => x.features.some((y: any) => y.$type === PLACE));
    expect(f.index).toEqual({ byteStart: 5, byteEnd: 12 });
  });

  it("bold maps to a hub mark; unresolved refIds drop the entity but keep text", async () => {
    const json: PMDoc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "placeRef", attrs: { refId: "missing" } }] }] },
    ] };
    const { text, facets } = documentWire(await tiptapToDocument(json, {}));
    expect(text).toBe("hi\n\nx");
    expect((facets as any[]).flatMap((f) => f.features).some((f: any) => f.name === "bold")).toBe(true);
    expect((facets as any[]).flatMap((f) => f.features).some((f: any) => f.$type === PLACE)).toBe(false);
  });
});

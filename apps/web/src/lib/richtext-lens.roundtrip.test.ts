import { describe, it, expect } from "vitest";
import { docToStorage, storageToDoc, refMapFromDoc } from "./richtext-lens";
import { ids, type FacetLike as Facet } from "@guides/lexicons";

const placeRef = { uri: "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" };

describe("richtext lens round-trip (GetPut at the storage level)", () => {
  it("storage -> doc -> storage is identity for text + placeRef + format", () => {
    const storage = {
      text: "Go to Tartine now\n\nIt is great.",
      facets: [
        {
          index: { byteStart: 6, byteEnd: 13 },
          features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" }],
        },
        {
          index: { byteStart: 24, byteEnd: 29 },
          features: [{ $type: ids.TownRoundaboutGuideDocument + "#format", kind: "bold" }],
        },
      ] as Facet[],
    };
    const doc = storageToDoc(storage);
    const back = docToStorage(doc, refMapFromDoc(doc));
    expect(back.text).toBe(storage.text);
    expect(back.facets).toEqual(storage.facets);
  });

  it("preserves multibyte byte offsets through the round-trip", () => {
    const storage = {
      text: "👋 Tartine",
      facets: [
        { index: { byteStart: 5, byteEnd: 12 }, features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" }] },
      ] as Facet[],
    };
    const doc = storageToDoc(storage);
    const back = docToStorage(doc, refMapFromDoc(doc));
    expect(back.facets[0].index).toEqual({ byteStart: 5, byteEnd: 12 });
  });
});

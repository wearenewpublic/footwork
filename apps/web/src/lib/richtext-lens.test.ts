import { describe, it, expect } from "vitest";
import { docToStorage } from "./richtext-lens";
import type { PMDoc } from "./doc";
import { ids } from "@guides/lexicons";

const placeRef = { uri: "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" };

describe("docToStorage", () => {
  it("emits a placeRef facet over the correct UTF-8 byte range", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Go to " },
            { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
            { type: "text", text: " now" },
          ],
        },
      ],
    };
    const { text, facets } = docToStorage(doc, { t1: placeRef });
    expect(text).toBe("Go to Tartine now");
    expect(facets).toEqual([
      {
        index: { byteStart: 6, byteEnd: 13 },
        features: [
          { $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: placeRef, intent: "card" },
        ],
      },
    ]);
  });

  it("computes byte offsets correctly across multibyte text", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "👋 " },
            { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "t1", intent: "card" } }] },
          ],
        },
      ],
    };
    const { facets } = docToStorage(doc, { t1: placeRef });
    expect(facets[0].index).toEqual({ byteStart: 5, byteEnd: 12 }); // 👋=4 + space=1
  });

  it("maps bold/italic to format features", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] }],
    };
    const { facets } = docToStorage(doc, {});
    expect(facets[0].features).toEqual([{ $type: ids.TownRoundaboutGuideDocument + "#format", kind: "bold" }]);
  });

  it("omits a place facet whose refId is missing from the map (drops the ref, keeps the text)", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "placeRef", attrs: { refId: "missing", intent: "card" } }] }] }],
    };
    const { text, facets } = docToStorage(doc, {});
    expect(text).toBe("x");
    expect(facets).toEqual([]);
  });
});

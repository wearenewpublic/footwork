import { describe, it, expect } from "vitest";
import { byteSliceFromChars, facetSegments, strongRef } from "./facets";
import type { FacetLike } from "./facets";

describe("facet helpers", () => {
  it("computes byte offsets that differ from char offsets for multibyte text", () => {
    // "👋" is 2 UTF-16 code units but 4 UTF-8 bytes.
    const text = "👋 Tartine";
    const slice = byteSliceFromChars(text, text.indexOf("Tartine"), text.length);
    expect(slice).toEqual({ byteStart: 5, byteEnd: 12 }); // 4 (wave) + 1 (space) = 5
  });

  it("segments text into ordered plain and faceted runs", () => {
    const text = "Go to Tartine now";
    const place = {
      $type: "town.roundabout.guide.document#placeRef",
      ref: { uri: "at://x/y/z", cid: "bafytest" },
      intent: "card",
    };
    const facets: FacetLike[] = [
      { index: byteSliceFromChars(text, 6, 13), features: [place] },
    ];
    const segs = [...facetSegments(text, facets)];
    expect(segs.map((s) => s.text)).toEqual(["Go to ", "Tartine", " now"]);
    expect(segs[0].features).toEqual([]);
    expect(segs[1].features).toEqual([place]);
    expect(segs[2].features).toEqual([]);
  });

  it("builds a strongRef", () => {
    expect(strongRef("at://x/y/z", "bafytest")).toEqual({
      uri: "at://x/y/z",
      cid: "bafytest",
    });
  });
});

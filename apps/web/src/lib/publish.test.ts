import { describe, it, expect, vi } from "vitest";
import { publishGuide, type Draft } from "./publish";
import { ids } from "@guides/lexicons";
import type { PMDoc } from "./doc";

function draftWithPlace(): Draft {
  const doc: PMDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Go to " },
          { type: "text", text: "Tartine", marks: [{ type: "placeRef", attrs: { refId: "place-1", intent: "card" } }] },
        ],
      },
    ],
  };
  return {
    title: "Mission morning",
    type: "list",
    doc,
    places: { "place-1": { name: "Tartine", location: { $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42" } } },
    events: {},
  };
}

describe("publishGuide", () => {
  it("creates the place record, then the document referencing it, and returns the doc uri", async () => {
    const createRecord = vi
      .fn()
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyplace" })
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1", cid: "bafydoc" });

    const result = await publishGuide("did:plc:me", createRecord, draftWithPlace());

    expect(result).toBe("at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1");
    expect(createRecord.mock.calls[0][0]).toBe(ids.TownRoundaboutGuidePlace);
    expect(createRecord.mock.calls[0][1].name).toBe("Tartine");
    const docCall = createRecord.mock.calls[1];
    expect(docCall[0]).toBe(ids.TownRoundaboutGuideDocument);
    const docRecord = docCall[1];
    expect(docRecord.text).toBe("Go to Tartine");
    expect(docRecord.facets[0].features[0].ref).toEqual({
      uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1",
      cid: "bafyplace",
    });
    expect(docRecord.$type).toBe(ids.TownRoundaboutGuideDocument);
    expect(typeof docRecord.createdAt).toBe("string");
  });

  it("rejects a draft whose document violates the lexicon (title too long)", async () => {
    const createRecord = vi.fn().mockResolvedValue({ uri: "at://x/y/z", cid: "c" });
    const bad = draftWithPlace();
    bad.title = "x".repeat(1201); // exceeds title maxLength (1200) / maxGraphemes (300)
    await expect(publishGuide("did:plc:me", createRecord, bad)).rejects.toThrow();
  });
});

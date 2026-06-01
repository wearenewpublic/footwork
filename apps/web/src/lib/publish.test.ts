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
    reviews: {},
  };
}

describe("publishGuide", () => {
  it("creates the place record, then the document referencing it, and returns the doc uri", async () => {
    const createRecord = vi
      .fn()
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1", cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a" })
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1", cid: "bafydoc" });

    const result = await publishGuide("did:plc:me", createRecord, draftWithPlace());

    expect(result).toBe("at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1");
    expect(createRecord.mock.calls[0][0]).toBe(ids.TownRoundaboutGuidePlace);
    expect(createRecord.mock.calls[0][1].name).toBe("Tartine");
    const docCall = createRecord.mock.calls[1];
    expect(docCall[0]).toBe(ids.TownRoundaboutGuideDocument);
    const docRecord = docCall[1];
    expect(docRecord.text).toContain("Go to Tartine"); // text carries a leading block marker
    const PLACE = ids.TownRoundaboutGuideFacet + "#place";
    const placeFeat = (docRecord.facets as any[])
      .flatMap((f: any) => f.features)
      .find((feat: any) => feat.$type === PLACE);
    expect(placeFeat?.ref).toEqual({
      uri: "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/p1",
      cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a",
    });
    expect(docRecord.$type).toBe(ids.TownRoundaboutGuideDocument);
    expect(typeof docRecord.createdAt).toBe("string");
  });

  it("creates a review's place then venueReview, points the ref at the venueReview, then the doc", async () => {
    const placeUri = "at://did:plc:me/" + ids.TownRoundaboutGuidePlace + "/rp1";
    const reviewUri = "at://did:plc:me/" + ids.TownRoundaboutGuideVenueReview + "/rv1";
    const createRecord = vi
      .fn()
      .mockResolvedValueOnce({ uri: placeUri, cid: "bafyrplace" })
      .mockResolvedValueOnce({ uri: reviewUri, cid: "bafyrreview" })
      .mockResolvedValueOnce({ uri: "at://did:plc:me/" + ids.TownRoundaboutGuideDocument + "/g1", cid: "bafydoc" });

    const doc: PMDoc = { type: "doc", content: [
      { type: "reviewBlock", attrs: { refId: "review-1", placeName: "Joe's", rating: 4 } },
    ] };
    const draft: Draft = {
      title: "Cafes", type: "list", doc, places: {}, events: {},
      reviews: { "review-1": { place: { name: "Joe's" }, text: "Great", rating: 4, vibes: ["cozy"] } },
    };

    await publishGuide("did:plc:me", createRecord, draft);

    expect(createRecord.mock.calls[0][0]).toBe(ids.TownRoundaboutGuidePlace);
    expect(createRecord.mock.calls[0][1].name).toBe("Joe's");
    expect(createRecord.mock.calls[1][0]).toBe(ids.TownRoundaboutGuideVenueReview);
    const reviewRec = createRecord.mock.calls[1][1];
    expect(reviewRec.place).toEqual({ uri: placeUri, cid: "bafyrplace" });
    expect(reviewRec.rating).toBe(4);
    expect(reviewRec.vibes).toEqual(["cozy"]);
    const docRec = createRecord.mock.calls[2][1];
    const REVIEW = ids.TownRoundaboutGuideFacet + "#review";
    const feat = (docRec.facets as any[]).flatMap((f) => f.features).find((x) => x.$type === REVIEW);
    expect(feat.attrs.ref).toEqual({ uri: reviewUri, cid: "bafyrreview" });
  });

  it("rejects a draft whose document violates the lexicon (title too long)", async () => {
    const createRecord = vi.fn().mockResolvedValue({ uri: "at://x/y/z", cid: "c" });
    const bad = draftWithPlace();
    bad.title = "x".repeat(1201); // exceeds title maxLength (1200) / maxGraphemes (300)
    await expect(publishGuide("did:plc:me", createRecord, bad)).rejects.toThrow();
  });
});

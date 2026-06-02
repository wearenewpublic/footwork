import { describe, it, expect } from "vitest";
import { ids, lexicons } from "./lexicon/lexicons";
import { validateRecord } from "./lexicon/types/town/roundabout/guide/document";

describe("generated lexicon validation", () => {
  it("exposes the ids map and a populated Lexicons instance", () => {
    expect(ids.TownRoundaboutGuideDocument).toBe("town.roundabout.guide.document");
    expect(ids.TownRoundaboutGuideFacet).toBe("town.roundabout.guide.facet");
    expect(ids.ComAtprotoRepoStrongRef).toBe("com.atproto.repo.strongRef");
    expect(() => lexicons.getDefOrThrow("community.lexicon.location.geo")).not.toThrow();
  });

  it("accepts a well-formed guide document with a place facet feature", () => {
    const record = {
      $type: "town.roundabout.guide.document",
      title: "A morning in the Mission",
      type: "list",
      text: "Start at Tartine, then walk to Dolores Park.",
      facets: [
        {
          index: { byteStart: 9, byteEnd: 16 },
          features: [
            {
              $type: "town.roundabout.guide.facet#place",
              ref: {
                uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/town.roundabout.guide.place/3jzfcijpj2z2a",
                cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a",
              },
              intent: "card",
            },
          ],
        },
      ],
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    const result = validateRecord(record);
    expect(result.success).toBe(true);
  });

  it("rejects a guide document missing required title", () => {
    const bad = {
      $type: "town.roundabout.guide.document",
      text: "no title here",
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    const result = validateRecord(bad);
    expect(result.success).toBe(false);
  });
});

describe("venueReview", () => {
  const base = {
    $type: ids.TownRoundaboutGuideVenueReview,
    place: { uri: "at://did:plc:a/town.roundabout.guide.place/p1", cid: "bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a" },
    text: "Great espresso, cozy corner spot.",
    rating: 4,
    vibes: ["cozy", "good for groups"],
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  it("accepts a valid venueReview with vibes", () => {
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, base)).not.toThrow();
  });

  it("rejects a rating outside 1–5", () => {
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, rating: 6 })).toThrow();
  });

  it("rejects more than 8 vibes", () => {
    expect(() =>
      lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, vibes: Array(9).fill("x") }),
    ).toThrow();
  });

  it("rejects an empty-string vibe tag", () => {
    expect(() =>
      lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, vibes: [""] }),
    ).toThrow();
  });

  it("rejects a vibe tag exceeding 256 characters", () => {
    expect(() =>
      lexicons.assertValidRecord(ids.TownRoundaboutGuideVenueReview, { ...base, vibes: ["x".repeat(257)] }),
    ).toThrow();
  });
});

describe("place location array", () => {
  const geo = { $type: ids.CommunityLexiconLocationGeo, latitude: "37.76", longitude: "-122.42", name: "Tartine" };
  const addr = { $type: ids.CommunityLexiconLocationAddress, country: "US", region: "CA", locality: "San Francisco", street: "600 Guerrero St", postalCode: "94110", name: "Tartine" };
  const fsq = { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: "abc123", latitude: "37.76", longitude: "-122.42", name: "Tartine" };

  it("accepts a place with multiple location encodings", () => {
    const rec = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", location: [geo, addr, fsq], createdAt: "2026-06-02T00:00:00.000Z" };
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuidePlace, rec)).not.toThrow();
  });

  it("accepts a place with no location", () => {
    const rec = { $type: ids.TownRoundaboutGuidePlace, name: "Somewhere", createdAt: "2026-06-02T00:00:00.000Z" };
    expect(() => lexicons.assertValidRecord(ids.TownRoundaboutGuidePlace, rec)).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { hydrateGuide, refsFromDocument } from "./hydrate";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";
import type { DocumentRow } from "./db";

const placeValue = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", createdAt: "2026-01-01T00:00:00Z" };
const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

function docWithPlaceRef(placeCid: string): DocumentRow {
  return {
    uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1",
    cid: "bafydoc",
    did: "did:plc:a",
    rkey: "1",
    record: {
      $type: ids.TownRoundaboutGuideDocument,
      title: "Mission morning",
      text: "Start at Tartine.",
      createdAt: "2026-01-01T00:00:00Z",
      facets: [
        {
          index: { byteStart: 9, byteEnd: 16 },
          features: [
            { $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: { uri: placeUri, cid: placeCid }, intent: "card" },
          ],
        },
      ],
    },
  };
}

describe("hydration", () => {
  it("extracts referenced uris+cids from facets", async () => {
    const cid = await cidForRecord(placeValue);
    const refs = refsFromDocument(docWithPlaceRef(cid).record);
    expect(refs).toEqual([{ uri: placeUri, expectedCid: cid }]);
  });

  it("resolves a ref, verifies its CID, and caches it", async () => {
    const db = openDb(":memory:");
    const cid = await cidForRecord(placeValue);
    const fetchRecord = async (uri: string) =>
      uri === placeUri ? { cid, value: placeValue } : null;

    const view = await hydrateGuide(db, docWithPlaceRef(cid), fetchRecord, {
      did: "did:plc:a",
      handle: "alice.test",
      pds: "https://pds.example",
    });

    expect(view.references[placeUri].verified).toBe(true);
    expect(view.references[placeUri].value).toEqual(placeValue);
    expect(view.author.handle).toBe("alice.test");
    expect(db.getCachedRecord(placeUri)?.record).toEqual(placeValue);
  });

  it("marks a ref unverified when the CID does not match", async () => {
    const db = openDb(":memory:");
    const correctCid = await cidForRecord(placeValue);
    const fetchRecord = async () => ({ cid: correctCid, value: placeValue });
    const view = await hydrateGuide(db, docWithPlaceRef("bafywrongcid"), fetchRecord, {
      did: "did:plc:a",
      handle: null,
      pds: null,
    });
    expect(view.references[placeUri].verified).toBe(false);
    expect(db.getCachedRecord(placeUri)).toBeNull();
  });

  it("serves a cached ref without refetching", async () => {
    const db = openDb(":memory:");
    const cid = await cidForRecord(placeValue);
    db.putCachedRecord({ uri: placeUri, cid, record: placeValue });
    let calls = 0;
    const fetchRecord = async () => {
      calls++;
      return { cid, value: placeValue };
    };
    const view = await hydrateGuide(db, docWithPlaceRef(cid), fetchRecord, { did: "did:plc:a", handle: null, pds: null });
    expect(view.references[placeUri].verified).toBe(true);
    expect(calls).toBe(0);
  });

  it("resolves a review block two hops: facet -> venueReview -> place", async () => {
    const db = openDb(":memory:");
    const rPlaceValue = { $type: ids.TownRoundaboutGuidePlace, name: "Joe's", createdAt: "2026-01-01T00:00:00Z" };
    const rPlaceUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/rp1";
    const rPlaceCid = await cidForRecord(rPlaceValue);
    const reviewValue = {
      $type: ids.TownRoundaboutGuideVenueReview,
      place: { uri: rPlaceUri, cid: rPlaceCid },
      text: "Great espresso", rating: 4, vibes: ["cozy"],
      createdAt: "2026-01-01T00:00:00Z",
    };
    const reviewUri = "at://did:plc:a/" + ids.TownRoundaboutGuideVenueReview + "/rv1";
    const reviewCid = await cidForRecord(reviewValue);

    const doc: DocumentRow = {
      uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/2",
      cid: "bafydoc", did: "did:plc:a", rkey: "2",
      record: {
        $type: ids.TownRoundaboutGuideDocument, title: "Cafes", text: "￼",
        createdAt: "2026-01-01T00:00:00Z",
        facets: [{ index: { byteStart: 0, byteEnd: 3 }, features: [
          { $type: ids.TownRoundaboutGuideFacet + "#review", name: "review", parents: [], attrs: { ref: { uri: reviewUri, cid: reviewCid }, intent: "card" } },
        ] }],
      },
    };

    const fetchRecord = async (uri: string) =>
      uri === reviewUri ? { cid: reviewCid, value: reviewValue }
      : uri === rPlaceUri ? { cid: rPlaceCid, value: rPlaceValue }
      : null;

    const view = await hydrateGuide(db, doc, fetchRecord, { did: "did:plc:a", handle: null, pds: null });

    expect(view.references[reviewUri].verified).toBe(true);
    expect(view.references[reviewUri].value).toEqual(reviewValue);
    expect(view.references[rPlaceUri].verified).toBe(true);
    expect((view.references[rPlaceUri].value as any).name).toBe("Joe's");
  });
});

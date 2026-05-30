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
});

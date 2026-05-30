import { describe, it, expect, vi } from "vitest";
import { openDb } from "./db";
import { makePdsFetcher } from "./fetcher";
import { ids } from "@guides/lexicons";

const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

describe("makePdsFetcher", () => {
  it("resolves the pds, calls getRecord, and returns {cid,value}", async () => {
    const db = openDb(":memory:");
    db.putActor({ did: "did:plc:a", handle: "alice.test", pds: "https://pds.example" });

    const httpGet = vi.fn().mockResolvedValue({
      uri: placeUri,
      cid: "bafyplace",
      value: { $type: ids.TownRoundaboutGuidePlace, name: "Tartine" },
    });
    const fetcher = makePdsFetcher(db, httpGet);
    const got = await fetcher(placeUri);

    expect(got).toEqual({ cid: "bafyplace", value: { $type: ids.TownRoundaboutGuidePlace, name: "Tartine" } });
    expect(httpGet).toHaveBeenCalledWith(
      "https://pds.example",
      "did:plc:a",
      ids.TownRoundaboutGuidePlace,
      "p1",
    );
  });

  it("returns null when the pds cannot be resolved", async () => {
    const db = openDb(":memory:");
    db.putActor({ did: "did:plc:a", handle: null, pds: null });
    const httpGet = vi.fn();
    const fetcher = makePdsFetcher(db, httpGet);
    expect(await fetcher(placeUri)).toBeNull();
    expect(httpGet).not.toHaveBeenCalled();
  });
});

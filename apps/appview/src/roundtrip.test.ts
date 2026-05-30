import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { applyEvent } from "./ingest";
import { createApi } from "./api";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";
import type { CommitEvent } from "./types";

describe("round-trip: ingest -> store -> hydrate -> verify -> serve", () => {
  it("indexes a document from a commit event and serves it hydrated", async () => {
    const db = openDb(":memory:");

    // A place that lives in the author's PDS (NOT indexed by us — hydrated on read).
    const placeValue = {
      $type: ids.TownRoundaboutGuidePlace,
      name: "Tartine Bakery",
      createdAt: "2026-05-30T00:00:00.000Z",
    };
    const placeUri = "at://did:plc:author/" + ids.TownRoundaboutGuidePlace + "/p1";
    const placeCid = await cidForRecord(placeValue);

    // The document references the place by strongRef (uri + the place's real cid).
    const docEvent: CommitEvent = {
      did: "did:plc:author",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "g1",
      operation: "create",
      cid: "bafyguide",
      record: {
        $type: ids.TownRoundaboutGuideDocument,
        title: "A morning in the Mission",
        type: "list",
        text: "Start at Tartine, then walk to Dolores Park.",
        createdAt: "2026-05-30T00:00:00.000Z",
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

    // 1. Ingest the commit event (as the Jetstream adapter would).
    applyEvent(db, docEvent);

    // 2. Build the API with an in-test PDS fetcher (stands in for the real PDS).
    const fetchRecord = async (uri: string) =>
      uri === placeUri ? { cid: placeCid, value: placeValue } : null;
    const resolveActorFn = async (did: string) => ({ did, handle: "author.test", pds: "https://pds.example" });
    const api = createApi({ db, fetchRecord, resolveActorFn });

    // 3. Read it back through the public API.
    const res = await api.request("/guide/did:plc:author/g1");
    expect(res.status).toBe(200);
    const body = await res.json();

    // 4. The whole round-trip is intact and the reference is CID-verified.
    expect(body.record.title).toBe("A morning in the Mission");
    expect(body.author.handle).toBe("author.test");
    expect(body.references[placeUri].verified).toBe(true);
    expect(body.references[placeUri].value.name).toBe("Tartine Bakery");

    // 5. The verified reference was cached for next time.
    expect(db.getCachedRecord(placeUri)?.record).toEqual(placeValue);
  });
});

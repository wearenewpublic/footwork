import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { createApi } from "./api";
import { cidForRecord } from "./cid";
import { ids } from "@guides/lexicons";

const placeValue = { $type: ids.TownRoundaboutGuidePlace, name: "Tartine", createdAt: "2026-01-01T00:00:00Z" };
const placeUri = "at://did:plc:a/" + ids.TownRoundaboutGuidePlace + "/p1";

async function seed() {
  const db = openDb(":memory:");
  const placeCid = await cidForRecord(placeValue);
  db.putDocument({
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
        { index: { byteStart: 9, byteEnd: 16 }, features: [{ $type: ids.TownRoundaboutGuideDocument + "#placeRef", ref: { uri: placeUri, cid: placeCid }, intent: "card" }] },
      ],
    },
  });
  return { db, placeCid };
}

function app(db: any, placeCid: string) {
  const fetchRecord = async (uri: string) => (uri === placeUri ? { cid: placeCid, value: placeValue } : null);
  const resolveActorFn = async (did: string) => ({ did, handle: "alice.test", pds: "https://pds.example" });
  return createApi({ db, fetchRecord, resolveActorFn });
}

describe("read API", () => {
  it("GET /guide/:did/:rkey returns a hydrated guide", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guide/did:plc:a/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.record.title).toBe("Mission morning");
    expect(body.references[placeUri].verified).toBe(true);
    expect(body.author.handle).toBe("alice.test");
  });

  it("GET /guide/:did/:rkey returns 404 for unknown guide", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guide/did:plc:a/nope");
    expect(res.status).toBe(404);
  });

  it("GET /guides lists recent guides", async () => {
    const { db, placeCid } = await seed();
    const res = await app(db, placeCid).request("/guides");
    const body = await res.json();
    expect(body.guides.length).toBe(1);
    expect(body.guides[0].uri).toContain(ids.TownRoundaboutGuideDocument);
  });

  it("GET /profile/:did/saves lists a user's saves", async () => {
    const { db, placeCid } = await seed();
    db.putSave({ uri: "at://did:plc:b/s/1", did: "did:plc:b", subjectUri: "at://did:plc:a/c/1", subjectCid: "bafydoc" });
    const res = await app(db, placeCid).request("/profile/did:plc:b/saves");
    const body = await res.json();
    expect(body.saves.length).toBe(1);
  });
});

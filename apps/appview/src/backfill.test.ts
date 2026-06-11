import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { recordsToEvents, backfillRepo, BACKFILL_COLLECTIONS, type RepoRecord } from "./backfill";
import { ids } from "@guides/lexicons";

const did = "did:plc:a";

describe("recordsToEvents", () => {
  it("maps repo records to create CommitEvents (rkey from uri)", () => {
    const recs: RepoRecord[] = [
      {
        uri: `at://${did}/${ids.TownRoundaboutGuideDocument}/g1`,
        cid: "bafyg1",
        value: { $type: ids.TownRoundaboutGuideDocument, title: "G1" },
      },
    ];
    expect(recordsToEvents(did, ids.TownRoundaboutGuideDocument, recs)).toEqual([
      {
        did,
        collection: ids.TownRoundaboutGuideDocument,
        rkey: "g1",
        operation: "create",
        cid: "bafyg1",
        record: { $type: ids.TownRoundaboutGuideDocument, title: "G1" },
      },
    ]);
  });

  it("skips records with an unparseable uri", () => {
    expect(
      recordsToEvents(did, ids.TownRoundaboutGuideDocument, [{ uri: "garbage", cid: "c", value: {} }]),
    ).toEqual([]);
  });
});

describe("backfillRepo", () => {
  it("indexes a repo's guide documents into the db via applyEvent", async () => {
    const db = openDb(":memory:");
    const docs: RepoRecord[] = [
      { uri: `at://${did}/${ids.TownRoundaboutGuideDocument}/g1`, cid: "bafyg1", value: { $type: ids.TownRoundaboutGuideDocument, title: "G1", text: "x", createdAt: "t" } },
      { uri: `at://${did}/${ids.TownRoundaboutGuideDocument}/g2`, cid: "bafyg2", value: { $type: ids.TownRoundaboutGuideDocument, title: "G2", text: "y", createdAt: "t" } },
    ];
    const list = async (c: string): Promise<RepoRecord[]> =>
      c === ids.TownRoundaboutGuideDocument ? docs : [];

    const n = await backfillRepo(db, did, BACKFILL_COLLECTIONS, list);

    expect(n).toBe(2);
    expect(
      db
        .listDocuments(50)
        .map((d) => (d.record as { title?: string }).title)
        .sort(),
    ).toEqual(["G1", "G2"]);
  });
});

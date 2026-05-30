import { describe, it, expect } from "vitest";
import { openDb } from "./db";

function freshDb() {
  return openDb(":memory:");
}

describe("db persistence", () => {
  it("upserts and reads a document", () => {
    const db = openDb(":memory:");
    db.putDocument({
      uri: "at://did:plc:a/town.roundabout.guide.document/1",
      cid: "bafy1",
      did: "did:plc:a",
      rkey: "1",
      record: { title: "Hi" },
    });
    const got = db.getDocument("at://did:plc:a/town.roundabout.guide.document/1");
    expect(got?.record).toEqual({ title: "Hi" });
    expect(got?.did).toBe("did:plc:a");
  });

  it("lists documents newest first and deletes", () => {
    const db = freshDb();
    db.putDocument({ uri: "at://d/c/1", cid: "x1", did: "d", rkey: "1", record: {} });
    db.putDocument({ uri: "at://d/c/2", cid: "x2", did: "d", rkey: "2", record: {} });
    expect(db.listDocuments(10).length).toBe(2);
    db.deleteDocument("at://d/c/1");
    expect(db.listDocuments(10).length).toBe(1);
  });

  it("stores saves and lists them by did", () => {
    const db = freshDb();
    db.putSave({ uri: "at://d/s/1", did: "d", subjectUri: "at://o/c/9", subjectCid: "c9" });
    const saves = db.listSavesByDid("d");
    expect(saves.map((s) => s.subjectUri)).toEqual(["at://o/c/9"]);
  });

  it("caches and reads referenced records", () => {
    const db = freshDb();
    db.putCachedRecord({ uri: "at://o/p/1", cid: "pc", record: { name: "Tartine" } });
    expect(db.getCachedRecord("at://o/p/1")?.record).toEqual({ name: "Tartine" });
  });

  it("round-trips the cursor", () => {
    const db = freshDb();
    expect(db.getCursor()).toBeNull();
    db.setCursor("12345");
    expect(db.getCursor()).toBe("12345");
  });
});

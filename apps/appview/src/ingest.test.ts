import { describe, it, expect } from "vitest";
import { openDb } from "./db";
import { applyEvent } from "./ingest";
import { ids } from "@guides/lexicons";
import type { CommitEvent } from "./types";

const baseDoc: CommitEvent = {
  did: "did:plc:a",
  collection: ids.TownRoundaboutGuideDocument,
  rkey: "1",
  operation: "create",
  cid: "bafydoc",
  record: { $type: ids.TownRoundaboutGuideDocument, title: "T", text: "x", createdAt: "2026-01-01T00:00:00Z" },
};

describe("applyEvent", () => {
  it("indexes a document create", () => {
    const db = openDb(":memory:");
    applyEvent(db, baseDoc);
    expect(db.getDocument("at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1")?.cid).toBe("bafydoc");
  });

  it("removes a document on delete", () => {
    const db = openDb(":memory:");
    applyEvent(db, baseDoc);
    applyEvent(db, { ...baseDoc, operation: "delete", record: undefined, cid: undefined });
    expect(db.listDocuments(10).length).toBe(0);
  });

  it("indexes a save create with subject strongRef", () => {
    const db = openDb(":memory:");
    applyEvent(db, {
      did: "did:plc:b",
      collection: ids.TownRoundaboutGuideSave,
      rkey: "9",
      operation: "create",
      cid: "bafysave",
      record: {
        $type: ids.TownRoundaboutGuideSave,
        subject: { uri: "at://did:plc:a/" + ids.TownRoundaboutGuideDocument + "/1", cid: "bafydoc" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    expect(db.listSavesByDid("did:plc:b")[0].subjectCid).toBe("bafydoc");
  });

  it("ignores unknown collections", () => {
    const db = openDb(":memory:");
    applyEvent(db, { ...baseDoc, collection: "app.bsky.feed.post" });
    expect(db.listDocuments(10).length).toBe(0);
  });
});

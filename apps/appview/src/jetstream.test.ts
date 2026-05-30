import { describe, it, expect } from "vitest";
import { toCommitEvent } from "./jetstream";
import { ids } from "@guides/lexicons";

describe("toCommitEvent", () => {
  it("maps a jetstream create commit to a normalized CommitEvent", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: {
        operation: "create",
        collection: ids.TownRoundaboutGuideDocument,
        rkey: "1",
        cid: "bafy",
        record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
      },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "1",
      operation: "create",
      cid: "bafy",
      record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
    });
  });

  it("maps a delete commit (no record/cid)", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: { operation: "delete", collection: ids.TownRoundaboutGuideSave, rkey: "9" },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideSave,
      rkey: "9",
      operation: "delete",
      cid: undefined,
      record: undefined,
    });
  });

  it("returns null for non-commit events", () => {
    expect(toCommitEvent({ kind: "identity" } as any)).toBeNull();
  });
});

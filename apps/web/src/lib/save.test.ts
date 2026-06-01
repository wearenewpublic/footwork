import { describe, it, expect } from "vitest";
import { buildSaveRecord } from "./save";
import { ids } from "@guides/lexicons";

describe("buildSaveRecord", () => {
  it("builds a save record with a strongRef subject and createdAt", () => {
    const rec = buildSaveRecord({ uri: "at://did/doc/1", cid: "bafydoc" });
    expect(rec.$type).toBe(ids.TownRoundaboutGuideSave);
    expect(rec.subject).toEqual({ uri: "at://did/doc/1", cid: "bafydoc" });
    expect(typeof rec.createdAt).toBe("string");
  });
});

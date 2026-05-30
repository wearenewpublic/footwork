import { describe, it, expect } from "vitest";
import { atUri } from "./types";

describe("atUri", () => {
  it("builds an at:// URI from did, collection, rkey", () => {
    expect(atUri("did:plc:abc", "town.roundabout.guide.document", "3k")).toBe(
      "at://did:plc:abc/town.roundabout.guide.document/3k",
    );
  });
});

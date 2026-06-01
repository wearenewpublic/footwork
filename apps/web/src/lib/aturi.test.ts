import { describe, expect, it } from "vitest";
import { parseAtUri } from "./aturi";

describe("parseAtUri", () => {
  it("parses a well-formed at:// uri", () => {
    expect(parseAtUri("at://did:plc:abc/town.roundabout.guide.document/xyz")).toEqual({
      did: "did:plc:abc",
      collection: "town.roundabout.guide.document",
      rkey: "xyz",
    });
  });

  it("returns null for a malformed uri", () => {
    expect(parseAtUri("not-an-at-uri")).toBeNull();
    expect(parseAtUri("at://did:plc:abc/onlytwo")).toBeNull();
  });
});

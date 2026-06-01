import { describe, it, expect } from "vitest";
import { strongRef } from "./facets";

describe("strongRef", () => {
  it("builds a strongRef", () => {
    expect(strongRef("at://x/y/z", "bafytest")).toEqual({
      uri: "at://x/y/z",
      cid: "bafytest",
    });
  });
});

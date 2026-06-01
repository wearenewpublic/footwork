import { describe, expect, it } from "vitest";
import { attachHighlightApply, type AttachRange } from "./attachHighlight";

describe("attachHighlightApply", () => {
  it("set stores the range", () => {
    expect(attachHighlightApply(null, { type: "set", range: { from: 3, to: 8 } })).toEqual({ from: 3, to: 8 });
  });

  it("clear resets to null", () => {
    expect(attachHighlightApply({ from: 3, to: 8 }, { type: "clear" })).toBeNull();
  });

  it("map shifts a stored range through the mapping", () => {
    const value: AttachRange = { from: 3, to: 8 };
    const mapped = attachHighlightApply(value, { type: "map", map: (pos) => pos + 2 });
    expect(mapped).toEqual({ from: 5, to: 10 });
  });

  it("map on a null range stays null", () => {
    expect(attachHighlightApply(null, { type: "map", map: (pos) => pos + 2 })).toBeNull();
  });
});

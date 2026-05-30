import { describe, it, expect } from "vitest";
import * as pkg from "./index";

describe("package barrel", () => {
  it("re-exports the public API", () => {
    expect(typeof pkg.byteSliceFromChars).toBe("function");
    expect(typeof pkg.facetSegments).toBe("function");
    expect(typeof pkg.strongRef).toBe("function");
    expect(pkg.ids.TownRoundaboutGuideDocument).toBe("town.roundabout.guide.document");
    expect(pkg.lexicons).toBeDefined();
  });
});

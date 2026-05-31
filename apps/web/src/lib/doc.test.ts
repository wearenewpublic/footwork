import { describe, it, expect } from "vitest";
import { paragraphsText, type PMDoc } from "./doc";

describe("paragraphsText", () => {
  it("joins paragraph text with double newlines", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
      ],
    };
    expect(paragraphsText(doc)).toBe("Hello\n\nWorld");
  });

  it("handles an empty paragraph", () => {
    const doc: PMDoc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(paragraphsText(doc)).toBe("");
  });
});

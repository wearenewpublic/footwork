import { describe, expect, test } from "vitest";
import { PlaceRef } from "./placeRef";
import { EventRef } from "./eventRef";

// The viewer (GuideView) renders entity chips as `chip chip-place` / `chip chip-event`,
// and globals.css styles only those classes. For chips to be *visible* in the editor,
// the Tiptap marks must emit the same styled classes (regression guard for the
// "chips invisible in editor" bug).
function renderClass(mark: typeof PlaceRef | typeof EventRef): string {
  const renderHTML = mark.config.renderHTML;
  if (!renderHTML) throw new Error("mark has no renderHTML");
  // renderHTML returns ["span", attrs, 0]; only HTMLAttributes is consumed.
  const out = renderHTML({ HTMLAttributes: {}, mark: {} } as never) as [
    string,
    Record<string, unknown>,
    number,
  ];
  return String(out[1].class);
}

describe("editor ref marks render styled chip classes", () => {
  test("placeRef emits the viewer's place chip classes", () => {
    expect(renderClass(PlaceRef)).toBe("chip chip-place");
  });

  test("eventRef emits the viewer's event chip classes", () => {
    expect(renderClass(EventRef)).toBe("chip chip-event");
  });
});

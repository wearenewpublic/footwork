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
  // renderHTML returns ["span", attrs, 0]; only HTMLAttributes is consumed. It
  // doesn't use `this`, so call it as a plain function (avoids the method's
  // `this`-context typing) with a minimal props stub.
  const render = renderHTML as (props: { HTMLAttributes: Record<string, unknown> }) => [
    string,
    Record<string, unknown>,
    number,
  ];
  const out = render({ HTMLAttributes: {} });
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

import { describe, expect, it, vi } from "vitest";
import { listGuides } from "./appview";

describe("listGuides", () => {
  it("returns the guides array from the AppView", async () => {
    const guides = [
      { uri: "at://did:plc:a/town.roundabout.guide.document/g1", did: "did:plc:a", record: { title: "One" } },
    ];
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ guides }) }) as unknown as typeof fetch;
    expect(await listGuides(f)).toEqual(guides);
  });

  it("returns [] on a non-OK response", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
    expect(await listGuides(f)).toEqual([]);
  });
});

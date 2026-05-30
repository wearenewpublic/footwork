import { describe, it, expect, vi } from "vitest";
import { openDb } from "./db";
import { resolveActor } from "./identity";

const fakeDidDoc = {
  id: "did:plc:a",
  alsoKnownAs: ["at://alice.test"],
  service: [
    { id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: "https://pds.example" },
  ],
};

describe("resolveActor", () => {
  it("resolves did -> handle + pds and caches the result", async () => {
    const db = openDb(":memory:");
    const resolve = vi.fn().mockResolvedValue(fakeDidDoc);

    const a1 = await resolveActor(db, "did:plc:a", resolve);
    expect(a1).toEqual({ did: "did:plc:a", handle: "alice.test", pds: "https://pds.example" });

    // Second call is served from cache (resolver not called again).
    const a2 = await resolveActor(db, "did:plc:a", resolve);
    expect(a2).toEqual(a1);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when resolution fails", async () => {
    const db = openDb(":memory:");
    const resolve = vi.fn().mockRejectedValue(new Error("nope"));
    const a = await resolveActor(db, "did:plc:x", resolve);
    expect(a).toEqual({ did: "did:plc:x", handle: null, pds: null });
  });
});

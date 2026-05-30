import { describe, it, expect } from "vitest";
import { cidForRecord } from "./cid";

describe("cidForRecord", () => {
  it("produces a stable CIDv1 dag-cbor string", async () => {
    const cid = await cidForRecord({ a: 1, b: "two" });
    expect(cid).toMatch(/^bafyrei[a-z2-7]+$/); // CIDv1 base32 dag-cbor + sha256
  });

  it("is insensitive to key order (DAG-CBOR canonicalizes)", async () => {
    const c1 = await cidForRecord({ a: 1, b: 2 });
    const c2 = await cidForRecord({ b: 2, a: 1 });
    expect(c1).toBe(c2);
  });

  it("differs when content differs", async () => {
    const c1 = await cidForRecord({ a: 1 });
    const c2 = await cidForRecord({ a: 2 });
    expect(c1).not.toBe(c2);
  });
});

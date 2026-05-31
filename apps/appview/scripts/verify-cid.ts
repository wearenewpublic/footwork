/**
 * Standalone CID-compat verification for a published guide (Plan 4, Task 7).
 *
 * Usage:  pnpm --filter @guides/appview exec tsx scripts/verify-cid.ts <guide-at-uri>
 *
 * Resolves the guide's PDS, fetches the document and each place/event it
 * references via com.atproto.repo.getRecord, recomputes each referenced record's
 * CID with the AppView's own cidForRecord, and checks it against (a) the cid the
 * document's facet claims and (b) the cid the PDS reports. A MATCH proves our
 * DAG-CBOR CID computation agrees with the real network — the Plan 2 caveat.
 *
 * Run this from a network that can reach atproto infrastructure (plc.directory,
 * the PDS). It needs no Jetstream and no local AppView state.
 */
import { IdResolver } from "@atproto/identity";
import { cidForRecord } from "../src/cid";
import { parseAtUri, httpGetRecord } from "../src/fetcher";
import { refsFromDocument } from "../src/hydrate";

const resolver = new IdResolver();

async function pdsFor(did: string): Promise<string> {
  const doc = (await resolver.did.resolve(did)) as
    | { service?: { type: string; serviceEndpoint: string }[] }
    | null;
  const pds = doc?.service?.find((s) => s.type === "AtprotoPersonalDataServer")?.serviceEndpoint;
  if (!pds) throw new Error(`no PDS endpoint for ${did}`);
  return pds;
}

async function main() {
  const uri = process.argv[2];
  if (!uri) {
    console.error("usage: tsx scripts/verify-cid.ts <guide-at-uri>");
    process.exit(1);
  }
  const parts = parseAtUri(uri);
  if (!parts) throw new Error(`not an at:// uri: ${uri}`);

  const pds = await pdsFor(parts.did);
  const doc = await httpGetRecord(pds, parts.did, parts.collection, parts.rkey);
  if (!doc) throw new Error("document not found on PDS");

  console.log("\n=== guide document ===");
  console.log("uri:  ", uri);
  console.log("title:", (doc.value as any).title);
  console.log("text: ", JSON.stringify((doc.value as any).text));

  const refs = refsFromDocument(doc.value);
  if (refs.length === 0) {
    console.log("\n(no place/event references in this guide)");
    return;
  }

  console.log(`\n=== verifying ${refs.length} reference(s) ===`);
  let allOk = true;
  for (const ref of refs) {
    const rp = parseAtUri(ref.uri);
    if (!rp) {
      console.log(`- ${ref.uri}: UNPARSEABLE`);
      allOk = false;
      continue;
    }
    const refPds = await pdsFor(rp.did);
    const rec = await httpGetRecord(refPds, rp.did, rp.collection, rp.rkey);
    if (!rec) {
      console.log(`- ${ref.uri}: NOT FOUND on PDS`);
      allOk = false;
      continue;
    }
    const computed = await cidForRecord(rec.value);
    const matchExpected = computed === ref.expectedCid;
    const matchPds = computed === rec.cid;
    allOk = allOk && matchExpected && matchPds;
    console.log(`- ${ref.uri}`);
    console.log(`    name:        ${(rec.value as any).name ?? "(n/a)"}`);
    console.log(`    facet cid:   ${ref.expectedCid}`);
    console.log(`    pds cid:     ${rec.cid}`);
    console.log(`    computed:    ${computed}`);
    console.log(`    MATCH (facet=${matchExpected}, pds=${matchPds})  ${matchExpected && matchPds ? "✅" : "❌"}`);
  }
  console.log(`\n=== CID-compat: ${allOk ? "VERIFIED ✅ — our cidForRecord matches the network" : "MISMATCH ❌ — reconcile cid.ts"} ===\n`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("verify failed:", e);
  process.exit(1);
});

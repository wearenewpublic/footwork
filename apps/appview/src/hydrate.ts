import type { Db, DocumentRow } from "./db";
import { cidForRecord } from "./cid";
import type { Actor, HydratedGuide, ResolvedRef } from "./types";

/** A fetched record from a PDS: its claimed cid and decoded value, or null if not found. */
export type FetchRecord = (
  uri: string,
) => Promise<{ cid: string; value: Record<string, unknown> } | null>;

interface RefSpec {
  uri: string;
  expectedCid: string;
}

/** Pull all strongRef (uri, cid) pairs out of a document's facet features. */
export function refsFromDocument(record: Record<string, unknown>): RefSpec[] {
  const out: RefSpec[] = [];
  const facets = (record.facets as any[]) ?? [];
  for (const facet of facets) {
    for (const feature of facet.features ?? []) {
      const ref = feature?.ref as { uri?: string; cid?: string } | undefined;
      if (ref?.uri && ref?.cid) out.push({ uri: ref.uri, expectedCid: ref.cid });
    }
  }
  return out;
}

/**
 * Resolve one reference: serve from cache if present, else fetch, recompute the
 * CID, and verify it matches the expected cid. Verified records are cached.
 */
async function resolveRef(
  db: Db,
  spec: RefSpec,
  fetchRecord: FetchRecord,
): Promise<ResolvedRef> {
  const cached = db.getCachedRecord(spec.uri);
  if (cached && cached.cid === spec.expectedCid) {
    return { uri: spec.uri, expectedCid: spec.expectedCid, value: cached.record, verified: true };
  }

  const fetched = await fetchRecord(spec.uri);
  if (!fetched) {
    return { uri: spec.uri, expectedCid: spec.expectedCid, value: null, verified: false };
  }
  const recomputed = await cidForRecord(fetched.value);
  const verified = recomputed === spec.expectedCid;
  if (verified) {
    db.putCachedRecord({ uri: spec.uri, cid: recomputed, record: fetched.value });
  }
  return {
    uri: spec.uri,
    expectedCid: spec.expectedCid,
    value: verified ? fetched.value : null,
    verified,
  };
}

/** Assemble a fully hydrated guide view. */
export async function hydrateGuide(
  db: Db,
  doc: DocumentRow,
  fetchRecord: FetchRecord,
  author: Actor,
): Promise<HydratedGuide> {
  const specs = refsFromDocument(doc.record);
  const references: Record<string, ResolvedRef> = {};
  for (const spec of specs) {
    references[spec.uri] = await resolveRef(db, spec, fetchRecord);
  }
  return { uri: doc.uri, cid: doc.cid, author, record: doc.record, references };
}

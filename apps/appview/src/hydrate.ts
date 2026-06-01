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
      // Marks carry `ref` top-level; block features (e.g. review) carry it under attrs.
      const ref = (feature?.ref ?? feature?.attrs?.ref) as { uri?: string; cid?: string } | undefined;
      if (ref?.uri && ref?.cid) out.push({ uri: ref.uri, expectedCid: ref.cid });
    }
  }
  return out;
}

/** Find every strongRef-shaped object ({uri, cid}) nested anywhere in a value. */
export function strongRefsInValue(value: unknown): RefSpec[] {
  const out: RefSpec[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.uri === "string" && typeof o.cid === "string") {
        out.push({ uri: o.uri, expectedCid: o.cid });
        return; // a strongRef is a leaf
      }
      for (const k of Object.keys(o)) visit(o[k]);
    }
  };
  visit(value);
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

/** Assemble a fully hydrated guide view, following nested strongRefs up to any depth. */
export async function hydrateGuide(
  db: Db,
  doc: DocumentRow,
  fetchRecord: FetchRecord,
  author: Actor,
): Promise<HydratedGuide> {
  const references: Record<string, ResolvedRef> = {};
  const queue = refsFromDocument(doc.record);
  while (queue.length > 0) {
    const spec = queue.shift()!;
    if (references[spec.uri]) continue; // visited (also breaks cycles)
    const resolved = await resolveRef(db, spec, fetchRecord);
    references[spec.uri] = resolved;
    if (resolved.value) {
      for (const nested of strongRefsInValue(resolved.value)) {
        if (!references[nested.uri]) queue.push(nested);
      }
    }
  }
  return { uri: doc.uri, cid: doc.cid, author, record: doc.record, references };
}

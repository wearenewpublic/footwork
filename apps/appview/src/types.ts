/** A commit event normalized away from any specific firehose/jetstream shape. */
export interface CommitEvent {
  did: string;
  collection: string;
  rkey: string;
  operation: "create" | "update" | "delete";
  /** Present for create/update; absent for delete. */
  record?: Record<string, unknown>;
  /** Present for create/update; absent for delete. */
  cid?: string;
}

export interface Actor {
  did: string;
  handle: string | null;
  pds: string | null;
}

/** A facet reference resolved (or attempted) during hydration. */
export interface ResolvedRef {
  uri: string;
  expectedCid: string;
  /** The fetched record value, if resolution succeeded. */
  value: Record<string, unknown> | null;
  /** True if the fetched record's recomputed CID equals expectedCid. */
  verified: boolean;
}

export interface HydratedGuide {
  uri: string;
  cid: string;
  author: Actor;
  record: Record<string, unknown>;
  /** Keyed by referenced record AT-URI. */
  references: Record<string, ResolvedRef>;
}

export function atUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

export interface ResolvedRef {
  uri: string;
  expectedCid: string;
  value: Record<string, unknown> | null;
  verified: boolean;
}

export interface Actor {
  did: string;
  handle: string | null;
  pds: string | null;
}

export interface HydratedGuide {
  uri: string;
  cid: string;
  author: Actor;
  record: Record<string, unknown>;
  references: Record<string, ResolvedRef>;
}

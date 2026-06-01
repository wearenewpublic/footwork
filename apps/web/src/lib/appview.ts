export interface Actor {
  did: string;
  handle: string | null;
  pds: string | null;
}

export interface ResolvedRef {
  uri: string;
  expectedCid: string;
  value: Record<string, unknown> | null;
  verified: boolean;
}

export interface HydratedGuide {
  uri: string;
  cid: string;
  author: Actor;
  record: Record<string, unknown>;
  references: Record<string, ResolvedRef>;
}

export interface SaveRow {
  uri: string;
  did: string;
  subjectUri: string;
  subjectCid: string;
}

export interface GuideListItem {
  uri: string;
  did: string;
  record: Record<string, unknown>;
}

const BASE = process.env.NEXT_PUBLIC_APPVIEW_URL ?? "http://localhost:3001";
export function appviewUrl(path: string): string {
  return `${BASE}${path}`;
}

type Fetch = typeof fetch;

export async function fetchGuide(
  did: string,
  rkey: string,
  f: Fetch = fetch,
): Promise<HydratedGuide | null> {
  const res = await f(appviewUrl(`/guide/${did}/${rkey}`), {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as HydratedGuide;
}

export async function fetchSaves(
  did: string,
  f: Fetch = fetch,
): Promise<SaveRow[]> {
  const res = await f(appviewUrl(`/profile/${did}/saves`), {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { saves: SaveRow[] };
  return body.saves ?? [];
}

export async function listGuides(f: Fetch = fetch): Promise<GuideListItem[]> {
  const res = await f(appviewUrl("/guides"), { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { guides: GuideListItem[] };
  return body.guides ?? [];
}

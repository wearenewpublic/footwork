import { ids, lexicons, type StrongRef } from "@guides/lexicons";
import type { PMDoc } from "./doc";
import { tiptapToDocument, documentWire, type RefMap } from "./rt";

export interface PlacePayload {
  name: string;
  location?: Record<string, unknown>;
}
export interface EventPayload {
  name: string;
  startsAt?: string;
}
export interface Draft {
  title: string;
  type: "curated" | "list";
  doc: PMDoc;
  places: Record<string, PlacePayload>;
  events: Record<string, EventPayload>;
}

export type CreateRecord = (
  collection: string,
  record: Record<string, unknown>,
) => Promise<{ uri: string; cid: string }>;

function nowIso(): string {
  return new Date().toISOString();
}

export async function publishGuide(repo: string, createRecord: CreateRecord, draft: Draft): Promise<string> {
  const refMap: RefMap = {};

  for (const [refId, place] of Object.entries(draft.places)) {
    const record = { $type: ids.TownRoundaboutGuidePlace, name: place.name, location: place.location, createdAt: nowIso() };
    const ref = await createRecord(ids.TownRoundaboutGuidePlace, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  for (const [refId, event] of Object.entries(draft.events)) {
    const record = { $type: ids.CommunityLexiconCalendarEvent, name: event.name, startsAt: event.startsAt, createdAt: nowIso() };
    const ref = await createRecord(ids.CommunityLexiconCalendarEvent, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  const { text, facets } = documentWire(await tiptapToDocument(draft.doc, refMap));
  const document: Record<string, unknown> = {
    $type: ids.TownRoundaboutGuideDocument,
    title: draft.title,
    type: draft.type,
    text,
    facets,
    createdAt: nowIso(),
  };

  lexicons.assertValidRecord(ids.TownRoundaboutGuideDocument, document);

  const created = await createRecord(ids.TownRoundaboutGuideDocument, document);
  return created.uri;
}

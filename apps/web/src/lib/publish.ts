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
export interface ReviewPayload {
  place: PlacePayload;
  text: string;
  rating: number;
  vibes: string[];
}
export interface Draft {
  title: string;
  type: "curated" | "list";
  doc: PMDoc;
  places: Record<string, PlacePayload>;
  events: Record<string, EventPayload>;
  reviews: Record<string, ReviewPayload>;
}

export type CreateRecord = (
  collection: string,
  record: Record<string, unknown>,
) => Promise<{ uri: string; cid: string }>;

function nowIso(): string {
  return new Date().toISOString();
}

function makePlaceRecord(p: PlacePayload): Record<string, unknown> {
  return { $type: ids.TownRoundaboutGuidePlace, name: p.name, location: p.location, createdAt: nowIso() };
}

export async function publishGuide(repo: string, createRecord: CreateRecord, draft: Draft): Promise<string> {
  const refMap: RefMap = {};

  for (const [refId, place] of Object.entries(draft.places)) {
    const record = makePlaceRecord(place);
    const ref = await createRecord(ids.TownRoundaboutGuidePlace, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  for (const [refId, event] of Object.entries(draft.events)) {
    const record = { $type: ids.CommunityLexiconCalendarEvent, name: event.name, startsAt: event.startsAt, createdAt: nowIso() };
    const ref = await createRecord(ids.CommunityLexiconCalendarEvent, record);
    refMap[refId] = { uri: ref.uri, cid: ref.cid } satisfies StrongRef;
  }

  for (const [refId, review] of Object.entries(draft.reviews)) {
    const placeRecord = makePlaceRecord(review.place);
    const placeRef = await createRecord(ids.TownRoundaboutGuidePlace, placeRecord);
    const reviewRecord = {
      $type: ids.TownRoundaboutGuideVenueReview,
      place: { uri: placeRef.uri, cid: placeRef.cid },
      text: review.text,
      rating: review.rating,
      vibes: review.vibes,
      createdAt: nowIso(),
    };
    const reviewRef = await createRecord(ids.TownRoundaboutGuideVenueReview, reviewRecord);
    refMap[refId] = { uri: reviewRef.uri, cid: reviewRef.cid } satisfies StrongRef;
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

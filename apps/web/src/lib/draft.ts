import type { PMDoc } from "./doc";
import type { Draft, PlacePayload, EventPayload, ReviewPayload } from "./publish";

function referencedRefIds(doc: PMDoc): string[] {
  const out: string[] = [];
  for (const node of doc.content) {
    if (node.type === "reviewBlock") {
      out.push(node.attrs.refId);
      continue;
    }
    for (const tn of node.content ?? []) {
      for (const mark of tn.marks ?? []) {
        if ((mark.type === "placeRef" || mark.type === "eventRef") && mark.attrs?.refId) {
          out.push(mark.attrs.refId);
        }
      }
    }
  }
  return out;
}

export function buildDraft(
  doc: PMDoc,
  title: string,
  type: "curated" | "list",
  places: Record<string, PlacePayload>,
  events: Record<string, EventPayload>,
  reviews: Record<string, ReviewPayload>,
): Draft {
  if (!title.trim()) throw new Error("title is required");
  for (const refId of referencedRefIds(doc)) {
    if (!(refId in places) && !(refId in events) && !(refId in reviews)) {
      throw new Error(`referenced refId "${refId}" has no place/event/review payload`);
    }
  }
  return { title, type, doc, places, events, reviews };
}

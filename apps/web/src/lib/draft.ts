import type { PMDoc, PMParagraph } from "./doc";
import type { Draft, PlacePayload, EventPayload } from "./publish";

function referencedRefIds(doc: PMDoc): string[] {
  const out: string[] = [];
  for (const para of doc.content.filter((n): n is PMParagraph => n.type === "paragraph")) {
    for (const node of para.content ?? []) {
      for (const mark of node.marks ?? []) {
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
): Draft {
  if (!title.trim()) throw new Error("title is required");
  for (const refId of referencedRefIds(doc)) {
    if (!(refId in places) && !(refId in events)) {
      throw new Error(`referenced refId "${refId}" has no place/event payload`);
    }
  }
  return { title, type, doc, places, events };
}

import { byteSliceFromChars, ids, type FacetLike as Facet, type StrongRef } from "@guides/lexicons";
import type { PMDoc, PMMark } from "./doc";

const DOC = ids.TownRoundaboutGuideDocument;

export type RefMap = Record<string, StrongRef>;

function featureFromMark(mark: PMMark, refMap: RefMap): Record<string, unknown> | null {
  switch (mark.type) {
    case "bold":
    case "italic":
      return { $type: `${DOC}#format`, kind: mark.type };
    case "placeRef":
    case "eventRef": {
      const refId = mark.attrs?.refId;
      const ref = refId ? refMap[refId] : undefined;
      if (!ref) return null; // unresolved ref: drop the feature, keep the text
      const type = mark.type === "placeRef" ? "placeRef" : "eventRef";
      return { $type: `${DOC}#${type}`, ref, intent: mark.attrs?.intent ?? "card" };
    }
    default:
      return null;
  }
}

/** Project a ProseMirror doc to atproto {text, facets}, resolving ref ids via refMap. */
export function docToStorage(doc: PMDoc, refMap: RefMap): { text: string; facets: Facet[] } {
  let text = "";
  const facets: Facet[] = [];

  doc.content.forEach((para, pIdx) => {
    if (pIdx > 0) text += "\n\n";
    for (const node of para.content ?? []) {
      const charStart = text.length;
      text += node.text;
      const charEnd = text.length;
      const features = (node.marks ?? [])
        .map((m) => featureFromMark(m, refMap))
        .filter((f): f is Record<string, unknown> => f !== null);
      if (features.length > 0) {
        facets.push({ index: byteSliceFromChars(text, charStart, charEnd), features: features as any });
      }
    }
  });

  return { text, facets };
}

import { byteSliceFromChars, facetSegments, ids, type FacetLike as Facet, type StrongRef } from "@guides/lexicons";
import type { PMDoc, PMMark, PMParagraph, PMTextNode } from "./doc";

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

interface InlineFeature {
  $type: string;
  kind?: string;
  ref?: StrongRef;
  intent?: string;
}

function marksFromFeatures(features: unknown[]): { marks: PMMark[]; refs: Record<string, StrongRef> } {
  const marks: PMMark[] = [];
  const refs: Record<string, StrongRef> = {};
  for (const f of features as InlineFeature[]) {
    if (f.$type === `${DOC}#format` && (f.kind === "bold" || f.kind === "italic")) {
      marks.push({ type: f.kind });
    } else if (f.$type === `${DOC}#placeRef` && f.ref) {
      const refId = `${f.ref.uri}#${f.ref.cid}`;
      refs[refId] = f.ref;
      marks.push({ type: "placeRef", attrs: { refId, intent: f.intent ?? "card" } });
    } else if (f.$type === `${DOC}#eventRef` && f.ref) {
      const refId = `${f.ref.uri}#${f.ref.cid}`;
      refs[refId] = f.ref;
      marks.push({ type: "eventRef", attrs: { refId, intent: f.intent ?? "card" } });
    }
  }
  return { marks, refs };
}

/** Reconstruct a ProseMirror doc from atproto {text, facets}. */
export function storageToDoc(storage: { text: string; facets: Facet[] }): PMDoc {
  const paragraphs: PMParagraph[] = [];
  const segments = [...facetSegments(storage.text, storage.facets)];
  let current: PMTextNode[] = [];
  const flush = () => {
    paragraphs.push(current.length ? { type: "paragraph", content: current } : { type: "paragraph" });
    current = [];
  };
  for (const seg of segments) {
    const parts = seg.text.split("\n\n");
    parts.forEach((part, i) => {
      if (i > 0) flush();
      if (part.length === 0) return;
      const { marks } = marksFromFeatures(seg.features);
      current.push(marks.length ? { type: "text", text: part, marks } : { type: "text", text: part });
    });
  }
  flush();
  return { type: "doc", content: paragraphs };
}

/** Build a refMap (refId -> StrongRef) from a doc produced by storageToDoc. */
export function refMapFromDoc(doc: PMDoc): RefMap {
  const map: RefMap = {};
  for (const para of doc.content) {
    for (const node of para.content ?? []) {
      for (const mark of node.marks ?? []) {
        if ((mark.type === "placeRef" || mark.type === "eventRef") && mark.attrs?.refId) {
          const [uri, cid] = mark.attrs.refId.split("#");
          if (uri && cid) map[mark.attrs.refId] = { uri, cid };
        }
      }
    }
  }
  return map;
}

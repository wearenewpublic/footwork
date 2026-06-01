import { Document } from "relational-text/core";
import { init } from "relational-text/registry";
import { ids, type StrongRef } from "@guides/lexicons";
import type { PMDoc, PMMark } from "./doc";

const PLACE = `${ids.TownRoundaboutGuideFacet}#place`;
const EVENT = `${ids.TownRoundaboutGuideFacet}#event`;

let _ready: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (!_ready) _ready = init();
  return _ready;
}

export type RefMap = Record<string, StrongRef>;

const enc = new TextEncoder();
const byteLen = (s: string): number => enc.encode(s).length;

// relationaltext block markers: a single sentinel char per block, embedded in the
// text. The first block uses U+FFFC (OBJECT REPLACEMENT CHAR), every subsequent
// block uses LINE FEED. The block facet covers ONLY the marker char; the block's
// content is the text following the marker up to the next marker. (See the
// relationaltext "Blocks" guide.)
const FIRST_BLOCK_MARKER = "￼";
const NEXT_BLOCK_MARKER = "\n";

function markInput(mark: PMMark, refMap: RefMap): Record<string, unknown> | null {
  switch (mark.type) {
    case "bold":
      return { name: "bold" };
    case "italic":
      return { name: "italic" };
    case "placeRef":
    case "eventRef": {
      const ref = mark.attrs?.refId ? refMap[mark.attrs.refId] : undefined;
      if (!ref) return null;
      return { $type: mark.type === "placeRef" ? PLACE : EVENT, ref: { uri: ref.uri, cid: ref.cid }, intent: mark.attrs?.intent ?? "card" };
    }
    default:
      return null;
  }
}

export async function tiptapToDocument(json: PMDoc, refMap: RefMap): Promise<Document> {
  await ensureInit();
  let text = "";
  const spans: { byteStart: number; byteEnd: number; mark: Record<string, unknown> }[] = [];
  // Each paragraph contributes a one-char block marker; the block facet covers
  // only that marker's bytes.
  const markers: { start: number; end: number }[] = [];

  json.content.forEach((para, pIdx) => {
    const markerStart = byteLen(text);
    text += pIdx === 0 ? FIRST_BLOCK_MARKER : NEXT_BLOCK_MARKER;
    markers.push({ start: markerStart, end: byteLen(text) });
    for (const node of para.content ?? []) {
      const start = byteLen(text);
      text += node.text;
      const end = byteLen(text);
      for (const m of node.marks ?? []) {
        const mi = markInput(m, refMap);
        if (mi) spans.push({ byteStart: start, byteEnd: end, mark: mi });
      }
    }
  });

  let doc = Document.fromText(text);
  for (const m of markers) doc = doc.addBlock(m.start, m.end, { name: "paragraph", parents: [] });
  for (const s of spans) doc = doc.addMark(s.byteStart, s.byteEnd, s.mark as any);
  return doc;
}

export function documentWire(doc: Document): { text: string; facets: unknown[] } {
  return { text: doc.text, facets: doc.facets as unknown[] };
}

export function documentFromWire(wire: { text: string; facets: unknown[] }): Document {
  return Document.fromJSON(wire as any);
}

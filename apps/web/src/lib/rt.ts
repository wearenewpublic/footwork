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
  const blocks: { start: number; end: number }[] = [];

  json.content.forEach((para, pIdx) => {
    if (pIdx > 0) text += "\n\n";
    const blockStart = byteLen(text);
    for (const node of para.content ?? []) {
      const start = byteLen(text);
      text += node.text;
      const end = byteLen(text);
      for (const m of node.marks ?? []) {
        const mi = markInput(m, refMap);
        if (mi) spans.push({ byteStart: start, byteEnd: end, mark: mi });
      }
    }
    blocks.push({ start: blockStart, end: byteLen(text) });
  });

  let doc = Document.fromText(text);
  for (const b of blocks) doc = doc.addBlock(b.start, b.end, { name: "paragraph" });
  for (const s of spans) doc = doc.addMark(s.byteStart, s.byteEnd, s.mark as any);
  return doc;
}

export function documentWire(doc: Document): { text: string; facets: unknown[] } {
  return { text: doc.text, facets: doc.facets as unknown[] };
}

export function documentFromWire(wire: { text: string; facets: unknown[] }): Document {
  return Document.fromJSON(wire as any);
}

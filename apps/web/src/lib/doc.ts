export interface PMMark {
  type: "bold" | "italic" | "placeRef" | "eventRef";
  attrs?: { refId?: string; intent?: string };
}
export interface PMTextNode {
  type: "text";
  text: string;
  marks?: PMMark[];
}
export interface PMParagraph {
  type: "paragraph";
  content?: PMTextNode[];
}
export interface PMReviewBlock {
  type: "reviewBlock";
  attrs: { refId: string; placeName: string; rating: number };
}
export interface PMDoc {
  type: "doc";
  content: (PMParagraph | PMReviewBlock)[];
}

/** The plain-text projection of the document: paragraphs joined by blank lines. */
export function paragraphsText(doc: PMDoc): string {
  return doc.content
    .filter((n): n is PMParagraph => n.type === "paragraph")
    .map((p) => (p.content ?? []).map((node) => node.text).join(""))
    .join("\n\n");
}

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
export interface PMDoc {
  type: "doc";
  content: PMParagraph[];
}

/** The plain-text projection of the document: paragraphs joined by blank lines. */
export function paragraphsText(doc: PMDoc): string {
  return doc.content
    .map((p) => (p.content ?? []).map((n) => n.text).join(""))
    .join("\n\n");
}

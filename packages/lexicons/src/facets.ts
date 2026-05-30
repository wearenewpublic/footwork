export interface ByteSlice {
  byteStart: number;
  byteEnd: number;
}

/** A facet shape sufficient for segmentation: a byte range plus opaque features. */
export interface FacetLike {
  index: ByteSlice;
  features: unknown[];
}

export interface Segment {
  text: string;
  features: unknown[];
}

export interface StrongRef {
  uri: string;
  cid: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Number of UTF-8 bytes in a string. */
export function utf8Len(s: string): number {
  return encoder.encode(s).length;
}

/** Build a UTF-8 byte slice from JS string (char) indices. */
export function byteSliceFromChars(
  text: string,
  charStart: number,
  charEnd: number,
): ByteSlice {
  return {
    byteStart: utf8Len(text.slice(0, charStart)),
    byteEnd: utf8Len(text.slice(0, charEnd)),
  };
}

/**
 * Split text into ordered segments by facet byte ranges. Plain runs carry an
 * empty features array. Assumes non-overlapping facets (sufficient for the spike).
 */
export function* facetSegments(
  text: string,
  facets: FacetLike[],
): Generator<Segment> {
  const bytes = encoder.encode(text);
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );
  let cursor = 0;
  for (const f of sorted) {
    if (f.index.byteStart > cursor) {
      yield { text: decoder.decode(bytes.slice(cursor, f.index.byteStart)), features: [] };
    }
    yield {
      text: decoder.decode(bytes.slice(f.index.byteStart, f.index.byteEnd)),
      features: f.features,
    };
    cursor = f.index.byteEnd;
  }
  if (cursor < bytes.length) {
    yield { text: decoder.decode(bytes.slice(cursor)), features: [] };
  }
}

export function strongRef(uri: string, cid: string): StrongRef {
  return { uri, cid };
}

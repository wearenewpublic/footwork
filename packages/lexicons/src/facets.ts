/** A content-addressed reference to another record (com.atproto.repo.strongRef). */
export interface StrongRef {
  uri: string;
  cid: string;
}

export function strongRef(uri: string, cid: string): StrongRef {
  return { uri, cid };
}

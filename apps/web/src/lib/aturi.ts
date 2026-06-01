/** Parse an `at://<did>/<collection>/<rkey>` URI into its parts, or null if malformed. */
export function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m) return null;
  return { did: m[1], collection: m[2], rkey: m[3] };
}

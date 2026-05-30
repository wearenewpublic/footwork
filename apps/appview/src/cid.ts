import * as dagCbor from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

/**
 * Compute the AT Protocol "blessed" CID for a record value:
 * DAG-CBOR encode (codec 0x71) -> SHA-256 -> CIDv1.
 *
 * Valid for records containing only scalar/object/array values (our lexicons).
 * Records with blobs or cid-links would require lex->IPLD transformation first.
 */
export async function cidForRecord(value: unknown): Promise<string> {
  const bytes = dagCbor.encode(value);
  const digest = await sha256.digest(bytes);
  return CID.createV1(dagCbor.code, digest).toString();
}

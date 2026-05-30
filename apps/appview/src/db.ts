import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, did TEXT NOT NULL, rkey TEXT NOT NULL,
  record TEXT NOT NULL, indexedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
  uri TEXT PRIMARY KEY, did TEXT NOT NULL, subjectUri TEXT NOT NULL,
  subjectCid TEXT NOT NULL, indexedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cached_records (
  uri TEXT PRIMARY KEY, cid TEXT NOT NULL, record TEXT NOT NULL, fetchedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actors (
  did TEXT PRIMARY KEY, handle TEXT, pds TEXT, resolvedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cursor (id INTEGER PRIMARY KEY CHECK (id = 1), seq TEXT);
`;

export interface DocumentRow {
  uri: string;
  cid: string;
  did: string;
  rkey: string;
  record: Record<string, unknown>;
}
export interface SaveRow {
  uri: string;
  did: string;
  subjectUri: string;
  subjectCid: string;
}
export interface CachedRow {
  uri: string;
  cid: string;
  record: Record<string, unknown>;
}
export interface ActorRow {
  did: string;
  handle: string | null;
  pds: string | null;
}

export class Db {
  private db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  putDocument(r: DocumentRow): void {
    this.db
      .prepare(
        `INSERT INTO documents (uri, cid, did, rkey, record, indexedAt)
         VALUES (@uri, @cid, @did, @rkey, @record, @indexedAt)
         ON CONFLICT(uri) DO UPDATE SET cid=@cid, record=@record, indexedAt=@indexedAt`,
      )
      .run({ ...r, record: JSON.stringify(r.record), indexedAt: new Date().toISOString() });
  }
  getDocument(uri: string): DocumentRow | null {
    const row = this.db.prepare(`SELECT * FROM documents WHERE uri = ?`).get(uri) as any;
    return row ? { ...row, record: JSON.parse(row.record) } : null;
  }
  listDocuments(limit: number): DocumentRow[] {
    const rows = this.db
      .prepare(`SELECT * FROM documents ORDER BY indexedAt DESC LIMIT ?`)
      .all(limit) as any[];
    return rows.map((r) => ({ ...r, record: JSON.parse(r.record) }));
  }
  deleteDocument(uri: string): void {
    this.db.prepare(`DELETE FROM documents WHERE uri = ?`).run(uri);
  }

  putSave(r: SaveRow): void {
    this.db
      .prepare(
        `INSERT INTO saves (uri, did, subjectUri, subjectCid, indexedAt)
         VALUES (@uri, @did, @subjectUri, @subjectCid, @indexedAt)
         ON CONFLICT(uri) DO UPDATE SET subjectUri=@subjectUri, subjectCid=@subjectCid, indexedAt=@indexedAt`,
      )
      .run({ ...r, indexedAt: new Date().toISOString() });
  }
  deleteSave(uri: string): void {
    this.db.prepare(`DELETE FROM saves WHERE uri = ?`).run(uri);
  }
  listSavesByDid(did: string): SaveRow[] {
    return this.db
      .prepare(`SELECT uri, did, subjectUri, subjectCid FROM saves WHERE did = ? ORDER BY indexedAt DESC`)
      .all(did) as SaveRow[];
  }

  putCachedRecord(r: CachedRow): void {
    this.db
      .prepare(
        `INSERT INTO cached_records (uri, cid, record, fetchedAt)
         VALUES (@uri, @cid, @record, @fetchedAt)
         ON CONFLICT(uri) DO UPDATE SET cid=@cid, record=@record, fetchedAt=@fetchedAt`,
      )
      .run({ ...r, record: JSON.stringify(r.record), fetchedAt: new Date().toISOString() });
  }
  getCachedRecord(uri: string): CachedRow | null {
    const row = this.db.prepare(`SELECT * FROM cached_records WHERE uri = ?`).get(uri) as any;
    return row ? { ...row, record: JSON.parse(row.record) } : null;
  }

  putActor(r: ActorRow): void {
    this.db
      .prepare(
        `INSERT INTO actors (did, handle, pds, resolvedAt)
         VALUES (@did, @handle, @pds, @resolvedAt)
         ON CONFLICT(did) DO UPDATE SET handle=@handle, pds=@pds, resolvedAt=@resolvedAt`,
      )
      .run({ ...r, resolvedAt: new Date().toISOString() });
  }
  getActor(did: string): ActorRow | null {
    return (this.db.prepare(`SELECT did, handle, pds FROM actors WHERE did = ?`).get(did) as ActorRow) ?? null;
  }

  getCursor(): string | null {
    const row = this.db.prepare(`SELECT seq FROM cursor WHERE id = 1`).get() as any;
    return row?.seq ?? null;
  }
  setCursor(seq: string): void {
    this.db
      .prepare(`INSERT INTO cursor (id, seq) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET seq = ?`)
      .run(seq, seq);
  }
}

export function openDb(path: string): Db {
  return new Db(path);
}

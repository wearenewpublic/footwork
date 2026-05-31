import { serve } from "@hono/node-server";
import { openDb } from "./db";
import { startJetstream } from "./jetstream";
import { makePdsFetcher } from "./fetcher";
import { createApi } from "./api";
import { resolveActor } from "./identity";

const DB_PATH = process.env.APPVIEW_DB ?? "appview.sqlite";
const PORT = Number(process.env.PORT ?? 3001);
// Optional replay cursor (unix microseconds): overrides the persisted cursor to
// backfill recent events (e.g. records published while the AppView was down).
const CURSOR = process.env.APPVIEW_CURSOR ? Number(process.env.APPVIEW_CURSOR) : undefined;

const db = openDb(DB_PATH);
startJetstream(db, CURSOR);

const api = createApi({
  db,
  fetchRecord: makePdsFetcher(db),
  resolveActorFn: (did) => resolveActor(db, did),
});

serve({ fetch: api.fetch, port: PORT });
console.log(`AppView listening on http://localhost:${PORT} (db: ${DB_PATH})`);

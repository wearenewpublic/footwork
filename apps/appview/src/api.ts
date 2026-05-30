import { Hono } from "hono";
import { ids } from "@guides/lexicons";
import type { Db } from "./db";
import type { FetchRecord } from "./hydrate";
import { hydrateGuide } from "./hydrate";
import { atUri, type Actor } from "./types";

export interface ApiDeps {
  db: Db;
  fetchRecord: FetchRecord;
  resolveActorFn: (did: string) => Promise<Actor>;
}

export function createApi(deps: ApiDeps): Hono {
  const { db, fetchRecord, resolveActorFn } = deps;
  const app = new Hono();

  app.get("/guide/:did/:rkey", async (c) => {
    const uri = atUri(c.req.param("did"), ids.TownRoundaboutGuideDocument, c.req.param("rkey"));
    const doc = db.getDocument(uri);
    if (!doc) return c.json({ error: "not found" }, 404);
    const author = await resolveActorFn(doc.did);
    const view = await hydrateGuide(db, doc, fetchRecord, author);
    return c.json(view);
  });

  app.get("/guides", (c) => {
    const guides = db.listDocuments(50).map((d) => ({ uri: d.uri, did: d.did, record: d.record }));
    return c.json({ guides });
  });

  app.get("/profile/:did/saves", (c) => {
    const saves = db.listSavesByDid(c.req.param("did"));
    return c.json({ saves });
  });

  return app;
}

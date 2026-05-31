import type { Agent } from "@atproto/api";
import type { CreateRecord } from "./publish";

/** Wrap an authenticated Agent into the CreateRecord function the publish pipeline expects. */
export function makeCreateRecord(agent: Agent, repo: string): CreateRecord {
  return async (collection, record) => {
    const res = await agent.com.atproto.repo.createRecord({ repo, collection, record });
    return { uri: res.data.uri, cid: res.data.cid };
  };
}

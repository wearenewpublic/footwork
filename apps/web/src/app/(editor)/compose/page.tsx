"use client";
import { useState } from "react";
import { useAuth } from "../../../lib/auth";
import { AuthGate } from "../../../components/AuthGate";
import { GuideEditor } from "../../../components/GuideEditor";
import { buildDraft } from "../../../lib/draft";
import { publishGuide } from "../../../lib/publish";
import { makeCreateRecord } from "../../../lib/agent";
import type { PMDoc } from "../../../lib/doc";
import type { PlacePayload, EventPayload } from "../../../lib/publish";

function Composer() {
  const { agent, did } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"curated" | "list">("list");
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPublish = async (
    doc: PMDoc,
    places: Record<string, PlacePayload>,
    events: Record<string, EventPayload>,
  ) => {
    setError(null);
    try {
      if (!agent || !did) throw new Error("not signed in");
      const draft = buildDraft(doc, title, type, places, events);
      const uri = await publishGuide(did, makeCreateRecord(agent, did), draft);
      setResultUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main>
      <h1>Compose a guide</h1>
      <input placeholder="Guide title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select value={type} onChange={(e) => setType(e.target.value as "curated" | "list")}>
        <option value="list">List</option>
        <option value="curated">Curated</option>
      </select>
      <GuideEditor onPublish={onPublish} />
      {error && <p role="alert">Error: {error}</p>}
      {resultUri && (
        <p>
          Published: <code>{resultUri}</code>
        </p>
      )}
    </main>
  );
}

export default function ComposePage() {
  return (
    <AuthGate>
      <Composer />
    </AuthGate>
  );
}

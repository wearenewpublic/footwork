"use client";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { buildSaveRecord } from "../lib/save";
import { ids } from "@guides/lexicons";

export function SaveButton({
  subjectUri,
  subjectCid,
}: {
  subjectUri: string;
  subjectCid: string;
}) {
  const { agent, did } = useAuth();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  if (!agent || !did) return null;
  const onSave = async () => {
    setState("saving");
    try {
      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: ids.TownRoundaboutGuideSave,
        record: buildSaveRecord({ uri: subjectUri, cid: subjectCid }),
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };
  return (
    <button
      onClick={onSave}
      disabled={state === "saving" || state === "saved"}
    >
      {state === "saved"
        ? "Saved ✓"
        : state === "saving"
          ? "Saving…"
          : state === "error"
            ? "Retry save"
            : "Save"}
    </button>
  );
}

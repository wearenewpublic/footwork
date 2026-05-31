"use client";
import { useState } from "react";
import type { EventPayload } from "../lib/publish";

export function CreateEventPopup({ onSubmit, onCancel }: { onSubmit: (e: EventPayload) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  return (
    <div role="dialog" aria-label="Add event">
      <input placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Starts at (ISO, optional)" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      <button onClick={() => onSubmit({ name, startsAt: startsAt || undefined })} disabled={!name.trim()}>
        Add event
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

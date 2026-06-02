"use client";
import { useState } from "react";
import type { PlacePayload } from "../lib/publish";
import { PlaceSearch } from "./PlaceSearch";

export function CreatePlacePopup({ onSubmit, onCancel }: { onSubmit: (p: PlacePayload) => void; onCancel: () => void }) {
  const [place, setPlace] = useState<PlacePayload | null>(null);
  return (
    <div role="dialog" aria-label="Add place">
      <PlaceSearch onSelect={setPlace} />
      <button onClick={() => place && onSubmit(place)} disabled={!place}>Add place</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

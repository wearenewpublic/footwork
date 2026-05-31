"use client";
import { useState } from "react";
import type { PlacePayload } from "../lib/publish";
import { ids } from "@guides/lexicons";

export function CreatePlacePopup({ onSubmit, onCancel }: { onSubmit: (p: PlacePayload) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  return (
    <div role="dialog" aria-label="Add place">
      <input placeholder="Place name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Latitude (optional)" value={lat} onChange={(e) => setLat(e.target.value)} />
      <input placeholder="Longitude (optional)" value={lng} onChange={(e) => setLng(e.target.value)} />
      <button
        onClick={() => {
          const location =
            lat && lng ? { $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng } : undefined;
          onSubmit({ name, location });
        }}
        disabled={!name.trim()}
      >
        Add place
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

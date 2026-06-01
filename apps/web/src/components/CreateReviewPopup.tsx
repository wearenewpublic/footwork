"use client";
import { useState } from "react";
import type { ReviewPayload } from "../lib/publish";
import { ids } from "@guides/lexicons";

export function CreateReviewPopup({ onSubmit, onCancel }: { onSubmit: (r: ReviewPayload) => void; onCancel: () => void }) {
  const [placeName, setPlaceName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [vibes, setVibes] = useState("");
  return (
    <div role="dialog" aria-label="Add review">
      <input placeholder="Place name" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
      <input placeholder="Latitude (optional)" value={lat} onChange={(e) => setLat(e.target.value)} />
      <input placeholder="Longitude (optional)" value={lng} onChange={(e) => setLng(e.target.value)} />
      <label>
        Rating:
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <textarea placeholder="Review" value={text} onChange={(e) => setText(e.target.value)} />
      <input placeholder="Vibes (comma-separated)" value={vibes} onChange={(e) => setVibes(e.target.value)} />
      <button
        onClick={() => {
          const location = lat && lng ? { $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng } : undefined;
          onSubmit({
            place: { name: placeName, location },
            text,
            rating,
            vibes: vibes.split(",").map((v) => v.trim()).filter(Boolean),
          });
        }}
        disabled={!placeName.trim() || !text.trim()}
      >
        Add review
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

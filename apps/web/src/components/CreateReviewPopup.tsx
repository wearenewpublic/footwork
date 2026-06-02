"use client";
import { useState } from "react";
import type { ReviewPayload, PlacePayload } from "../lib/publish";
import { PlaceSearch } from "./PlaceSearch";

export function CreateReviewPopup({ onSubmit, onCancel }: { onSubmit: (r: ReviewPayload) => void; onCancel: () => void }) {
  const [place, setPlace] = useState<PlacePayload | null>(null);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [vibes, setVibes] = useState("");
  return (
    <div role="dialog" aria-label="Add review">
      <PlaceSearch onSelect={setPlace} />
      <label>
        Rating:
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <textarea placeholder="Review" value={text} onChange={(e) => setText(e.target.value)} />
      <input placeholder="Vibes (comma-separated)" value={vibes} onChange={(e) => setVibes(e.target.value)} />
      <button
        onClick={() => place && onSubmit({ place, text, rating, vibes: vibes.split(",").map((v) => v.trim()).filter(Boolean) })}
        disabled={!place || !text.trim()}
      >
        Add review
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

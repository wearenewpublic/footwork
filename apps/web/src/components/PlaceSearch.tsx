"use client";
import { useEffect, useRef, useState } from "react";
import type { PlacePayload } from "../lib/publish";
import type { Suggestion } from "../lib/places";

function newSession(): string {
  let s = "";
  while (s.length < 32) s += Math.random().toString(36).slice(2);
  return s.slice(0, 32);
}

export function PlaceSearch({ onSelect }: { onSelect: (p: PlacePayload | null) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<PlacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(newSession());

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${session.current}`);
        if (cancelled) return;
        if (!res.ok) { setError("search unavailable"); setSuggestions([]); return; }
        const body = (await res.json()) as { results: Suggestion[] };
        if (cancelled) return;
        setError(null);
        setSuggestions(body.results ?? []);
      } catch {
        if (!cancelled) { setError("search unavailable"); setSuggestions([]); }
      }
    }, 250);
    return () => { clearTimeout(t); cancelled = true; };
  }, [query, selected]);

  const pick = async (s: Suggestion) => {
    setSuggestions([]);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(s.fsqPlaceId)}&session=${session.current}`);
      if (!res.ok) { setError("could not load place"); return; }
      const payload = (await res.json()) as PlacePayload;
      setSelected(payload);
      setQuery(payload.name);
      setError(null);
      onSelect(payload);
      session.current = newSession();
    } catch {
      setError("could not load place");
    }
  };

  const clear = () => { setSelected(null); setQuery(""); setSuggestions([]); onSelect(null); };

  if (selected) {
    return (
      <div className="place-search">
        <div className="place-selected">
          <strong>{selected.name}</strong>
          <button type="button" onClick={clear}>Change</button>
        </div>
        <p className="place-attribution">Powered by Foursquare</p>
      </div>
    );
  }

  return (
    <div className="place-search">
      <input placeholder="Search for a place" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="place-error">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="place-suggestions">
          {suggestions.map((s) => (
            <li key={s.fsqPlaceId}>
              <button type="button" onClick={() => pick(s)}>
                <span className="place-name">{s.name}</span>
                {s.formatted && <span className="place-formatted"> — {s.formatted}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="place-attribution">Powered by Foursquare</p>
    </div>
  );
}

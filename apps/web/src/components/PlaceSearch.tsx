"use client";
import { useEffect, useState } from "react";
import type { PlacePayload } from "../lib/publish";
import type { SearchResult } from "../lib/places";

export function PlaceSearch({ onSelect }: { onSelect: (p: PlacePayload | null) => void }) {
  const [query, setQuery] = useState("");
  const [near, setNear] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<PlacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 3) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const u = `/api/places/search?q=${encodeURIComponent(q)}` + (near.trim() ? `&near=${encodeURIComponent(near.trim())}` : "");
        const res = await fetch(u);
        if (cancelled) return;
        if (!res.ok) { setError("search unavailable"); setResults([]); return; }
        const body = (await res.json()) as { results: SearchResult[] };
        if (cancelled) return;
        setError(null);
        setResults(body.results ?? []);
      } catch {
        if (!cancelled) { setError("search unavailable"); setResults([]); }
      }
    }, 300);
    return () => { clearTimeout(t); cancelled = true; };
  }, [query, near, selected]);

  const pick = (r: SearchResult) => {
    setSelected(r.payload);
    setQuery(r.name);
    setResults([]);
    setError(null);
    onSelect(r.payload);
  };

  const clear = () => { setSelected(null); setQuery(""); setResults([]); onSelect(null); };

  if (selected) {
    return (
      <div className="place-search">
        <div className="place-selected"><strong>{selected.name}</strong><button type="button" onClick={clear}>Change</button></div>
        <p className="place-attribution">Powered by Foursquare</p>
      </div>
    );
  }

  return (
    <div className="place-search">
      <input placeholder="Search for a place" value={query} onChange={(e) => setQuery(e.target.value)} />
      <input placeholder="Near (city or area)" value={near} onChange={(e) => setNear(e.target.value)} />
      {error && <p className="place-error">{error}</p>}
      {results.length > 0 && (
        <ul className="place-suggestions">
          {results.map((r, i) => (
            <li key={r.fsqPlaceId || `${r.name}-${i}`}>
              <button type="button" onClick={() => pick(r)}>
                <span className="place-name">{r.name}</span>
                {r.formatted && <span className="place-formatted"> — {r.formatted}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="place-attribution">Powered by Foursquare</p>
    </div>
  );
}

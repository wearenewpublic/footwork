import { ids } from "@guides/lexicons";
import type { PlacePayload, LocationEncoding } from "./publish";

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_API_VERSION = "2025-06-17";

export function fsqHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "X-Places-Api-Version": FSQ_API_VERSION, Accept: "application/json" };
}

export function autocompleteUrl(query: string, session: string): string {
  const p = new URLSearchParams({ query, types: "place", session_token: session, limit: "8" });
  return `${FSQ_BASE}/autocomplete?${p.toString()}`;
}

export function detailsUrl(fsqPlaceId: string): string {
  const p = new URLSearchParams({ fields: "fsq_place_id,name,latitude,longitude,location" });
  return `${FSQ_BASE}/places/${encodeURIComponent(fsqPlaceId)}?${p.toString()}`;
}

export interface Suggestion {
  fsqPlaceId: string;
  name: string;
  formatted: string;
}

/** Defensive: the autocomplete result nesting isn't fully public; pull the place id + a label tolerantly. */
export function mapAutocomplete(json: unknown): Suggestion[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const out: Suggestion[] = [];
  for (const r of results as Record<string, any>[]) {
    const place = r?.place ?? r;
    const id = place?.fsq_place_id ?? place?.fsq_id;
    if (!id) continue;
    const name = place?.name ?? r?.text?.primary ?? "";
    const formatted = r?.text?.secondary ?? place?.location?.formatted_address ?? "";
    out.push({ fsqPlaceId: String(id), name: String(name), formatted: String(formatted) });
  }
  return out;
}

export interface PlaceDetails {
  fsqPlaceId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location?: Record<string, unknown>;
}

export function mapDetails(json: unknown): PlaceDetails {
  const p = (json ?? {}) as Record<string, any>;
  return {
    fsqPlaceId: String(p.fsq_place_id ?? ""),
    name: String(p.name ?? ""),
    latitude: typeof p.latitude === "number" ? p.latitude : undefined,
    longitude: typeof p.longitude === "number" ? p.longitude : undefined,
    location: p.location && typeof p.location === "object" ? (p.location as Record<string, unknown>) : undefined,
  };
}

/** Build a PlacePayload (name + community-typed encodings) from place details. */
export function detailsToPayload(d: PlaceDetails): PlacePayload {
  const location: LocationEncoding[] = [];
  const hasGeo = d.latitude != null && d.longitude != null;
  const lat = hasGeo ? String(d.latitude) : undefined;
  const lng = hasGeo ? String(d.longitude) : undefined;

  if (hasGeo) {
    location.push({ $type: ids.CommunityLexiconLocationGeo, latitude: lat, longitude: lng, name: d.name });
  }

  const loc = d.location ?? {};
  const country = loc.country;
  if (typeof country === "string" && country) {
    const addr: LocationEncoding = { $type: ids.CommunityLexiconLocationAddress, country, name: d.name };
    if (typeof loc.address === "string") addr.street = loc.address;
    if (typeof loc.locality === "string") addr.locality = loc.locality;
    if (typeof loc.region === "string") addr.region = loc.region;
    if (typeof loc.postcode === "string") addr.postalCode = loc.postcode;
    location.push(addr);
  }

  if (d.fsqPlaceId) {
    const fsq: LocationEncoding = { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: d.fsqPlaceId, name: d.name };
    if (hasGeo) { fsq.latitude = lat; fsq.longitude = lng; }
    location.push(fsq);
  }

  return { name: d.name, location };
}

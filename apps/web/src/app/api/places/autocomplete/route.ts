import { autocompleteUrl, fsqHeaders, mapAutocomplete } from "../../../../lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q");
  const session = params.get("session") ?? "";
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return Response.json({ error: "place search not configured" }, { status: 503 });
  const res = await fetch(autocompleteUrl(q, session), { headers: fsqHeaders(key) });
  if (!res.ok) return Response.json({ error: "upstream error" }, { status: 502 });
  return Response.json({ results: mapAutocomplete(await res.json()) });
}

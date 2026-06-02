import { detailsUrl, fsqHeaders, mapDetails, detailsToPayload } from "../../../../lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const session = url.searchParams.get("session") ?? undefined;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return Response.json({ error: "place search not configured" }, { status: 503 });
  const res = await fetch(detailsUrl(id, session), { headers: fsqHeaders(key) });
  if (!res.ok) return Response.json({ error: "upstream error" }, { status: 502 });
  return Response.json(detailsToPayload(mapDetails(await res.json())));
}

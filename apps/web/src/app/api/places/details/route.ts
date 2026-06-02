import { detailsUrl, fsqHeaders, mapDetails, detailsToPayload } from "../../../../lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return Response.json({ error: "place search not configured" }, { status: 503 });
  const res = await fetch(detailsUrl(id), { headers: fsqHeaders(key) });
  if (!res.ok) return Response.json({ error: "upstream error" }, { status: 502 });
  return Response.json(detailsToPayload(mapDetails(await res.json())));
}

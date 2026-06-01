import { buildClientMetadata, originFromHeaders } from "../../lib/oauth";

// Built per-request from the incoming origin so the document self-configures to
// whatever domain the app is deployed at (no hardcoded URL). atproto fetches
// this at the client_id URL during sign-in.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers } = request;
  const origin = originFromHeaders(
    (name) => headers.get(name),
    process.env.OAUTH_CLIENT_ORIGIN,
  );
  return Response.json(buildClientMetadata(origin), {
    headers: { "cache-control": "public, max-age=300" },
  });
}

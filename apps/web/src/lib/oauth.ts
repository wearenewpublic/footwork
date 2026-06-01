// Single source of truth for the OAuth scope and the public-client metadata.
// Imported by both the client (auth.tsx, which requests the scope) and the
// server route that serves /client-metadata.json — so the requested scope and
// the published scope can never drift (atproto rejects a request whose scope
// exceeds the client's published metadata).

/** atproto OAuth scope: base session + write access to the collections we create. */
export const SCOPE = [
  "atproto",
  "repo:town.roundabout.guide.document",
  "repo:town.roundabout.guide.place",
  "repo:community.lexicon.calendar.event",
  "repo:town.roundabout.guide.venueReview",
  "repo:town.roundabout.guide.save",
].join(" ");

/**
 * The atproto public-client metadata document, self-configured to `origin`.
 *
 * atproto requires: `client_id` exactly equals the URL the document is served
 * at; a public client (`token_endpoint_auth_method: "none"`) with
 * `dpop_bound_access_tokens: true`; and a `scope` that includes `atproto`.
 */
export function buildClientMetadata(origin: string) {
  return {
    client_id: `${origin}/client-metadata.json`,
    client_name: "Guides",
    client_uri: origin,
    redirect_uris: [`${origin}/auth/callback`] as [string],
    scope: SCOPE,
    grant_types: ["authorization_code", "refresh_token"] as const,
    response_types: ["code"] as const,
    token_endpoint_auth_method: "none" as const,
    application_type: "web" as const,
    dpop_bound_access_tokens: true,
  };
}

/**
 * Resolve the public origin the app is served at, for building the metadata.
 *
 * Precedence: an explicit `OAUTH_CLIENT_ORIGIN` env override (trailing slash
 * stripped) → `x-forwarded-proto`/`x-forwarded-host` (set by reverse proxies
 * like Vercel/nginx) → the `host` header, defaulting to `https`.
 */
export function originFromHeaders(
  get: (name: string) => string | null,
  envOrigin?: string,
): string {
  if (envOrigin) return envOrigin.replace(/\/+$/, "");
  const proto = get("x-forwarded-proto") ?? "https";
  const host = get("x-forwarded-host") ?? get("host") ?? "localhost";
  return `${proto}://${host}`;
}

# Deployment — production OAuth (`@guides/web`)

The editor authenticates with the AT Protocol via **client-side OAuth**
(`@atproto/oauth-client-browser`). There are two client modes, selected at
runtime in `apps/web/src/lib/auth.tsx` by inspecting the browser origin:

- **Local dev** — a *loopback* client: `client_id` is a synthetic
  `http://localhost?...` URL carrying the scope and a `127.0.0.1` redirect.
  No hosted document is involved. (atproto requires the `127.0.0.1` host, not
  `localhost`, so `AuthProvider` redirects `localhost → 127.0.0.1`.)
- **Production** — a *discoverable* client: `client_id` is
  `${origin}/client-metadata.json`, a document atproto fetches over HTTPS during
  sign-in.

This doc covers the production path.

## What the app serves

`apps/web/src/app/client-metadata.json/route.ts` serves the client metadata
**dynamically**, built from the request origin by `buildClientMetadata()` in
`src/lib/oauth.ts`. It self-configures to whatever domain the app is deployed
at — there is no hardcoded URL to keep in sync. The scope is shared with
`auth.tsx` from `oauth.ts`, so the requested scope and the published scope can
never drift (atproto rejects a sign-in whose scope exceeds the published
metadata).

The served document is a public client bound to DPoP, e.g. for
`https://guides.roundabout.town`:

```json
{
  "client_id": "https://guides.roundabout.town/client-metadata.json",
  "client_name": "Guides",
  "client_uri": "https://guides.roundabout.town",
  "redirect_uris": ["https://guides.roundabout.town/auth/callback"],
  "scope": "atproto repo:town.roundabout.guide.document repo:town.roundabout.guide.place repo:community.lexicon.calendar.event repo:town.roundabout.guide.save",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

(Verified valid against `@atproto/oauth-types`' `oauthClientMetadataSchema`.)

## Deploy requirements

1. **Serve over HTTPS at a stable public origin.** atproto fetches
   `client_id` over the internet; the host must resolve publicly and present a
   valid TLS cert. The `client_id`, `client_uri`, and `redirect_uris` must all
   share that origin.
2. **Origin detection.** The route derives the origin from
   `x-forwarded-proto` / `x-forwarded-host` (set by reverse proxies such as
   Vercel, fly.io, nginx), falling back to the `host` header with an `https`
   default. If your proxy does **not** set those headers correctly, set the
   origin explicitly:

   ```
   OAUTH_CLIENT_ORIGIN=https://guides.roundabout.town
   ```

3. **Callback route.** The redirect URI is `${origin}/auth/callback`, served by
   `src/app/auth/callback/page.tsx`. No extra config — just keep the path.
4. **Build/run.** `pnpm install` (builds `@guides/lexicons` `dist/` via its
   `prepare` hook) → `pnpm --filter @guides/web build` → `next start`.

## Verifying the hosted flow (do this once, post-deploy)

The metadata serving + schema validity are covered by `src/lib/oauth.test.ts`
and a local `next start` curl check. The end-to-end OAuth round-trip can only be
exercised against the live HTTPS deployment:

1. `curl https://<your-domain>/client-metadata.json` — confirm `client_id`
   equals that exact URL and the origin is `https://`.
2. Open the deployed editor, sign in with a real handle. atproto fetches the
   metadata, you authorize at your PDS, and are redirected to `/auth/callback`.
3. Confirm the session restores on reload and that publishing a guide writes to
   your PDS (the round-trip then flows through the AppView as in
   `docs/superpowers/notes/2026-05-31-live-roundtrip.md`).

If sign-in fails, the usual causes are: a non-HTTPS origin, `client_id` not
matching the fetched URL (proxy origin mismatch — set `OAUTH_CLIENT_ORIGIN`),
or a requested scope exceeding the published one (shouldn't happen — both come
from `SCOPE` in `oauth.ts`).

## Place search (Foursquare)

The editor's place search proxies the **Foursquare Places API** server-side
(`apps/web/src/app/api/places/{autocomplete,details}`). We use Foursquare —
backed by the open-licensed Open Source Places dataset — rather than Google,
because Google's Maps Platform terms forbid storing Places content (name /
address / lat-lng) in public, permanent atproto records rendered on non-Google
maps; Foursquare's data is storable and redistributable, and the community
`fsq` location lexicon models it.

Set **`FOURSQUARE_API_KEY`** (a Foursquare Places *Service* key) as a
**server-only** env var — never in the client bundle:

- **Local:** `apps/web/.env.local` (gitignored):
  ```
  FOURSQUARE_API_KEY=<your-key>
  ```
- **Sprite:** set it on the `web` service env. When (re)creating the service:
  ```
  sprite-env services create web --cmd /home/sprite/footwork/scripts/run-web.sh \
    --http-port 8080 --needs appview --env FOURSQUARE_API_KEY=<your-key>
  ```
  (or add it to `scripts/run-web.sh` as an exported var). Restart the `web`
  service after changing it.

Get a key at the [Foursquare developer portal](https://docs.foursquare.com/)
(create an account → a project → a Places Service API key). Without the key,
`/api/places/*` return `503` and the editor's search box shows "search
unavailable" — the rest of the app is unaffected. Attribution ("Powered by
Foursquare") is shown in the search UI.

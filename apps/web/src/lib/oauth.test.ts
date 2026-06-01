import { describe, expect, test } from "vitest";
import { SCOPE, buildClientMetadata, originFromHeaders } from "./oauth";

describe("buildClientMetadata", () => {
  const origin = "https://guides.example.com";
  const meta = buildClientMetadata(origin);

  test("client_id is the served metadata URL (atproto requires exact match)", () => {
    expect(meta.client_id).toBe("https://guides.example.com/client-metadata.json");
  });

  test("redirect_uri points at the app's /auth/callback on the same origin", () => {
    expect(meta.redirect_uris).toEqual(["https://guides.example.com/auth/callback"]);
  });

  test("publishes exactly the scope the client requests (no drift)", () => {
    expect(meta.scope).toBe(SCOPE);
    expect(meta.scope.split(" ")).toContain("atproto");
  });

  test("is a public client bound to DPoP (atproto requirements)", () => {
    expect(meta.token_endpoint_auth_method).toBe("none");
    expect(meta.dpop_bound_access_tokens).toBe(true);
    expect(meta.response_types).toEqual(["code"]);
    expect(meta.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(meta.application_type).toBe("web");
  });
});

describe("originFromHeaders", () => {
  const h = (map: Record<string, string>) => (name: string) => map[name.toLowerCase()] ?? null;

  test("an explicit env origin wins (strips trailing slash)", () => {
    expect(originFromHeaders(h({}), "https://guides.example.com/")).toBe("https://guides.example.com");
  });

  test("derives from x-forwarded-proto + x-forwarded-host behind a proxy", () => {
    const get = h({ "x-forwarded-proto": "https", "x-forwarded-host": "guides.example.com" });
    expect(originFromHeaders(get)).toBe("https://guides.example.com");
  });

  test("falls back to host and defaults to https", () => {
    expect(originFromHeaders(h({ host: "guides.example.com" }))).toBe("https://guides.example.com");
  });
});

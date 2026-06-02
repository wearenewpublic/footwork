import { describe, expect, it } from "vitest";
import { ids } from "@guides/lexicons";
import { autocompleteUrl, detailsUrl, fsqHeaders, mapAutocomplete, mapDetails, detailsToPayload } from "./places";

describe("places request builders", () => {
  it("builds the autocomplete URL with query, types, session, limit", () => {
    const u = new URL(autocompleteUrl("tartine", "sess123"));
    expect(u.origin + u.pathname).toBe("https://places-api.foursquare.com/autocomplete");
    expect(u.searchParams.get("query")).toBe("tartine");
    expect(u.searchParams.get("types")).toBe("place");
    expect(u.searchParams.get("session_token")).toBe("sess123");
    expect(u.searchParams.get("limit")).toBe("8");
  });

  it("builds the details URL with fields", () => {
    const u = new URL(detailsUrl("abc 123"));
    expect(u.pathname).toBe("/places/abc%20123");
    expect(u.searchParams.get("fields")).toBe("fsq_place_id,name,latitude,longitude,location");
  });

  it("sets bearer auth + version header", () => {
    expect(fsqHeaders("KEY")).toEqual({
      Authorization: "Bearer KEY",
      "X-Places-Api-Version": "2025-06-17",
      Accept: "application/json",
    });
  });
});

describe("mapAutocomplete (defensive: place id + label)", () => {
  it("extracts place suggestions, skipping non-place results", () => {
    const json = { results: [
      { type: "place", place: { fsq_place_id: "p1", name: "Tartine", location: { address: "600 Guerrero St" } }, text: { primary: "Tartine", secondary: "600 Guerrero St, San Francisco" } },
      { type: "geo", text: { primary: "San Francisco" } },
    ] };
    expect(mapAutocomplete(json)).toEqual([
      { fsqPlaceId: "p1", name: "Tartine", formatted: "600 Guerrero St, San Francisco" },
    ]);
  });
  it("returns [] for a non-array body", () => {
    expect(mapAutocomplete({})).toEqual([]);
  });
  it("tolerates null/odd elements in results", () => {
    const json = { results: [null, "weird", { place: { fsq_place_id: "p9", name: "Joe's" }, text: { secondary: "1 Main St" } }] };
    expect(mapAutocomplete(json)).toEqual([{ fsqPlaceId: "p9", name: "Joe's", formatted: "1 Main St" }]);
  });
});

describe("mapDetails + detailsToPayload", () => {
  const detailsJson = {
    fsq_place_id: "p1", name: "Tartine", latitude: 37.7615, longitude: -122.4241,
    location: { address: "600 Guerrero St", locality: "San Francisco", region: "CA", postcode: "94110", country: "US" },
  };

  it("maps details to our shape", () => {
    expect(mapDetails(detailsJson)).toEqual({
      fsqPlaceId: "p1", name: "Tartine", latitude: 37.7615, longitude: -122.4241,
      location: { address: "600 Guerrero St", locality: "San Francisco", region: "CA", postcode: "94110", country: "US" },
    });
  });

  it("builds geo + address + fsq encodings from details", () => {
    const payload = detailsToPayload(mapDetails(detailsJson));
    expect(payload.name).toBe("Tartine");
    expect(payload.location).toEqual([
      { $type: ids.CommunityLexiconLocationGeo, latitude: "37.7615", longitude: "-122.4241", name: "Tartine" },
      { $type: ids.CommunityLexiconLocationAddress, country: "US", name: "Tartine", street: "600 Guerrero St", locality: "San Francisco", region: "CA", postalCode: "94110" },
      { $type: ids.CommunityLexiconLocationFsq, fsq_place_id: "p1", name: "Tartine", latitude: "37.7615", longitude: "-122.4241" },
    ]);
  });

  it("skips the address encoding when country is absent (lexicon requires country)", () => {
    const payload = detailsToPayload(mapDetails({ fsq_place_id: "p2", name: "X", latitude: 1, longitude: 2, location: { locality: "Nowhere" } }));
    expect(payload.location?.some((l) => l.$type === ids.CommunityLexiconLocationAddress)).toBe(false);
    expect(payload.location?.map((l) => l.$type)).toEqual([ids.CommunityLexiconLocationGeo, ids.CommunityLexiconLocationFsq]);
  });
});

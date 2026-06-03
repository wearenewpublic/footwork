import { describe, expect, it } from "vitest";
import { ids } from "@guides/lexicons";
import { searchUrl, fsqHeaders, mapDetails, detailsToPayload, mapSearch } from "./places";

describe("searchUrl", () => {
  it("builds the search URL with query, fields, limit", () => {
    const u = new URL(searchUrl("blue bottle coffee"));
    expect(u.origin + u.pathname).toBe("https://places-api.foursquare.com/places/search");
    expect(u.searchParams.get("query")).toBe("blue bottle coffee");
    expect(u.searchParams.get("fields")).toBe("fsq_place_id,name,latitude,longitude,location");
    expect(u.searchParams.get("limit")).toBe("8");
    expect(u.searchParams.get("near")).toBeNull();
  });
  it("includes near when provided", () => {
    expect(new URL(searchUrl("coffee", "San Francisco, CA")).searchParams.get("near")).toBe("San Francisco, CA");
  });
});

describe("fsqHeaders", () => {
  it("sets bearer auth + version header", () => {
    expect(fsqHeaders("KEY")).toEqual({
      Authorization: "Bearer KEY",
      "X-Places-Api-Version": "2025-06-17",
      Accept: "application/json",
    });
  });
});

describe("mapSearch", () => {
  it("maps search results to name + formatted + full payload, reusing the detail mapping", () => {
    const json = { results: [
      { fsq_place_id: "p1", name: "Blue Bottle Coffee", latitude: 37.7764, longitude: -122.4232,
        location: { address: "315 Linden St", locality: "San Francisco", region: "CA", postcode: "94102", country: "US", formatted_address: "315 Linden St, San Francisco, CA 94102" } },
    ] };
    const out = mapSearch(json);
    expect(out).toHaveLength(1);
    expect(out[0].fsqPlaceId).toBe("p1");
    expect(out[0].name).toBe("Blue Bottle Coffee");
    expect(out[0].formatted).toBe("315 Linden St, San Francisco, CA 94102");
    expect(out[0].payload.location?.map((l) => l.$type)).toEqual([
      ids.CommunityLexiconLocationGeo, ids.CommunityLexiconLocationAddress, ids.CommunityLexiconLocationFsq,
    ]);
    expect(out[0].payload.location?.[0]).toEqual({ $type: ids.CommunityLexiconLocationGeo, latitude: "37.7764", longitude: "-122.4232", name: "Blue Bottle Coffee" });
  });
  it("returns [] for a non-array body", () => { expect(mapSearch({})).toEqual([]); });
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

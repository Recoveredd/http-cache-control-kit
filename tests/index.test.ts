import { describe, expect, it } from "vitest";
import {
  formatCacheControl,
  getCacheControlDeltaSeconds,
  hasCacheControlDirective,
  parseCacheControl
} from "../src/index.js";

describe("parseCacheControl", () => {
  it("parses common response directives into a stable map", () => {
    const result = parseCacheControl("public, max-age=3600, stale-while-revalidate=30");

    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      public: true,
      "max-age": "3600",
      "stale-while-revalidate": "30"
    });
    expect(getCacheControlDeltaSeconds(result, "max-age")).toBe(3600);
    expect(hasCacheControlDirective(result, "PUBLIC")).toBe(true);
  });

  it("keeps commas inside quoted values", () => {
    const result = parseCacheControl('private="Authorization, Cookie", no-store');

    expect(result.ok).toBe(true);
    expect(result.values.private).toBe("Authorization, Cookie");
    expect(result.values["no-store"]).toBe(true);
  });

  it("unescapes quoted values without splitting escaped commas", () => {
    const result = parseCacheControl('private="Authorization, \\"Session\\", Cookie", no-store');

    expect(result.ok).toBe(true);
    expect(result.values.private).toBe('Authorization, "Session", Cookie');
    expect(result.directives).toHaveLength(2);
  });

  it("reports empty and non-string input without throwing", () => {
    expect(parseCacheControl("").diagnostics.map((item) => item.code)).toEqual(["empty-input"]);
    expect(parseCacheControl(null).diagnostics.map((item) => item.code)).toEqual(["expected-string"]);
  });

  it("reports duplicate directives and keeps the first value", () => {
    const result = parseCacheControl("max-age=60, max-age=120");

    expect(result.ok).toBe(false);
    expect(result.values["max-age"]).toBe("60");
    expect(result.diagnostics.map((item) => item.code)).toEqual(["duplicate-directive"]);
  });

  it("can allow duplicate directives when callers need raw inspection", () => {
    const result = parseCacheControl("max-age=60, max-age=120", { allowDuplicates: true });

    expect(result.ok).toBe(true);
    expect(result.directives).toHaveLength(2);
    expect(result.values["max-age"]).toBe("120");
  });

  it("reports missing or invalid delta-seconds values", () => {
    const missing = parseCacheControl("max-age");
    const invalid = parseCacheControl("s-maxage=-1");

    expect(missing.diagnostics.map((item) => item.code)).toEqual(["missing-value"]);
    expect(invalid.diagnostics.map((item) => item.code)).toEqual(["invalid-delta-seconds"]);
    expect(getCacheControlDeltaSeconds(invalid, "s-maxage")).toBeUndefined();
  });

  it("accepts valueless max-stale and validates max-stale when a value is present", () => {
    const valueless = parseCacheControl("max-stale, min-fresh=30");
    const valued = parseCacheControl("max-stale=120");
    const invalid = parseCacheControl("max-stale=soon");

    expect(valueless.ok).toBe(true);
    expect(valueless.values["max-stale"]).toBe(true);
    expect(getCacheControlDeltaSeconds(valueless, "max-stale")).toBeUndefined();
    expect(valued.ok).toBe(true);
    expect(getCacheControlDeltaSeconds(valued, "max-stale")).toBe(120);
    expect(invalid.diagnostics.map((item) => item.code)).toEqual(["invalid-delta-seconds"]);
  });

  it("recognizes modern response directives", () => {
    const result = parseCacheControl("must-understand, no-store");

    expect(result.ok).toBe(true);
    expect(result.values["must-understand"]).toBe(true);
  });

  it("reports unknown directives unless explicitly allowed", () => {
    expect(parseCacheControl("x-preview=on").diagnostics.map((item) => item.code)).toEqual([
      "unknown-directive"
    ]);
    expect(parseCacheControl("x-preview=on", { allowUnknown: true }).ok).toBe(true);
  });

  it("reports invalid quoted values", () => {
    const result = parseCacheControl('private="authorization');
    const trailing = parseCacheControl('private="authorization" extra');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(["invalid-quoted-string"]);
    expect(trailing.ok).toBe(false);
    expect(trailing.diagnostics.map((item) => item.code)).toEqual(["invalid-quoted-string"]);
  });
});

describe("formatCacheControl", () => {
  it("formats object values into a header", () => {
    expect(
      formatCacheControl({
        public: true,
        "max-age": "3600",
        "no-store": false
      })
    ).toBe("public, max-age=3600");
  });

  it("quotes values with separators and can sort output", () => {
    expect(
      formatCacheControl(
        {
          private: "Authorization, Cookie",
          "max-age": "60"
        },
        { sort: true }
      )
    ).toBe('max-age=60, private="Authorization, Cookie"');
  });

  it("supports explicit quote modes", () => {
    expect(formatCacheControl({ private: "Authorization" }, { quoteValues: "always" })).toBe(
      'private="Authorization"'
    );
    expect(formatCacheControl({ private: "Authorization, Cookie" }, { quoteValues: "never" })).toBe(
      "private=Authorization, Cookie"
    );
  });
});

import { describe, it, expect } from "vitest";
import {
  computeShipping,
  generateOrderNumber,
  slugify,
  truncate,
  formatDate,
  discountPct,
  classNames,
  FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING,
} from "../../src/lib/utils";

describe("computeShipping", () => {
  it("returns 0 for zero subtotal", () => {
    expect(computeShipping(0)).toBe(0);
  });
  it("returns 0 for negative subtotal", () => {
    expect(computeShipping(-10)).toBe(0);
  });
  it("charges flat shipping below threshold", () => {
    expect(computeShipping(499)).toBe(FLAT_SHIPPING);
  });
  it("charges flat shipping just below threshold", () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD - 0.01)).toBe(FLAT_SHIPPING);
  });
  it("returns 0 at exactly the threshold", () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });
  it("returns 0 above threshold", () => {
    expect(computeShipping(1000)).toBe(0);
  });
});

describe("generateOrderNumber", () => {
  it("starts with JA-", () => {
    expect(generateOrderNumber()).toMatch(/^JA-/);
  });
  it("matches JA-YYYYMMDD-XXXXX format", () => {
    expect(generateOrderNumber()).toMatch(/^JA-\d{8}-[A-Z0-9]{5}$/);
  });
  it("generates unique numbers", () => {
    const nums = new Set(Array.from({ length: 20 }, generateOrderNumber));
    expect(nums.size).toBeGreaterThan(1);
  });
});

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Paracetamol")).toBe("paracetamol");
  });
  it("replaces spaces with hyphens", () => {
    expect(slugify("Jan Aushadhi Store")).toBe("jan-aushadhi-store");
  });
  it("strips leading/trailing hyphens", () => {
    expect(slugify(" -hello- ")).toBe("hello");
  });
  it("collapses multiple separators", () => {
    expect(slugify("a  b---c")).toBe("a-b-c");
  });
  it("truncates at 90 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(90);
  });
  it("handles special chars", () => {
    expect(slugify("Vitamin C (500mg)")).toBe("vitamin-c-500mg");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates long strings with ellipsis", () => {
    const result = truncate("hello world", 5);
    expect(result).toContain("…");
    expect(result.startsWith("hello")).toBe(true);
  });
  it("uses default length of 120", () => {
    const long = "a".repeat(130);
    expect(truncate(long)).toContain("…");
    expect(truncate(long).length).toBeLessThan(130);
  });
  it("exact length returns unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});

describe("formatDate", () => {
  it("returns a non-empty string", () => {
    expect(formatDate("2024-01-15")).toBeTruthy();
  });
  it("includes the year", () => {
    expect(formatDate("2024-01-15")).toContain("2024");
  });
});

describe("discountPct", () => {
  it("returns 0 when no discount", () => {
    expect(discountPct(100, 100)).toBe(0);
  });
  it("returns 0 when price > mrp", () => {
    expect(discountPct(50, 100)).toBe(0);
  });
  it("calculates correct discount", () => {
    expect(discountPct(100, 70)).toBe(30);
  });
  it("rounds correctly", () => {
    expect(discountPct(300, 200)).toBe(33);
  });
  it("returns 0 for zero mrp", () => {
    expect(discountPct(0, 10)).toBe(0);
  });
});

describe("classNames", () => {
  it("joins truthy values", () => {
    expect(classNames("a", "b", "c")).toBe("a b c");
  });
  it("filters falsy values", () => {
    expect(classNames("a", false, null, undefined, "b")).toBe("a b");
  });
  it("returns empty string for all falsy", () => {
    expect(classNames(false, null, undefined)).toBe("");
  });
});

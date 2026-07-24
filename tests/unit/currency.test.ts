import { describe, it, expect } from "vitest";
import {
  isCurrency,
  convert,
  formatMoney,
  currencySymbol,
  RATES,
  DEFAULT_CURRENCY,
} from "../../src/lib/currency";

describe("isCurrency", () => {
  it("accepts valid currencies", () => {
    expect(isCurrency("INR")).toBe(true);
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("GBP")).toBe(true);
  });
  it("rejects invalid strings", () => {
    expect(isCurrency("JPY")).toBe(false);
    expect(isCurrency("")).toBe(false);
    expect(isCurrency(undefined)).toBe(false);
  });
});

describe("convert", () => {
  it("INR → INR is identity", () => {
    expect(convert(100, "INR")).toBe(100);
  });
  it("applies correct rate for USD", () => {
    expect(convert(100, "USD")).toBeCloseTo(100 * RATES.USD, 5);
  });
  it("handles zero", () => {
    expect(convert(0, "USD")).toBe(0);
  });
});

describe("formatMoney", () => {
  it("returns a string with currency symbol for INR", () => {
    const result = formatMoney(100, "INR");
    expect(result).toContain("₹");
  });
  it("returns string for USD", () => {
    const result = formatMoney(1000, "USD");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
  it("formats zero correctly", () => {
    const result = formatMoney(0, "INR");
    expect(result).toContain("0");
  });
});

describe("currencySymbol", () => {
  it("returns ₹ for INR", () => {
    expect(currencySymbol("INR")).toBe("₹");
  });
  it("returns $ for USD", () => {
    expect(currencySymbol("USD")).toBe("$");
  });
  it("returns € for EUR", () => {
    expect(currencySymbol("EUR")).toBe("€");
  });
  it("returns £ for GBP", () => {
    expect(currencySymbol("GBP")).toBe("£");
  });
});

describe("DEFAULT_CURRENCY", () => {
  it("is INR", () => {
    expect(DEFAULT_CURRENCY).toBe("INR");
  });
});

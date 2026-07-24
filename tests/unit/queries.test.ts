import { describe, it, expect, vi, beforeEach } from "vitest";
import { averageRating } from "../../src/lib/queries";
import type { Review } from "../../src/lib/types";

function makeReview(rating: number): Review {
  return {
    id: crypto.randomUUID(),
    product_id: "p1",
    user_id: "u1",
    rating,
    title: null,
    comment: null,
    created_at: new Date().toISOString(),
  };
}

describe("averageRating", () => {
  it("returns 0 for empty array", () => {
    expect(averageRating([])).toBe(0);
  });
  it("returns single rating unchanged", () => {
    expect(averageRating([makeReview(4)])).toBe(4);
  });
  it("calculates mean rounded to 1dp", () => {
    const reviews = [makeReview(4), makeReview(5), makeReview(3)];
    expect(averageRating(reviews)).toBe(4); // (4+5+3)/3 = 4
  });
  it("rounds to 1 decimal place", () => {
    const reviews = [makeReview(4), makeReview(5)];
    expect(averageRating(reviews)).toBe(4.5);
  });
  it("handles all 5s", () => {
    const reviews = Array.from({ length: 10 }, () => makeReview(5));
    expect(averageRating(reviews)).toBe(5);
  });
  it("handles all 1s", () => {
    const reviews = Array.from({ length: 5 }, () => makeReview(1));
    expect(averageRating(reviews)).toBe(1);
  });
});

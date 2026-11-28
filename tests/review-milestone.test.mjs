import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewMilestone } from "../lib/review-milestone.ts";

test("milestone rounds the verified count down, never up", () => {
  assert.equal(reviewMilestone({ rating: 5, reviewCount: 491 }).figure, "400+");
  assert.equal(reviewMilestone({ rating: 5, reviewCount: 499 }).figure, "400+");
  assert.equal(reviewMilestone({ rating: 5, reviewCount: 500 }).figure, "500+");
  assert.equal(reviewMilestone({ rating: 5, reviewCount: 587 }).figure, "500+");
});

test("milestone keeps the exact count and rating label", () => {
  const result = reviewMilestone({ rating: 5, reviewCount: 500 });
  assert.equal(result.count, 500);
  assert.equal(result.milestone, 500);
  assert.equal(result.ratingLabel, "5.0");
  assert.equal(result.summary, "500+ Google reviews with a 5.0 out of 5 rating");
});

test("counts under one hundred are shown exactly without a plus", () => {
  const result = reviewMilestone({ rating: 4.8, reviewCount: 42 });
  assert.equal(result.figure, "42");
  assert.equal(result.milestone, 42);
  assert.equal(result.summary, "42 Google reviews with a 4.8 out of 5 rating");
});

test("milestone card avoids unsupported ranking and all-five-star claims", async () => {
  const card = await readFile(new URL("../app/components/ReviewMilestoneCard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /#1|number one|5-star google reviews|five-star google reviews/i);
  assert.match(card, /googleBusiness/);
  assert.match(card, /listingUrl/);
});

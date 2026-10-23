import { describe, expect, it } from "vitest";
import { CAROUSEL_HOLD_MS, CAROUSEL_TRANSITION_MS, nextSlide, swipeDirection } from "@/lib/home-motion";

describe("Homepage carousel rules", () => {
  it("holds each image for one second", () => { expect(CAROUSEL_HOLD_MS).toBe(1000); });
  it("transitions in 0.4 seconds", () => { expect(CAROUSEL_TRANSITION_MS).toBe(400); });
  it("advances on a left swipe", () => { expect(nextSlide(0, swipeDirection(180, 80), 3)).toBe(1); });
  it("returns to the previous image on a right swipe", () => { expect(nextSlide(0, swipeDirection(80, 180), 3)).toBe(2); });
  it("does not change images on a tap", () => { expect(swipeDirection(80, 82)).toBe(0); });
});
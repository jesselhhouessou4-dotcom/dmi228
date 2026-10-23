export const CAROUSEL_HOLD_MS = 1000;
export const CAROUSEL_TRANSITION_MS = 400;
export const SWIPE_THRESHOLD_PX = 40;

export function swipeDirection(start: number, end: number): -1 | 0 | 1 {
  const distance = start - end;
  return Math.abs(distance) < SWIPE_THRESHOLD_PX ? 0 : distance > 0 ? 1 : -1;
}

export function nextSlide(current: number, direction: number, count: number) {
  return count > 0 ? (current + direction + count) % count : 0;
}
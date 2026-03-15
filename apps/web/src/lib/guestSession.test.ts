import { describe, it, expect, beforeEach } from 'vitest';
import {
  GUEST_LIMIT,
  ALTAR_QUIPS,
  getGuestTurns,
  incrementGuestTurns,
  resetGuestTurns,
  isGuestLimitReached,
  randomQuip,
} from './guestSession';

beforeEach(() => {
  localStorage.clear();
});

describe('guestSession', () => {
  it('starts at 0 turns', () => {
    expect(getGuestTurns()).toBe(0);
  });

  it('increments turns', () => {
    incrementGuestTurns();
    incrementGuestTurns();
    expect(getGuestTurns()).toBe(2);
  });

  it('persists across calls (localStorage)', () => {
    incrementGuestTurns();
    expect(getGuestTurns()).toBe(1);
  });

  it('limit not reached below threshold', () => {
    for (let i = 0; i < GUEST_LIMIT - 1; i++) incrementGuestTurns();
    expect(isGuestLimitReached()).toBe(false);
  });

  it('limit reached at threshold', () => {
    for (let i = 0; i < GUEST_LIMIT; i++) incrementGuestTurns();
    expect(isGuestLimitReached()).toBe(true);
  });

  it('reset clears counter', () => {
    incrementGuestTurns();
    resetGuestTurns();
    expect(getGuestTurns()).toBe(0);
    expect(isGuestLimitReached()).toBe(false);
  });

  it('randomQuip returns a non-empty string from ALTAR_QUIPS', () => {
    const q = randomQuip();
    expect(typeof q).toBe('string');
    expect(q.length).toBeGreaterThan(0);
    expect(ALTAR_QUIPS).toContain(q);
  });
});

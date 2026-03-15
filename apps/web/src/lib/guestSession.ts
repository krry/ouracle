const KEY = 'clea_guest_turns';
export const GUEST_LIMIT = 5;

export const ALTAR_QUIPS: string[] = [
  "the sacrificial fire needs tending — return when you've spoken your name.",
  "i must attend the altar now. the smoke still carries your questions.",
  "three ravens wait at the threshold. you'll need a name to cross it.",
  "the ritual demands i pause here. seek me again, seeker-with-a-name.",
  "the incense burns low. step forward and be known.",
];

export function getGuestTurns(): number {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(KEY);
  return v ? parseInt(v, 10) : 0;
}

export function incrementGuestTurns(): void {
  localStorage.setItem(KEY, String(getGuestTurns() + 1));
}

export function resetGuestTurns(): void {
  localStorage.removeItem(KEY);
}

export function isGuestLimitReached(): boolean {
  return getGuestTurns() >= GUEST_LIMIT;
}

export function randomQuip(): string {
  return ALTAR_QUIPS[Math.floor(Math.random() * ALTAR_QUIPS.length)];
}

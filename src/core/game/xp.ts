/** Simple XP curve: level N needs 50 + 25*(N-1) XP */

export function xpRequiredForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return 50 + 25 * (lv - 1);
}

export function applyXp(
  level: number,
  xp: number,
  gained: number,
): { level: number; xp: number; leveledUp: boolean } {
  let lv = level;
  let cur = xp + gained;
  let leveledUp = false;
  let guard = 0;
  while (cur >= xpRequiredForLevel(lv) && guard < 100) {
    cur -= xpRequiredForLevel(lv);
    lv += 1;
    leveledUp = true;
    guard += 1;
  }
  return { level: lv, xp: cur, leveledUp };
}

export function randomInt(min: number, max: number, rng: () => number = Math.random): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return a + Math.floor(rng() * (b - a + 1));
}

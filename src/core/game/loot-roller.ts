import type { DropTable, ItemDef, Rarity } from './types';

export function rollWeighted<T extends { weight: number }>(
  entries: T[],
  rng: () => number = Math.random,
): T | null {
  if (entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of entries) {
    r -= Math.max(0, e.weight);
    if (r <= 0) return e;
  }
  return entries[entries.length - 1] ?? null;
}

export function rollLoot(
  table: DropTable,
  itemsById: Map<string, ItemDef>,
  rng: () => number = Math.random,
): ItemDef | null {
  const hit = rollWeighted(table.entries, rng);
  if (!hit) return null;
  return itemsById.get(hit.itemId) ?? null;
}

/** Soft check that higher rarities are rarer via table weights (for tests/docs). */
export function rarityWeightSum(table: DropTable): Record<Rarity, number> {
  const out: Record<Rarity, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  for (const e of table.entries) {
    out[e.rarity] = (out[e.rarity] ?? 0) + e.weight;
  }
  return out;
}

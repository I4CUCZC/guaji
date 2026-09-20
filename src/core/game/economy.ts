/** World shop / salvage / enhance economy — soft numbers, Space-first */

import type { ItemDef, Rarity } from './types';
import { RARITY_ORDER } from './types';

export const ENHANCE_CAP = 9;

/** Soft % power per enhance level (mid of 6–8%). */
export const ENHANCE_POWER_PER_LEVEL = 0.07;

/** Extra effective power at milestones (+3 / +6 / +9). */
export const ENHANCE_MILESTONE_BONUS: Record<number, number> = {
  3: 0.02,
  6: 0.03,
  9: 0.04,
};

/**
 * Fragments returned when salvaging one piece of that rarity.
 * Pull cost = salvage × 10 so ~10 same-rarity salvages ≈ 1 pull.
 */
export const SALVAGE_FRAGMENTS: Record<Rarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 8,
  epic: 20,
  legendary: 50,
};

/** Shop pull cost in world fragments by target rarity. */
export const SHOP_PULL_COST: Record<Rarity, number> = {
  common: 10,
  uncommon: 30,
  rare: 80,
  epic: 200,
  legendary: 500,
};

/**
 * Base success chance to go from `fromLevel` → fromLevel+1.
 * Fail consumes fodder only; main never downgrades (MVP).
 */
export const ENHANCE_SUCCESS_RATE: number[] = [
  1.0, // 0→1
  0.9, // 1→2
  0.8, // 2→3
  0.7, // 3→4
  0.55, // 4→5
  0.4, // 5→6
  0.3, // 6→7
  0.2, // 7→8
  0.12, // 8→9
];

/** Soft pity: after this many consecutive fails, add bonus per extra fail. */
export const ENHANCE_PITY_START = 3;
export const ENHANCE_PITY_BONUS_PER_FAIL = 0.12;

export function clampEnhanceLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(ENHANCE_CAP, Math.floor(level)));
}

/** Effective power multiplier from enhance level (gear contribution / skills scale). */
export function enhancePowerMul(level: number): number {
  const lv = clampEnhanceLevel(level);
  let mul = 1 + lv * ENHANCE_POWER_PER_LEVEL;
  for (const [ms, bonus] of Object.entries(ENHANCE_MILESTONE_BONUS)) {
    if (lv >= Number(ms)) mul += bonus;
  }
  return mul;
}

export function isEnhanceMilestone(level: number): boolean {
  return level === 3 || level === 6 || level === 9;
}

export function enhanceSuccessChance(
  fromLevel: number,
  consecutiveFails: number,
): number {
  if (fromLevel < 0 || fromLevel >= ENHANCE_CAP) return 0;
  const base = ENHANCE_SUCCESS_RATE[fromLevel] ?? 0;
  const extraFails = Math.max(0, consecutiveFails - ENHANCE_PITY_START);
  const pity = extraFails * ENHANCE_PITY_BONUS_PER_FAIL;
  return Math.min(1, base + pity);
}

export function salvageYield(item: ItemDef): number {
  return SALVAGE_FRAGMENTS[item.rarity] ?? 1;
}

export function shopPullCost(rarity: Rarity): number {
  return SHOP_PULL_COST[rarity];
}

/** Equippable gear of the target rarity for shop pulls (excludes junk). */
export function shopPoolForRarity(
  items: Iterable<ItemDef>,
  rarity: Rarity,
): ItemDef[] {
  return [...items].filter((i) => i.slot != null && i.rarity === rarity);
}

export function rarityLabelOrdered(): Rarity[] {
  return [...RARITY_ORDER];
}

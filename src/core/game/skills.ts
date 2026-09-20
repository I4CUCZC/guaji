import type {
  EquipmentMap,
  ItemDef,
  SkillBarLoadout,
  SkillDef,
  SkillSlotView,
} from './types';
import { SKILL_BAR_SIZE } from './types';

/** Skills unlocked by currently equipped gear (unique by skill id). */
export function getAvailableSkills(
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
): SkillDef[] {
  const out: SkillDef[] = [];
  const seen = new Set<string>();
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const item = itemsById.get(itemId);
    const skill = item?.skill;
    if (!skill || seen.has(skill.id)) continue;
    seen.add(skill.id);
    out.push(skill);
  }
  return out;
}

export function getSkillById(
  skillId: string | null | undefined,
  available: SkillDef[],
): SkillDef | null {
  if (!skillId) return null;
  return available.find((s) => s.id === skillId) ?? null;
}

/**
 * Keep skill bar valid: clear slots whose skill is no longer available.
 */
export function sanitizeSkillBar(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  const ids = new Set(available.map((s) => s.id));
  const next: SkillBarLoadout = [null, null, null];
  for (let i = 0; i < SKILL_BAR_SIZE; i++) {
    const id = bar[i];
    next[i] = id && ids.has(id) ? id : null;
  }
  return next;
}

/**
 * Assign skill to a bar slot (0..2). Passing null clears the slot.
 * Also removes the skill from other slots (one skill → one slot).
 */
export function assignSkillToBar(
  bar: SkillBarLoadout,
  slotIndex: number,
  skillId: string | null,
): SkillBarLoadout {
  if (slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return bar;
  const next: SkillBarLoadout = [...bar] as SkillBarLoadout;
  if (skillId) {
    for (let i = 0; i < SKILL_BAR_SIZE; i++) {
      if (next[i] === skillId) next[i] = null;
    }
  }
  next[slotIndex] = skillId;
  return next;
}

export function buildSkillSlotViews(
  bar: SkillBarLoadout,
  available: SkillDef[],
  cooldownRemaining: Record<string, number>,
): SkillSlotView[] {
  return bar.map((skillId) => {
    const skill = getSkillById(skillId, available);
    const cd = skill ? cooldownRemaining[skill.id] ?? 0 : 0;
    return {
      skillId,
      skill,
      cooldownRemainingMs: Math.max(0, cd),
      ready: !!skill && cd <= 0,
    };
  });
}

/** Auto-pick first empty slot for a newly available skill (optional UX helper). */
export function autoFillEmptySlots(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  const next = sanitizeSkillBar(bar, available);
  const used = new Set(next.filter(Boolean) as string[]);
  for (const skill of available) {
    if (used.has(skill.id)) continue;
    const empty = next.findIndex((s) => s === null);
    if (empty < 0) break;
    next[empty] = skill.id;
    used.add(skill.id);
  }
  return next;
}

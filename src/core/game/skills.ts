import type {
  EquipmentMap,
  ItemDef,
  SkillBarLoadout,
  SkillDef,
  SkillKind,
  SkillSlotView,
} from './types';
import { PASSIVE_SKILL_BAR_SIZE, SKILL_BAR_SIZE } from './types';

function withKind(skill: SkillDef, kind: SkillKind): SkillDef {
  return { ...skill, kind: skill.kind ?? kind };
}

/** Active skill unlocked by an item (`skill` unless explicitly kind:passive). */
export function getItemActiveSkill(item: ItemDef | undefined): SkillDef | null {
  if (!item) return null;
  if (item.skill && (item.skill.kind ?? 'active') === 'active') {
    return withKind(item.skill, 'active');
  }
  return null;
}

/**
 * Passive skill unlocked by an item.
 * Accepts dedicated `passiveSkill` or `skill.kind: 'passive'`.
 */
export function getItemPassiveSkill(item: ItemDef | undefined): SkillDef | null {
  if (!item) return null;
  if (item.passiveSkill) return withKind(item.passiveSkill, 'passive');
  if (item.skill && item.skill.kind === 'passive') {
    return withKind(item.skill, 'passive');
  }
  return null;
}

function collectSkills(
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
  pick: (item: ItemDef) => SkillDef | null,
): SkillDef[] {
  const out: SkillDef[] = [];
  const seen = new Set<string>();
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const item = itemsById.get(itemId);
    if (!item) continue;
    const resolved = pick(item);
    if (!resolved || seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    out.push(resolved);
  }
  return out;
}

/** Active skills unlocked by currently equipped gear (unique by skill id). */
export function getAvailableSkills(
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
): SkillDef[] {
  return collectSkills(equipment, itemsById, getItemActiveSkill);
}

/** Passive skills unlocked by currently equipped gear (unique by skill id). */
export function getAvailablePassiveSkills(
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
): SkillDef[] {
  return collectSkills(equipment, itemsById, getItemPassiveSkill);
}

export function getSkillById(
  skillId: string | null | undefined,
  available: SkillDef[],
): SkillDef | null {
  if (!skillId) return null;
  return available.find((s) => s.id === skillId) ?? null;
}

function sanitizeBar(
  bar: SkillBarLoadout,
  available: SkillDef[],
  size: number,
): SkillBarLoadout {
  const ids = new Set(available.map((s) => s.id));
  const next: SkillBarLoadout = [null, null, null];
  for (let i = 0; i < size; i++) {
    const id = bar[i];
    next[i] = id && ids.has(id) ? id : null;
  }
  return next;
}

/**
 * Keep skill bar valid: clear slots whose skill is no longer available.
 */
export function sanitizeSkillBar(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  return sanitizeBar(bar, available, SKILL_BAR_SIZE);
}

export function sanitizePassiveSkillBar(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  return sanitizeBar(bar, available, PASSIVE_SKILL_BAR_SIZE);
}

function assignToBar(
  bar: SkillBarLoadout,
  slotIndex: number,
  skillId: string | null,
  size: number,
): SkillBarLoadout {
  if (slotIndex < 0 || slotIndex >= size) return bar;
  const next: SkillBarLoadout = [...bar] as SkillBarLoadout;
  if (skillId) {
    for (let i = 0; i < size; i++) {
      if (next[i] === skillId) next[i] = null;
    }
  }
  next[slotIndex] = skillId;
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
  return assignToBar(bar, slotIndex, skillId, SKILL_BAR_SIZE);
}

export function assignPassiveSkillToBar(
  bar: SkillBarLoadout,
  slotIndex: number,
  skillId: string | null,
): SkillBarLoadout {
  return assignToBar(bar, slotIndex, skillId, PASSIVE_SKILL_BAR_SIZE);
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

/** Passive slots never show combat cooldowns. */
export function buildPassiveSlotViews(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillSlotView[] {
  return bar.map((skillId) => {
    const skill = getSkillById(skillId, available);
    return {
      skillId,
      skill,
      cooldownRemainingMs: 0,
      ready: !!skill,
    };
  });
}

function autoFill(
  bar: SkillBarLoadout,
  available: SkillDef[],
  size: number,
): SkillBarLoadout {
  const next = sanitizeBar(bar, available, size);
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

/** Auto-pick first empty slot for a newly available skill (optional UX helper). */
export function autoFillEmptySlots(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  return autoFill(bar, available, SKILL_BAR_SIZE);
}

export function autoFillPassiveEmptySlots(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillBarLoadout {
  return autoFill(bar, available, PASSIVE_SKILL_BAR_SIZE);
}

export function equippedPassiveSkills(
  bar: SkillBarLoadout,
  available: SkillDef[],
): SkillDef[] {
  const out: SkillDef[] = [];
  for (const id of bar) {
    const skill = getSkillById(id, available);
    if (skill) out.push(skill);
  }
  return out;
}

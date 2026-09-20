import type { EquipSlot, EquipmentMap, SaveData, SkillBarLoadout } from './types';
import { EQUIP_SLOTS, PASSIVE_SKILL_BAR_SIZE, SKILL_BAR_SIZE } from './types';

export const SAVE_KEY = 'guaji-idle-gear-v1';

const LEGACY_ITEM_MAP: Record<string, string> = {
  zealot_blade: 'pulse_blade',
  xeno_skull: 'voidbeast_trophy',
};

/**
 * Map old 7-slot saves onto the 15-slot layout.
 * weapon → hand_right; accessory → neck (voidbeast trophy → shoulder_right);
 * body → waist; legs → leg_left.
 */
const LEGACY_SLOT_MAP: Record<string, EquipSlot> = {
  head: 'head',
  body: 'waist',
  arm_left: 'arm_left',
  arm_right: 'arm_right',
  legs: 'leg_left',
  weapon: 'hand_right',
  accessory: 'neck',
};

const VALID_SLOTS = new Set<string>(EQUIP_SLOTS);

export function emptySkillBar(): SkillBarLoadout {
  return [null, null, null];
}

function normalizeSkillBar(raw: unknown, size = SKILL_BAR_SIZE): SkillBarLoadout {
  const bar = emptySkillBar();
  if (!Array.isArray(raw)) return bar;
  for (let i = 0; i < size; i++) {
    const v = raw[i];
    bar[i] = typeof v === 'string' && v.length > 0 ? v : null;
  }
  return bar;
}

function migrateItemId(id: string): string {
  return LEGACY_ITEM_MAP[id] ?? id;
}

function migrateEquipmentSlot(
  slot: string,
  itemId: string,
): EquipSlot | null {
  if (VALID_SLOTS.has(slot)) return slot as EquipSlot;
  if (slot === 'accessory' && itemId === 'voidbeast_trophy') {
    return 'shoulder_right';
  }
  return LEGACY_SLOT_MAP[slot] ?? null;
}

function migrateEquipment(raw: Record<string, string> | undefined): EquipmentMap {
  const equipment: EquipmentMap = {};
  if (!raw || typeof raw !== 'object') return equipment;
  for (const [slot, id] of Object.entries(raw)) {
    if (typeof id !== 'string') continue;
    const itemId = migrateItemId(id);
    const nextSlot = migrateEquipmentSlot(slot, itemId);
    if (!nextSlot) continue;
    // Prefer first mapping if two legacy slots collide on the same new slot.
    if (!equipment[nextSlot]) equipment[nextSlot] = itemId;
  }
  return equipment;
}

export function defaultSave(worldId = 'space'): SaveData {
  return {
    version: 2,
    worldId,
    level: 1,
    xp: 0,
    inventory: [],
    equipment: {},
    recentDrops: [],
    skillBar: emptySkillBar(),
    passiveSkillBar: emptySkillBar(),
  };
}

export function loadSave(storage: Storage | null = getLocalStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData> & {
      version?: number;
      inventory?: { itemId: string; qty: number }[];
      equipment?: Record<string, string>;
      recentDrops?: string[];
      skillBar?: unknown;
      passiveSkillBar?: unknown;
    };
    if (parsed.version !== 1 && parsed.version !== 2) return defaultSave();

    const inventory = Array.isArray(parsed.inventory)
      ? parsed.inventory.map((e) => ({
          itemId: migrateItemId(e.itemId),
          qty: e.qty,
        }))
      : [];

    const equipment = migrateEquipment(parsed.equipment);

    const recentDrops = Array.isArray(parsed.recentDrops)
      ? parsed.recentDrops.map(migrateItemId)
      : [];

    return {
      ...defaultSave(parsed.worldId || 'space'),
      level: typeof parsed.level === 'number' ? parsed.level : 1,
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      inventory,
      equipment,
      recentDrops,
      skillBar: normalizeSkillBar(parsed.skillBar, SKILL_BAR_SIZE),
      passiveSkillBar: normalizeSkillBar(
        parsed.passiveSkillBar,
        PASSIVE_SKILL_BAR_SIZE,
      ),
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(
  data: SaveData,
  storage: Storage | null = getLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: 2 }));
  } catch {
    /* quota / private mode */
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* */
  }
  return null;
}

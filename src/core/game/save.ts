import type {
  EquipSlot,
  EquipmentMap,
  GearInstance,
  InventoryEntry,
  Rarity,
  SaveData,
  SeekMode,
  SkillBarLoadout,
} from './types';
import { EQUIP_SLOTS, PASSIVE_SKILL_BAR_SIZE, SKILL_BAR_SIZE } from './types';
import { SALVAGE_FRAGMENTS, clampEnhanceLevel } from './economy';

export const SAVE_KEY = 'guaji-idle-gear-v1';

/** Renamed / remapped item ids that still exist as gear. */
const LEGACY_ITEM_MAP: Record<string, string> = {
  zealot_blade: 'pulse_blade',
  xeno_skull: 'voidbeast_trophy',
};

/**
 * Filler / slot-pad items removed in lore pass → convert to fragments.
 * Value = salvage yield of that item's old rarity.
 */
const REMOVED_TO_FRAGMENTS: Record<string, Rarity> = {
  void_goggles: 'uncommon',
  mag_clamp_l: 'common',
  magboot_l: 'common',
  magboot_r: 'common',
  scrap_pauldron_l: 'common',
  shin_guard_r: 'common',
  signal_ring: 'uncommon',
  flux_band: 'uncommon',
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

const VALID_SEEK: ReadonlySet<string> = new Set(['weak', 'balanced', 'strong']);

export function normalizeSeekMode(raw: unknown): SeekMode {
  if (typeof raw === 'string' && VALID_SEEK.has(raw)) return raw as SeekMode;
  return 'balanced';
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

function migrateItemId(id: string): string | null {
  if (REMOVED_TO_FRAGMENTS[id]) return null;
  return LEGACY_ITEM_MAP[id] ?? id;
}

function fragmentsForRemoved(id: string): number {
  const rarity = REMOVED_TO_FRAGMENTS[id];
  if (!rarity) return 0;
  return SALVAGE_FRAGMENTS[rarity];
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

function parseGear(
  raw: unknown,
  fallbackId?: string,
): GearInstance | null {
  if (typeof raw === 'string' && raw.length > 0) {
    const id = migrateItemId(raw);
    if (!id) return null;
    return { itemId: id, enhanceLevel: 0 };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { itemId?: unknown; enhanceLevel?: unknown };
    const rawId =
      typeof obj.itemId === 'string'
        ? obj.itemId
        : typeof fallbackId === 'string'
          ? fallbackId
          : null;
    if (!rawId) return null;
    const id = migrateItemId(rawId);
    if (!id) return null;
    return {
      itemId: id,
      enhanceLevel: clampEnhanceLevel(
        typeof obj.enhanceLevel === 'number' ? obj.enhanceLevel : 0,
      ),
    };
  }
  return null;
}

function migrateEquipment(
  raw: Record<string, unknown> | undefined,
): { equipment: EquipmentMap; bonusFragments: number } {
  const equipment: EquipmentMap = {};
  let bonusFragments = 0;
  if (!raw || typeof raw !== 'object') return { equipment, bonusFragments };
  for (const [slot, value] of Object.entries(raw)) {
    const asString = typeof value === 'string' ? value : undefined;
    const gear = parseGear(value, asString);
    if (!gear) {
      // Removed filler equipped → fragments
      const rawId =
        typeof value === 'string'
          ? value
          : value && typeof value === 'object' &&
              typeof (value as { itemId?: unknown }).itemId === 'string'
            ? ((value as { itemId: string }).itemId)
            : null;
      if (rawId) bonusFragments += fragmentsForRemoved(rawId);
      continue;
    }
    const nextSlot = migrateEquipmentSlot(slot, gear.itemId);
    if (!nextSlot) continue;
    if (!equipment[nextSlot]) equipment[nextSlot] = gear;
  }
  return { equipment, bonusFragments };
}

function migrateInventory(
  raw: unknown,
): { inventory: InventoryEntry[]; bonusFragments: number } {
  const inventory: InventoryEntry[] = [];
  let bonusFragments = 0;
  if (!Array.isArray(raw)) return { inventory, bonusFragments };
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { itemId?: unknown; qty?: unknown; enhanceLevel?: unknown };
    if (typeof e.itemId !== 'string') continue;
    const qty = typeof e.qty === 'number' && e.qty > 0 ? Math.floor(e.qty) : 1;
    const removed = fragmentsForRemoved(e.itemId);
    if (removed > 0) {
      bonusFragments += removed * qty;
      continue;
    }
    const itemId = migrateItemId(e.itemId);
    if (!itemId) continue;
    inventory.push({
      itemId,
      qty,
      enhanceLevel: clampEnhanceLevel(
        typeof e.enhanceLevel === 'number' ? e.enhanceLevel : 0,
      ),
    });
  }
  return { inventory, bonusFragments };
}

function migrateFragments(
  raw: unknown,
  worldId: string,
  bonus: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
  }
  out[worldId] = (out[worldId] ?? 0) + bonus;
  return out;
}

export function defaultSave(worldId = 'space'): SaveData {
  return {
    version: 3,
    worldId,
    level: 1,
    xp: 0,
    inventory: [],
    equipment: {},
    recentDrops: [],
    skillBar: emptySkillBar(),
    passiveSkillBar: emptySkillBar(),
    seekMode: 'balanced',
    worldFragments: { [worldId]: 0 },
    enhanceFailStreak: 0,
  };
}

export function loadSave(storage: Storage | null = getLocalStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData> & {
      version?: number;
      inventory?: unknown;
      equipment?: Record<string, unknown>;
      recentDrops?: string[];
      skillBar?: unknown;
      passiveSkillBar?: unknown;
      worldFragments?: unknown;
      enhanceFailStreak?: unknown;
    };
    if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) {
      return defaultSave();
    }

    const worldId =
      typeof parsed.worldId === 'string' && parsed.worldId
        ? parsed.worldId
        : 'space';

    const { inventory, bonusFragments: invFrags } = migrateInventory(
      parsed.inventory,
    );
    const { equipment, bonusFragments: eqFrags } = migrateEquipment(
      parsed.equipment,
    );

    const recentDrops = Array.isArray(parsed.recentDrops)
      ? parsed.recentDrops
          .map((id) => (typeof id === 'string' ? migrateItemId(id) : null))
          .filter((id): id is string => !!id)
      : [];

    const worldFragments = migrateFragments(
      parsed.worldFragments,
      worldId,
      invFrags + eqFrags,
    );

    return {
      ...defaultSave(worldId),
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
      seekMode: normalizeSeekMode(
        (parsed as { seekMode?: unknown }).seekMode,
      ),
      worldFragments,
      enhanceFailStreak:
        typeof parsed.enhanceFailStreak === 'number' &&
        parsed.enhanceFailStreak >= 0
          ? Math.floor(parsed.enhanceFailStreak)
          : 0,
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
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: 3 }));
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

import type { SaveData, SkillBarLoadout } from './types';
import { SKILL_BAR_SIZE } from './types';

export const SAVE_KEY = 'guaji-idle-gear-v1';

const LEGACY_ITEM_MAP: Record<string, string> = {
  zealot_blade: 'pulse_blade',
  xeno_skull: 'voidbeast_trophy',
};

export function emptySkillBar(): SkillBarLoadout {
  return [null, null, null];
}

function normalizeSkillBar(raw: unknown): SkillBarLoadout {
  const bar = emptySkillBar();
  if (!Array.isArray(raw)) return bar;
  for (let i = 0; i < SKILL_BAR_SIZE; i++) {
    const v = raw[i];
    bar[i] = typeof v === 'string' && v.length > 0 ? v : null;
  }
  return bar;
}

function migrateItemId(id: string): string {
  return LEGACY_ITEM_MAP[id] ?? id;
}

export function defaultSave(worldId = 'space'): SaveData {
  return {
    version: 1,
    worldId,
    level: 1,
    xp: 0,
    inventory: [],
    equipment: {},
    recentDrops: [],
    skillBar: emptySkillBar(),
  };
}

export function loadSave(storage: Storage | null = getLocalStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData> & {
      inventory?: { itemId: string; qty: number }[];
      equipment?: Record<string, string>;
      recentDrops?: string[];
    };
    if (parsed.version !== 1) return defaultSave();

    const inventory = Array.isArray(parsed.inventory)
      ? parsed.inventory.map((e) => ({
          itemId: migrateItemId(e.itemId),
          qty: e.qty,
        }))
      : [];

    const equipment: SaveData['equipment'] = {};
    if (parsed.equipment && typeof parsed.equipment === 'object') {
      for (const [slot, id] of Object.entries(parsed.equipment)) {
        if (typeof id === 'string') {
          (equipment as Record<string, string>)[slot] = migrateItemId(id);
        }
      }
    }

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
      skillBar: normalizeSkillBar(parsed.skillBar),
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
    storage.setItem(SAVE_KEY, JSON.stringify(data));
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

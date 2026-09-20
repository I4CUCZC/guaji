import type { SaveData } from './types';

export const SAVE_KEY = 'guaji-idle-gear-v1';

export function defaultSave(worldId = 'space'): SaveData {
  return {
    version: 1,
    worldId,
    level: 1,
    xp: 0,
    inventory: [],
    equipment: {},
    recentDrops: [],
  };
}

export function loadSave(storage: Storage | null = getLocalStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1) return defaultSave();
    return {
      ...defaultSave(parsed.worldId || 'space'),
      ...parsed,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      equipment: parsed.equipment ?? {},
      recentDrops: Array.isArray(parsed.recentDrops) ? parsed.recentDrops : [],
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

/** Idle-gear game types — data-driven from content JSON */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type EquipSlot =
  | 'head'
  | 'body'
  | 'arm_left'
  | 'arm_right'
  | 'legs'
  | 'weapon'
  | 'accessory';

export const EQUIP_SLOTS: EquipSlot[] = [
  'head',
  'body',
  'arm_left',
  'arm_right',
  'legs',
  'weapon',
  'accessory',
];

export const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

export const RARITY_LABEL_ZH: Record<Rarity, string> = {
  common: '普通',
  uncommon: '优良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#a0aec0',
  uncommon: '#48bb78',
  rare: '#4299e1',
  epic: '#9f7aea',
  legendary: '#ecc94b',
};

export interface ItemDef {
  id: string;
  name: string;
  nameZh: string;
  rarity: Rarity;
  /** null = not equippable (junk / stackable scrap) */
  slot: EquipSlot | null;
  stackable: boolean;
  description?: string;
  /** Path relative to paper-doll layers/ when equippable */
  layer: string | null;
}

export interface DropEntry {
  itemId: string;
  weight: number;
  rarity: Rarity;
}

export interface DropTable {
  worldId: string;
  entries: DropEntry[];
}

export interface WorldDef {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  tickMs: number;
  xpPerTick: { min: number; max: number };
  lootChance: number;
  dropTable: string;
  enemyFlavor?: string[];
}

export interface PaperDollMeta {
  id: string;
  name: string;
  nameZh?: string;
  width: number;
  height: number;
  pixelScale?: number;
}

export interface PaperDollDef {
  meta: PaperDollMeta;
  slots: EquipSlot[];
  /** Draw order: base paths or "slot:<EquipSlot>" placeholders */
  layerOrder: string[];
  baseLayers: Partial<Record<EquipSlot | 'body' | 'head' | 'legs' | 'arm_left' | 'arm_right', string>>;
}

export interface InventoryEntry {
  itemId: string;
  qty: number;
}

export type EquipmentMap = Partial<Record<EquipSlot, string>>;

export interface SaveData {
  version: 1;
  worldId: string;
  level: number;
  xp: number;
  inventory: InventoryEntry[];
  equipment: EquipmentMap;
  /** Recent drop item ids (newest first) */
  recentDrops: string[];
}

export interface TickResult {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  loot: ItemDef | null;
  enemyFlavor: string;
}

export interface GameSnapshot {
  world: WorldDef;
  level: number;
  xp: number;
  xpToNext: number;
  inventory: InventoryEntry[];
  equipment: EquipmentMap;
  recentDrops: string[];
  idleStatus: 'killing' | 'paused';
  lastTick: TickResult | null;
}

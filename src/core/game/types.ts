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

export const SKILL_BAR_SIZE = 3;

export type SkillEffectType = 'damage' | 'heal' | 'shield';

export interface SkillEffect {
  type: SkillEffectType;
  /** Flat amount for damage / heal / shield HP */
  amount: number;
}

export interface SkillDef {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  cooldownMs: number;
  effect: SkillEffect;
}

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
  /** Optional combat skill unlocked while this item is equipped */
  skill?: SkillDef;
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

export interface EnemyDef {
  id: string;
  name: string;
  nameZh: string;
  /** Soft level band for spawning */
  minLevel: number;
  maxLevel: number;
  tier: number;
  hp: number;
  attack: number;
  attackIntervalMs: number;
  xp: { min: number; max: number };
  /** Spawn weight among eligible enemies */
  weight: number;
  /** Per-enemy loot table (low tier = mostly junk) */
  drops: DropEntry[];
}

export interface EnemiesPack {
  worldId: string;
  breatherMs: number;
  playerAttackIntervalMs: number;
  enemies: EnemyDef[];
}

export interface WorldDef {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  /** Legacy field; combat now uses enemies pack timing */
  tickMs: number;
  xpPerTick: { min: number; max: number };
  lootChance: number;
  dropTable: string;
  enemies?: string;
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
  baseLayers: Partial<
    Record<EquipSlot | 'body' | 'head' | 'legs' | 'arm_left' | 'arm_right', string>
  >;
}

export interface InventoryEntry {
  itemId: string;
  qty: number;
}

export type EquipmentMap = Partial<Record<EquipSlot, string>>;

/** Exactly 3 skill-bar slots; null = empty */
export type SkillBarLoadout = [string | null, string | null, string | null];

export interface SaveData {
  version: 1;
  worldId: string;
  level: number;
  xp: number;
  inventory: InventoryEntry[];
  equipment: EquipmentMap;
  /** Recent drop item ids (newest first) */
  recentDrops: string[];
  /** Skill ids assigned to the 3-slot bar */
  skillBar: SkillBarLoadout;
}

export type CombatPhase = 'breather' | 'fighting' | 'paused';

export interface EnemyInstance {
  defId: string;
  nameZh: string;
  maxHp: number;
  hp: number;
  attack: number;
  attackIntervalMs: number;
  tier: number;
}

export interface CombatLogLine {
  text: string;
  kind: 'encounter' | 'damage_out' | 'damage_in' | 'skill' | 'loot' | 'system';
}

export interface SkillSlotView {
  skillId: string | null;
  skill: SkillDef | null;
  cooldownRemainingMs: number;
  ready: boolean;
}

export interface CombatView {
  phase: CombatPhase;
  enemy: EnemyInstance | null;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  log: CombatLogLine[];
  skillSlots: SkillSlotView[];
}

/** Result of finishing one encounter (victory) */
export interface EncounterResult {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  loot: ItemDef | null;
  enemyNameZh: string;
}

/** @deprecated kept for UI compat during transition — prefer EncounterResult */
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
  combat: CombatView;
  skillBar: SkillBarLoadout;
  availableSkills: SkillDef[];
}

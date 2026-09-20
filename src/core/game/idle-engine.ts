import type {
  DropTable,
  GameSnapshot,
  ItemDef,
  SaveData,
  TickResult,
  WorldDef,
} from './types';
import { rollLoot } from './loot-roller';
import { addItem } from './inventory';
import { applyXp, randomInt, xpRequiredForLevel } from './xp';
import { writeSave } from './save';

export type IdleListener = (snap: GameSnapshot, tick: TickResult | null) => void;

export interface IdleEngineOptions {
  world: WorldDef;
  dropTable: DropTable;
  itemsById: Map<string, ItemDef>;
  save: SaveData;
  rng?: () => number;
  persist?: boolean;
}

/**
 * Pure-ish idle grind loop: every tickMs gain XP and occasionally roll loot.
 */
export class IdleEngine {
  private world: WorldDef;
  private dropTable: DropTable;
  private itemsById: Map<string, ItemDef>;
  private save: SaveData;
  private rng: () => number;
  private persist: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<IdleListener>();
  private lastTick: TickResult | null = null;
  private status: 'killing' | 'paused' = 'paused';

  constructor(opts: IdleEngineOptions) {
    this.world = opts.world;
    this.dropTable = opts.dropTable;
    this.itemsById = opts.itemsById;
    this.save = { ...opts.save, worldId: opts.world.id };
    this.rng = opts.rng ?? Math.random;
    this.persist = opts.persist !== false;
  }

  getSave(): SaveData {
    return this.save;
  }

  getSnapshot(): GameSnapshot {
    return {
      world: this.world,
      level: this.save.level,
      xp: this.save.xp,
      xpToNext: xpRequiredForLevel(this.save.level),
      inventory: this.save.inventory,
      equipment: this.save.equipment,
      recentDrops: this.save.recentDrops,
      idleStatus: this.status,
      lastTick: this.lastTick,
    };
  }

  subscribe(fn: IdleListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(tick: TickResult | null): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap, tick);
  }

  start(): void {
    if (this.timer) return;
    this.status = 'killing';
    this.emit(null);
    this.timer = setInterval(() => this.tick(), this.world.tickMs);
  }

  pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'paused';
    this.emit(null);
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
  }

  /** Run one combat tick (also used by tests). */
  tick(): TickResult {
    const xpGained = randomInt(
      this.world.xpPerTick.min,
      this.world.xpPerTick.max,
      this.rng,
    );
    const levelBefore = this.save.level;
    const applied = applyXp(this.save.level, this.save.xp, xpGained);
    this.save.level = applied.level;
    this.save.xp = applied.xp;

    let loot: ItemDef | null = null;
    if (this.rng() < this.world.lootChance) {
      loot = rollLoot(this.dropTable, this.itemsById, this.rng);
      if (loot) {
        this.save.inventory = addItem(this.save.inventory, loot, 1);
        this.save.recentDrops = [loot.id, ...this.save.recentDrops].slice(0, 8);
      }
    }

    const flavor = this.world.enemyFlavor ?? ['敌人'];
    const enemyFlavor = flavor[Math.floor(this.rng() * flavor.length)] ?? '敌人';

    const result: TickResult = {
      xpGained,
      levelBefore,
      levelAfter: this.save.level,
      leveledUp: applied.leveledUp,
      loot,
      enemyFlavor,
    };
    this.lastTick = result;
    if (this.persist) writeSave(this.save);
    this.emit(result);
    return result;
  }

  /** Mutate save externally (equip etc.) then persist + emit */
  replaceSave(next: SaveData): void {
    this.save = next;
    if (this.persist) writeSave(this.save);
    this.emit(null);
  }

  getItem(id: string): ItemDef | undefined {
    return this.itemsById.get(id);
  }

  getItemsById(): Map<string, ItemDef> {
    return this.itemsById;
  }
}

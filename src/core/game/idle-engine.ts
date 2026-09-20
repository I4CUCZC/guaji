import type {
  CombatLogLine,
  CombatPhase,
  DropEntry,
  DropTable,
  EnemiesPack,
  EnemyDef,
  EnemyInstance,
  GameSnapshot,
  ItemDef,
  SaveData,
  SeekMode,
  SkillDef,
  SkillVfxEvent,
  TickResult,
  WorldDef,
} from './types';
import { SKILL_BAR_SIZE } from './types';
import { rollLoot, rollWeighted } from './loot-roller';
import { addItem } from './inventory';
import { applyXp, randomInt, xpRequiredForLevel } from './xp';
import { writeSave } from './save';
import {
  assignPassiveSkillToBar,
  assignSkillToBar,
  autoFillEmptySlots,
  autoFillPassiveEmptySlots,
  buildPassiveSlotViews,
  buildSkillSlotViews,
  equippedPassiveSkills,
  getAvailablePassiveSkills,
  getAvailableSkills,
  sanitizePassiveSkillBar,
  sanitizeSkillBar,
} from './skills';
import {
  formatDamageInLog,
  formatDamageOutLog,
  formatSkillDamageLog,
  formatSkillHealLog,
  formatSkillShieldLog,
} from './soft-combat';

export type IdleListener = (snap: GameSnapshot, tick: TickResult | null) => void;

export interface IdleEngineOptions {
  world: WorldDef;
  dropTable: DropTable;
  enemiesPack: EnemiesPack;
  itemsById: Map<string, ItemDef>;
  save: SaveData;
  rng?: () => number;
  persist?: boolean;
}

const TICK_MS = 100;
const LOG_MAX = 8;
const RARITY_ATK: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 8,
  legendary: 12,
};

/**
 * Combat pacing targets (even-matched enemy vs current player power):
 * - TTK ≈ 240–360 seconds (~5 minutes), early and mid game.
 * - Auto-attack interval ≈ 2.5s; player DPS and enemy HP scale together.
 * - Example L1 bare: ATK ~8 / 2.5s ≈ 3.2 DPS vs ~920 HP → ~290s.
 * - Example L8 + rare gear: ATK ~30 / 2.5s ≈ 12 DPS + skills ≈ 15–17
 *   effective DPS vs ~4500–5600 HP band → ~260–340s.
 * - Lower-tier foes stay weaker/poorer loot but still ≥ ~2–3 minutes.
 * - Skills contribute ~25–35% of fight damage over CDs (not one-shot).
 * - Breather after win ≤ fight length (pack.breatherMs, typically ~9s).
 */
export class IdleEngine {
  private world: WorldDef;
  private readonly dropTable: DropTable;
  private enemiesPack: EnemiesPack;
  private itemsById: Map<string, ItemDef>;
  private save: SaveData;
  private rng: () => number;
  private persist: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<IdleListener>();
  private lastTick: TickResult | null = null;
  private status: 'killing' | 'paused' = 'paused';

  private phase: CombatPhase = 'paused';
  private enemy: EnemyInstance | null = null;
  private playerHp = 0;
  private playerMaxHp = 0;
  private playerShield = 0;
  private log: CombatLogLine[] = [];
  private cooldownRemaining: Record<string, number> = {};

  private playerAtkCd = 0;
  private enemyAtkCd = 0;
  private breatherCd = 0;
  private lastVfx: SkillVfxEvent | null = null;
  private vfxSeq = 0;
  private enemyHitSeq = 0;

  constructor(opts: IdleEngineOptions) {
    this.world = opts.world;
    this.dropTable = opts.dropTable;
    this.enemiesPack = opts.enemiesPack;
    this.itemsById = opts.itemsById;
    this.save = { ...opts.save, worldId: opts.world.id };
    this.rng = opts.rng ?? Math.random;
    this.persist = opts.persist !== false;

    this.ensureSkillBar();
    this.resetPlayerVitals(true);
  }

  private regenAcc = 0;

  private ensureSeekMode(): void {
    if (
      this.save.seekMode !== 'weak' &&
      this.save.seekMode !== 'balanced' &&
      this.save.seekMode !== 'strong'
    ) {
      this.save.seekMode = 'balanced';
    }
  }

  private ensureSkillBar(): void {
    this.ensureSeekMode();
    const available = getAvailableSkills(this.save.equipment, this.itemsById);
    let bar = sanitizeSkillBar(this.save.skillBar ?? [null, null, null], available);
    bar = autoFillEmptySlots(bar, available);
    this.save.skillBar = bar;

    const passives = getAvailablePassiveSkills(this.save.equipment, this.itemsById);
    let pbar = sanitizePassiveSkillBar(
      this.save.passiveSkillBar ?? [null, null, null],
      passives,
    );
    pbar = autoFillPassiveEmptySlots(pbar, passives);
    this.save.passiveSkillBar = pbar;
  }

  private assignedPassives(): SkillDef[] {
    return equippedPassiveSkills(
      this.save.passiveSkillBar ?? [null, null, null],
      getAvailablePassiveSkills(this.save.equipment, this.itemsById),
    );
  }

  private outgoingDamage(base: number): number {
    let amp = 0;
    for (const p of this.assignedPassives()) {
      if (p.effect.type === 'damageAmp') amp += p.effect.amount;
    }
    return Math.max(1, Math.round(base * (1 + amp)));
  }

  private incomingDamage(raw: number): number {
    let red = 0;
    for (const p of this.assignedPassives()) {
      if (p.effect.type === 'damageReduction') red += p.effect.amount;
    }
    red = Math.min(0.6, Math.max(0, red));
    return Math.max(0, Math.round(raw * (1 - red)));
  }

  private applyPassiveTicks(dt: number): void {
    this.regenAcc += dt;
    if (this.regenAcc < 5000) return;
    this.regenAcc = 0;
    let heal = 0;
    for (const p of this.assignedPassives()) {
      if (p.effect.type === 'regen') heal += p.effect.amount;
    }
    if (heal <= 0 || this.playerHp <= 0) return;
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
  }

  private playerMaxHpForLevel(level: number): number {
    // Slightly softer early curve so fresh characters survive T1 reliably
    return 240 + level * 50;
  }

  private playerAttackPower(): number {
    let atk = 9 + Math.floor(this.save.level * 2);
    for (const slot of ['hand_left', 'hand_right'] as const) {
      const id = this.save.equipment[slot];
      if (!id) continue;
      const item = this.itemsById.get(id);
      if (item) atk += RARITY_ATK[item.rarity] ?? 2;
    }
    for (const slot of ['arm_left', 'arm_right'] as const) {
      const id = this.save.equipment[slot];
      if (!id) continue;
      const item = this.itemsById.get(id);
      if (item) atk += Math.max(1, Math.floor((RARITY_ATK[item.rarity] ?? 1) / 2));
    }
    return atk;
  }

  private resetPlayerVitals(full = false): void {
    this.playerMaxHp = this.playerMaxHpForLevel(this.save.level);
    if (full || this.playerHp <= 0) {
      this.playerHp = this.playerMaxHp;
    } else {
      this.playerHp = Math.min(this.playerHp, this.playerMaxHp);
    }
    this.playerShield = 0;
  }

  private pushLog(text: string, kind: CombatLogLine['kind']): void {
    this.log = [{ text, kind }, ...this.log].slice(0, LOG_MAX);
  }

  private vfxForSkill(skill: SkillDef): SkillVfxEvent['vfx'] {
    if (skill.id === 'skill_void_howl') return 'acid';
    if (skill.effect.type === 'heal') return 'heal';
    if (skill.effect.type === 'shield') return 'shield';
    return 'slash';
  }

  getSave(): SaveData {
    return this.save;
  }

  getSnapshot(): GameSnapshot {
    const available = getAvailableSkills(this.save.equipment, this.itemsById);
    const passives = getAvailablePassiveSkills(this.save.equipment, this.itemsById);
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
      combat: {
        phase: this.phase,
        enemy: this.enemy ? { ...this.enemy } : null,
        playerHp: this.playerHp,
        playerMaxHp: this.playerMaxHp,
        playerShield: this.playerShield,
        log: [...this.log],
        skillSlots: buildSkillSlotViews(
          this.save.skillBar,
          available,
          this.cooldownRemaining,
        ),
        passiveSlots: buildPassiveSlotViews(
          this.save.passiveSkillBar ?? [null, null, null],
          passives,
        ),
        lastVfx: this.lastVfx,
        lastEnemyHitSeq: this.enemyHitSeq,
      },
      skillBar: this.save.skillBar,
      availableSkills: available,
      passiveSkillBar: this.save.passiveSkillBar ?? [null, null, null],
      availablePassiveSkills: passives,
      seekMode: this.save.seekMode ?? 'balanced',
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
    if (this.phase === 'paused') {
      this.phase = this.enemy ? 'fighting' : 'breather';
      if (!this.enemy) this.breatherCd = Math.min(this.breatherCd || 600, 600);
    }
    this.emit(null);
    this.timer = setInterval(() => this.frame(TICK_MS), TICK_MS);
  }

  pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'paused';
    this.phase = 'paused';
    this.emit(null);
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
  }

  /** Test helper: advance one combat frame. */
  tick(dt = TICK_MS): TickResult | null {
    return this.frame(dt);
  }

  private frame(dt: number): TickResult | null {
    if (this.status !== 'killing') return null;

    for (const id of Object.keys(this.cooldownRemaining)) {
      this.cooldownRemaining[id] = Math.max(0, this.cooldownRemaining[id]! - dt);
    }

    let result: TickResult | null = null;

    this.applyPassiveTicks(dt);

    if (this.phase === 'breather') {
      this.breatherCd -= dt;
      if (this.breatherCd <= 0) {
        this.spawnEncounter();
      }
    } else if (this.phase === 'fighting' && this.enemy) {
      result = this.fightFrame(dt);
    }

    this.emit(result);
    return result;
  }

  private matchedTier(level: number): number {
    const band = this.enemiesPack.enemies.filter(
      (e) => level >= e.minLevel && level <= e.maxLevel,
    );
    if (band.length === 0) return 1;
    return Math.round(
      band.reduce((s, e) => s + e.tier, 0) / band.length,
    );
  }

  private pickEnemy(): EnemyDef {
    const level = this.save.level;
    const mode: SeekMode = this.save.seekMode ?? 'balanced';
    const all = this.enemiesPack.enemies;
    let pool: EnemyDef[] = [];

    if (mode === 'weak') {
      const match = this.matchedTier(level);
      pool = all.filter(
        (e) => e.minLevel <= level + 1 && e.tier <= Math.max(1, match - 1),
      );
      if (pool.length === 0) {
        pool = all.filter((e) => e.minLevel <= level + 1);
        const minT = Math.min(...pool.map((e) => e.tier));
        pool = pool.filter((e) => e.tier === minT);
      }
    } else if (mode === 'strong') {
      const match = this.matchedTier(level);
      pool = all.filter(
        (e) =>
          e.minLevel <= level + 4 &&
          e.maxLevel >= Math.max(1, level - 2) &&
          e.tier >= match,
      );
      if (pool.length === 0) {
        pool = all.filter((e) => e.minLevel <= level + 5);
        const maxT = Math.max(...pool.map((e) => e.tier));
        pool = pool.filter((e) => e.tier >= maxT - 1);
      }
    } else {
      pool = all.filter(
        (e) => level >= e.minLevel && level <= e.maxLevel,
      );
      if (pool.length === 0) {
        pool = [...all].sort(
          (a, b) =>
            Math.abs(a.minLevel - level) - Math.abs(b.minLevel - level),
        );
        pool = pool.slice(0, 2);
      }
    }

    const picked = rollWeighted(pool, this.rng);
    return picked ?? all[0]!;
  }

  private seekStatMul(): { hp: number; atk: number } {
    const mode: SeekMode = this.save.seekMode ?? 'balanced';
    if (mode === 'weak') return { hp: 0.72, atk: 0.58 };
    if (mode === 'strong') return { hp: 1.28, atk: 1.22 };
    return { hp: 1, atk: 1 };
  }

  private biasDrops(entries: DropEntry[]): DropEntry[] {
    const mode: SeekMode = this.save.seekMode ?? 'balanced';
    if (mode === 'balanced' || entries.length === 0) return entries;
    return entries.map((e) => {
      let w = e.weight;
      if (mode === 'weak') {
        if (e.rarity === 'common') w *= 2.2;
        else if (e.rarity === 'uncommon') w *= 1.0;
        else if (e.rarity === 'rare') w *= 0.35;
        else if (e.rarity === 'epic') w *= 0.12;
        else w *= 0.05;
      } else {
        if (e.rarity === 'common') w *= 0.45;
        else if (e.rarity === 'uncommon') w *= 0.75;
        else if (e.rarity === 'rare') w *= 1.7;
        else if (e.rarity === 'epic') w *= 2.3;
        else w *= 3.0;
      }
      return { ...e, weight: Math.max(1, Math.round(w)) };
    });
  }

  private noteEnemyHit(): void {
    this.enemyHitSeq += 1;
  }

  private spawnEncounter(): void {
    const def = this.pickEnemy();
    const over = Math.max(0, this.save.level - def.minLevel);
    const seek = this.seekStatMul();
    const hpScale = (1 + over * 0.05) * seek.hp;
    const atkScale = (1 + over * 0.035) * seek.atk;
    const maxHp = Math.max(40, Math.round(def.hp * hpScale));
    this.enemy = {
      defId: def.id,
      nameZh: def.nameZh,
      maxHp,
      hp: maxHp,
      attack: Math.max(1, Math.round(def.attack * atkScale)),
      attackIntervalMs: def.attackIntervalMs,
      tier: def.tier,
      portrait: def.portrait ?? `portraits/${def.id}.svg`,
    };
    this.phase = 'fighting';
    this.playerAtkCd = 800;
    this.enemyAtkCd = Math.floor(def.attackIntervalMs * 0.7);
    this.resetPlayerVitals(false);
    // Soft heal between fights (not longer than a short breather's worth)
    this.playerHp = Math.min(
      this.playerMaxHp,
      this.playerHp + Math.floor(this.playerMaxHp * 0.35),
    );
    const mode = this.save.seekMode ?? 'balanced';
    const modeTag =
      mode === 'weak' ? '（弱敌）' : mode === 'strong' ? '（强敌）' : '';
    this.pushLog(`遭遇了${def.nameZh}${modeTag}`, 'encounter');
  }

  private fightFrame(dt: number): TickResult | null {
    if (!this.enemy) return null;

    this.autoCastSkills();

    this.playerAtkCd -= dt;
    if (this.playerAtkCd <= 0 && this.enemy.hp > 0) {
      const dmg = this.outgoingDamage(this.playerAttackPower());
      this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
      this.noteEnemyHit();
      this.pushLog(
        formatDamageOutLog(this.enemy.nameZh, dmg, this.enemy.maxHp, false),
        'damage_out',
      );
      this.playerAtkCd = this.enemiesPack.playerAttackIntervalMs;
    }

    if (this.enemy.hp <= 0) {
      return this.resolveVictory();
    }

    this.enemyAtkCd -= dt;
    if (this.enemyAtkCd <= 0 && this.enemy.hp > 0) {
      const raw = this.incomingDamage(this.enemy.attack);
      let absorbed = 0;
      if (this.playerShield > 0) {
        absorbed = Math.min(this.playerShield, raw);
        this.playerShield -= absorbed;
      }
      const dmg = raw - absorbed;
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this.pushLog(
        formatDamageInLog(
          this.enemy.nameZh,
          dmg,
          this.playerMaxHp,
          absorbed,
          false,
        ),
        'damage_in',
      );
      this.enemyAtkCd = this.enemy.attackIntervalMs;
    }

    if (this.playerHp <= 0) {
      this.pushLog('战败…生命已恢复，继续按当前寻觅模式搜寻', 'system');
      this.enemy = null;
      this.phase = 'breather';
      this.breatherCd = Math.min(this.enemiesPack.breatherMs + 2000, 12000);
      this.resetPlayerVitals(true);
      if (this.persist) writeSave(this.save);
    }

    return null;
  }

  private autoCastSkills(): void {
    if (!this.enemy || this.enemy.hp <= 0) return;
    for (let i = 0; i < SKILL_BAR_SIZE; i++) {
      const skillId = this.save.skillBar[i];
      if (!skillId) continue;
      if ((this.cooldownRemaining[skillId] ?? 0) > 0) continue;
      const available = getAvailableSkills(this.save.equipment, this.itemsById);
      const skill = available.find((s) => s.id === skillId);
      if (!skill) continue;
      this.applySkill(skill);
    }
  }

  /** Manual cast from UI (also used by auto). */
  useSkill(skillId: string): boolean {
    if (this.phase !== 'fighting' || !this.enemy) return false;
    if ((this.cooldownRemaining[skillId] ?? 0) > 0) return false;
    const available = getAvailableSkills(this.save.equipment, this.itemsById);
    const skill = available.find((s) => s.id === skillId);
    if (!skill) return false;
    if (!this.save.skillBar.includes(skillId)) return false;
    this.applySkill(skill);
    this.emit(null);
    return true;
  }

  private applySkill(skill: SkillDef): void {
    const { effect } = skill;
    if (effect.type === 'damage' && this.enemy) {
      const amount = this.outgoingDamage(effect.amount);
      this.enemy.hp = Math.max(0, this.enemy.hp - amount);
      this.noteEnemyHit();
      this.pushLog(
        formatSkillDamageLog(
          skill.nameZh,
          this.enemy.nameZh,
          amount,
          this.enemy.maxHp,
          false,
        ),
        'skill',
      );
    } else if (effect.type === 'heal') {
      const before = this.playerHp;
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + effect.amount);
      const healed = this.playerHp - before;
      this.pushLog(
        formatSkillHealLog(skill.nameZh, healed, this.playerMaxHp, false),
        'skill',
      );
    } else if (effect.type === 'shield') {
      this.playerShield += effect.amount;
      this.pushLog(
        formatSkillShieldLog(
          skill.nameZh,
          effect.amount,
          this.playerMaxHp,
          false,
        ),
        'skill',
      );
    }
    this.cooldownRemaining[skill.id] = skill.cooldownMs ?? 10000;
    this.vfxSeq += 1;
    this.lastVfx = {
      skillId: skill.id,
      effectType: effect.type,
      vfx: this.vfxForSkill(skill),
      nameZh: skill.nameZh,
      seq: this.vfxSeq,
    };

    if (this.enemy && this.enemy.hp <= 0) {
      const result = this.resolveVictory();
      this.emit(result);
    }
  }

  private resolveVictory(): TickResult {
    const enemy = this.enemy!;
    const def =
      this.enemiesPack.enemies.find((e) => e.id === enemy.defId) ??
      this.enemiesPack.enemies[0]!;

    const xpGained = randomInt(def.xp.min, def.xp.max, this.rng);
    const levelBefore = this.save.level;
    const applied = applyXp(this.save.level, this.save.xp, xpGained);
    this.save.level = applied.level;
    this.save.xp = applied.xp;
    if (applied.leveledUp) {
      this.playerMaxHp = this.playerMaxHpForLevel(this.save.level);
      this.playerHp = this.playerMaxHp;
      this.pushLog(`升级！→ Lv.${this.save.level}`, 'system');
    }

    let loot: ItemDef | null = null;
    const rawEntries =
      def.drops.length > 0 ? (def.drops as DropEntry[]) : this.dropTable.entries;
    const table: DropTable = {
      worldId: this.world.id,
      entries: this.biasDrops(rawEntries),
    };
    loot = rollLoot(table, this.itemsById, this.rng);
    if (loot) {
      this.save.inventory = addItem(this.save.inventory, loot, 1);
      this.save.recentDrops = [loot.id, ...this.save.recentDrops].slice(0, 8);
      this.pushLog(`掉落 ${loot.nameZh}`, 'loot');
    }

    this.pushLog(`击败了${enemy.nameZh} · +${xpGained} XP`, 'system');

    const result: TickResult = {
      xpGained,
      levelBefore,
      levelAfter: this.save.level,
      leveledUp: applied.leveledUp,
      loot,
      enemyFlavor: enemy.nameZh,
    };
    this.lastTick = result;
    this.enemy = null;
    this.phase = 'breather';
    this.breatherCd = this.enemiesPack.breatherMs;
    if (this.persist) writeSave(this.save);
    return result;
  }

  setSeekMode(mode: SeekMode): void {
    if (mode !== 'weak' && mode !== 'balanced' && mode !== 'strong') return;
    if (this.save.seekMode === mode) return;
    this.save.seekMode = mode;
    if (this.persist) writeSave(this.save);
    const label =
      mode === 'weak' ? '寻觅弱敌' : mode === 'strong' ? '寻觅强敌' : '寻常对手';
    this.pushLog(`寻觅模式：${label}`, 'system');
    this.emit(null);
  }

  setSkillBarSlot(slotIndex: number, skillId: string | null): void {
    const available = getAvailableSkills(this.save.equipment, this.itemsById);
    if (skillId && !available.some((s) => s.id === skillId)) return;
    this.save.skillBar = assignSkillToBar(this.save.skillBar, slotIndex, skillId);
    if (this.persist) writeSave(this.save);
    this.emit(null);
  }

  setPassiveSkillBarSlot(slotIndex: number, skillId: string | null): void {
    const available = getAvailablePassiveSkills(this.save.equipment, this.itemsById);
    if (skillId && !available.some((s) => s.id === skillId)) return;
    this.save.passiveSkillBar = assignPassiveSkillToBar(
      this.save.passiveSkillBar ?? [null, null, null],
      slotIndex,
      skillId,
    );
    if (this.persist) writeSave(this.save);
    this.emit(null);
  }

  /** Mutate save externally (equip etc.) then persist + emit */
  replaceSave(next: SaveData): void {
    this.save = next;
    this.ensureSkillBar();
    this.playerMaxHp = this.playerMaxHpForLevel(this.save.level);
    this.playerHp = Math.min(this.playerHp || this.playerMaxHp, this.playerMaxHp);
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

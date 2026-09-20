import './styles.css';
import {
  IdleEngine,
  loadWorldContent,
  loadPaperDoll,
  loadSave,
  writeSave,
  defaultSave,
  composePaperDoll,
  equipItem,
  unequipSlot,
  EQUIP_SLOTS,
  RARITY_LABEL_ZH,
  RARITY_ORDER,
  SPACE_ITEM_IDS,
  SKILL_BAR_SIZE,
  PASSIVE_SKILL_BAR_SIZE,
  SEEK_MODE_LABEL_ZH,
  fightState,
  hpBand,
  shieldTier,
  SHOP_PULL_COST,
  SALVAGE_FRAGMENTS,
  ENHANCE_CAP,
  enhanceSuccessChance,
  isEnhanceMilestone,
  clampEnhanceLevel,
} from '@core/index';
import type {
  EquipSlot,
  GameSnapshot,
  ItemDef,
  PaperDollDef,
  Rarity,
  SeekMode,
  TickResult,
} from '@core/index';
import { createBridge } from './bridge';

const WORLD_BASE = './content/worlds/space';
const DOLL_BASE = './content/characters/paper-doll';

const SLOT_LABEL_ZH: Record<EquipSlot, string> = {
  head: '头部',
  neck: '颈部',
  arm_left: '左臂',
  arm_right: '右臂',
  hand_left: '左手',
  hand_right: '右手',
  ring_1: '戒指一',
  ring_2: '戒指二',
  shoulder_left: '左肩',
  shoulder_right: '右肩',
  waist: '腰部',
  leg_left: '左腿',
  leg_right: '右腿',
  foot_left: '左脚',
  foot_right: '右脚',
};

function rarityClass(r: Rarity): string {
  return `rarity-${r}`;
}

function itemLabel(item: ItemDef, enhanceLevel = 0): string {
  const plus =
    enhanceLevel > 0 ? `+${enhanceLevel}` : '';
  const glow = isEnhanceMilestone(enhanceLevel) ? '✦' : '';
  return `${item.nameZh}${plus}${glow}〔${RARITY_LABEL_ZH[item.rarity]}〕`;
}

function hpPct(cur: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (cur / max) * 100));
}

function formatCd(ms: number): string {
  if (ms <= 0) return '就绪';
  return `${(ms / 1000).toFixed(1)}s`;
}

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  const bridge = createBridge();
  document.body.classList.add(bridge.isElectron ? 'electron' : 'browser-demo');

  if (bridge.isElectron && bridge.setIgnoreMouseEvents) {
    bridge.setIgnoreMouseEvents(false);
  }

  const [content, doll] = await Promise.all([
    loadWorldContent(WORLD_BASE, [...SPACE_ITEM_IDS]),
    loadPaperDoll(`${DOLL_BASE}/paper-doll.json`),
  ]);

  const save = loadSave();
  if (save.worldId !== content.world.id) {
    Object.assign(save, defaultSave(content.world.id));
  }

  const engine = new IdleEngine({
    world: content.world,
    dropTable: content.dropTable,
    enemiesPack: content.enemiesPack,
    itemsById: content.itemsById,
    save,
    persist: true,
  });

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header">
      <h1>挂机桌宠 · 星际遭遇</h1>
      <span class="world-badge" data-world></span>
    </div>
    <div class="arena-row no-drag">
      <div class="fighter fighter-player">
        <div class="fighter-hp">
          <span class="fighter-tag">我</span>
          <div class="hp-bar player" data-player-bar>
            <div class="hp-segments" aria-hidden="true"></div>
            <div class="hp-fill" data-player-hp></div>
          </div>
          <span class="hp-num" data-player-hp-num hidden>—</span>
        </div>
        <div class="doll-stage" data-doll>
          <div class="vfx-layer" data-vfx aria-hidden="true"></div>
        </div>
        <div class="fighter-label meta">纸娃娃</div>
        <div class="shield-line meta" data-shield></div>
      </div>
      <div class="arena-mid idle-box">
        <div class="status-line">
          <span class="status-dot" data-dot></span>
          <span data-status>准备中…</span>
        </div>
        <div class="xp-row">
          <div>等级 <strong data-level>1</strong> · XP <span data-xp>0</span>/<span data-xp-next>50</span></div>
          <div class="xp-bar"><div class="xp-fill" data-xp-fill></div></div>
        </div>
        <div class="combat-title-row">
          <div class="combat-title" data-vs-title>等待遭遇…</div>
          <span class="fight-state" data-fight-state hidden></span>
        </div>
        <div class="seek-row" data-seek-row>
          <button type="button" class="seek-btn" data-seek="weak">寻觅弱敌</button>
          <button type="button" class="seek-btn" data-seek="balanced">寻常对手</button>
          <button type="button" class="seek-btn" data-seek="strong">寻觅强敌</button>
        </div>
        <label class="detail-toggle meta">
          <input type="checkbox" data-detail-toggle />
          显示详细数值
        </label>
        <div class="combat-log" data-combat-log></div>
      </div>
      <div class="fighter fighter-enemy">
        <div class="fighter-hp">
          <span class="fighter-tag">敌</span>
          <div class="hp-bar enemy" data-enemy-bar>
            <div class="hp-segments" aria-hidden="true"></div>
            <div class="hp-fill" data-enemy-hp></div>
          </div>
          <span class="hp-num" data-enemy-hp-num hidden>—</span>
        </div>
        <div class="enemy-stage" data-enemy-stage>
          <div class="enemy-portrait" data-enemy-portrait aria-hidden="true"></div>
          <div class="enemy-hit-flash" data-enemy-flash aria-hidden="true"></div>
        </div>
        <div class="fighter-label combat-title" data-enemy-name>等待遭遇…</div>
      </div>
    </div>
    <div class="skill-section no-drag">
      <div class="section-title">主动技能（点空位装配 · 点已装可清空/重选 · 战斗中自动释放）</div>
      <div class="skill-bar" data-skill-bar></div>
      <div class="skill-picker" data-skill-picker hidden></div>
    </div>
    <div class="skill-section passive-section no-drag">
      <div class="section-title">被动技能（装备解锁 · 点空位装配 · 持续生效，无施放冷却）</div>
      <div class="skill-bar passive-bar" data-passive-bar></div>
      <div class="skill-picker" data-passive-picker hidden></div>
    </div>
    <div class="equip-section no-drag">
      <div class="section-title">装备栏（装备/卸下立即改变对峙场纸娃娃外观）</div>
      <div class="equip-grid" data-equip></div>
    </div>
    <div class="shop-section no-drag">
      <div class="section-title">
        星际军械库
        <span class="frag-badge" data-fragments>碎片 0</span>
        <button type="button" class="shop-toggle" data-shop-toggle>打开商店</button>
      </div>
      <div class="shop-panel" data-shop-panel hidden>
        <div class="meta shop-hint">消耗本世界碎片抽取装备；费用随目标稀有度上升。约 10 次同稀有度分解 ≈ 1 次同档抽取。</div>
        <div class="shop-grid" data-shop-grid></div>
      </div>
    </div>
    <div class="enhance-section no-drag">
      <div class="section-title">
        装备强化（+0～+9）
        <button type="button" class="shop-toggle" data-enhance-toggle>打开强化</button>
      </div>
      <div class="enhance-panel" data-enhance-panel hidden>
        <div class="meta">同强化等级的另一件装备作材料；失败只消耗材料，主装备不掉级。连续失败有软保底。</div>
        <div class="enhance-status" data-enhance-status></div>
        <div class="enhance-actions" data-enhance-actions></div>
      </div>
    </div>
    <div class="inv-section no-drag">
      <div class="section-title">背包（点击装备 · 可分解）</div>
      <div class="inv-list" data-inv></div>
    </div>
    <div class="drops-section no-drag">
      <div class="section-title">最近掉落</div>
      <div class="last-drops" data-drops></div>
    </div>
    <div class="toolbar no-drag">
      <button type="button" class="primary" data-toggle>暂停挂机</button>
      <button type="button" data-reset>重置存档</button>
    </div>
    <p class="hint no-drag">对峙布局：左纸娃娃右敌方像素肖像。装备/卸下会立刻切换纸娃娃图层（含脉冲腕刃）。可用「寻觅弱敌 / 寻常对手 / 寻觅强敌」调节难度与掉落。势均力敌约数分钟；日志用「轻击 / 普通 / 重击 / 破防」。主动与被动各 3 格。商店抽装 / 分解换碎片 / 强化最高 +9。</p>
  `;
  app.appendChild(panel);

  const els = {
    world: panel.querySelector('[data-world]') as HTMLElement,
    doll: panel.querySelector('[data-doll]') as HTMLElement,
    vfx: panel.querySelector('[data-vfx]') as HTMLElement,
    dot: panel.querySelector('[data-dot]') as HTMLElement,
    status: panel.querySelector('[data-status]') as HTMLElement,
    level: panel.querySelector('[data-level]') as HTMLElement,
    xp: panel.querySelector('[data-xp]') as HTMLElement,
    xpNext: panel.querySelector('[data-xp-next]') as HTMLElement,
    xpFill: panel.querySelector('[data-xp-fill]') as HTMLElement,
    vsTitle: panel.querySelector('[data-vs-title]') as HTMLElement,
    enemyName: panel.querySelector('[data-enemy-name]') as HTMLElement,
    enemyStage: panel.querySelector('[data-enemy-stage]') as HTMLElement,
    enemyPortrait: panel.querySelector('[data-enemy-portrait]') as HTMLElement,
    enemyFlash: panel.querySelector('[data-enemy-flash]') as HTMLElement,
    fightState: panel.querySelector('[data-fight-state]') as HTMLElement,
    enemyBar: panel.querySelector('[data-enemy-bar]') as HTMLElement,
    enemyHp: panel.querySelector('[data-enemy-hp]') as HTMLElement,
    enemyHpNum: panel.querySelector('[data-enemy-hp-num]') as HTMLElement,
    playerBar: panel.querySelector('[data-player-bar]') as HTMLElement,
    playerHp: panel.querySelector('[data-player-hp]') as HTMLElement,
    playerHpNum: panel.querySelector('[data-player-hp-num]') as HTMLElement,
    shield: panel.querySelector('[data-shield]') as HTMLElement,
    detailToggle: panel.querySelector('[data-detail-toggle]') as HTMLInputElement,
    combatLog: panel.querySelector('[data-combat-log]') as HTMLElement,
    seekRow: panel.querySelector('[data-seek-row]') as HTMLElement,
    drops: panel.querySelector('[data-drops]') as HTMLElement,
    skillBar: panel.querySelector('[data-skill-bar]') as HTMLElement,
    skillPicker: panel.querySelector('[data-skill-picker]') as HTMLElement,
    passiveBar: panel.querySelector('[data-passive-bar]') as HTMLElement,
    passivePicker: panel.querySelector('[data-passive-picker]') as HTMLElement,
    equip: panel.querySelector('[data-equip]') as HTMLElement,
    inv: panel.querySelector('[data-inv]') as HTMLElement,
    fragments: panel.querySelector('[data-fragments]') as HTMLElement,
    shopToggle: panel.querySelector('[data-shop-toggle]') as HTMLButtonElement,
    shopPanel: panel.querySelector('[data-shop-panel]') as HTMLElement,
    shopGrid: panel.querySelector('[data-shop-grid]') as HTMLElement,
    enhanceToggle: panel.querySelector('[data-enhance-toggle]') as HTMLButtonElement,
    enhancePanel: panel.querySelector('[data-enhance-panel]') as HTMLElement,
    enhanceStatus: panel.querySelector('[data-enhance-status]') as HTMLElement,
    enhanceActions: panel.querySelector('[data-enhance-actions]') as HTMLElement,
    toggle: panel.querySelector('[data-toggle]') as HTMLButtonElement,
    reset: panel.querySelector('[data-reset]') as HTMLButtonElement,
  };

  els.world.textContent = content.world.nameZh;

  const DETAIL_KEY = 'guaji-show-detail-nums';
  let showDetailedNumbers = false;
  try {
    showDetailedNumbers = localStorage.getItem(DETAIL_KEY) === '1';
  } catch {
    /* private mode */
  }
  els.detailToggle.checked = showDetailedNumbers;
  panel.classList.toggle('show-detail-nums', showDetailedNumbers);

  let pickSlot: number | null = null;
  let pickPassiveSlot: number | null = null;
  /** Enhance UI: main = equipped slot or inventory index; fodder = inventory index */
  let enhanceMain:
    | { kind: 'equipped'; slot: EquipSlot }
    | { kind: 'inventory'; index: number }
    | null = null;
  let enhanceFodderIndex: number | null = null;
  let shopOpen = false;
  let enhanceOpen = false;
  let lastSkillSig = '';
  let lastPassiveSig = '';
  let lastEquipSig = '';
  let lastInvSig = '';
  let lastDollSig = '';
  let lastVfxSeq = 0;
  let lastEnemyHitSeq = 0;
  let lastPortraitKey = '';
  let lastLogSig = '';
  let enemyFlashTimer = 0;

  function resolveDollAsset(src: string): string {
    try {
      return new URL(`${DOLL_BASE}/${src}`, window.location.href).href;
    } catch {
      return `${DOLL_BASE}/${src}`;
    }
  }

  /** Pixel/SVG enemy portraits under world content (anime PNGs in public/art stay unused gallery assets). */
  function resolveEnemyPortrait(portrait: string | null, defId: string): string {
    const rel = portrait && portrait.length > 0 ? portrait : `portraits/${defId}.svg`;
    try {
      return new URL(`${WORLD_BASE}/${rel}`, window.location.href).href;
    } catch {
      return `${WORLD_BASE}/${rel}`;
    }
  }

  function flashEnemyHit(): void {
    els.enemyStage.classList.remove('hit');
    void els.enemyStage.offsetWidth;
    els.enemyStage.classList.add('hit');
    window.clearTimeout(enemyFlashTimer);
    enemyFlashTimer = window.setTimeout(() => {
      els.enemyStage.classList.remove('hit');
    }, 280);
  }

  function renderSeekButtons(mode: SeekMode): void {
    for (const btn of els.seekRow.querySelectorAll<HTMLButtonElement>('[data-seek]')) {
      const m = btn.dataset.seek as SeekMode;
      btn.classList.toggle('active', m === mode);
      btn.title =
        m === 'weak'
          ? '较弱敌人，掉落较差'
          : m === 'strong'
            ? '更强敌人，掉落更好，可能战败'
            : '与等级匹配的寻常对手';
    }
  }

  const PART_ANIM: Record<string, string[]> = {
    slash: ['arm_left', 'arm_right', 'hand_left', 'hand_right'],
    heal: ['body', 'waist'],
    shield: ['neck', 'shoulder_left', 'shoulder_right', 'arm_left', 'arm_right', 'head'],
    acid: ['head', 'shoulder_right', 'shoulder_left', 'neck'],
  };

  let vfxClearTimer = 0;
  let partAnimTimer = 0;

  function layerPartKind(src: string, kind: string): string {
    if (kind && kind !== 'base') return kind;
    const m = src.match(
      /(?:^|\/)(body|legs|leg_left|leg_right|arm_left|arm_right|hand_left|hand_right|head|neck|waist|shoulder_left|shoulder_right|weapon|accessory)(?:[_./]|$)/,
    );
    return m?.[1] ?? 'body';
  }

  function clearPartAnim(stage: HTMLElement): void {
    stage.classList.remove(
      'part-anim-slash',
      'part-anim-heal',
      'part-anim-shield',
      'part-anim-acid',
    );
    for (const img of stage.querySelectorAll('img.layer.part-active')) {
      img.classList.remove('part-active');
    }
  }

  function pulseBodyParts(vfx: string): void {
    // Part pulse + skill burst VFX on the combat paper-doll.
    const stage = els.doll;
    clearPartAnim(stage);
    void stage.offsetWidth;
    stage.classList.add(`part-anim-${vfx}`);
    const parts = PART_ANIM[vfx] ?? [];
    for (const img of stage.querySelectorAll('img.layer')) {
      const part = (img as HTMLElement).dataset.part;
      if (part && parts.includes(part)) {
        img.classList.add('part-active');
      }
    }
  }

  function spawnVfxBurst(vfx: string, nameZh: string): void {
    const stage = els.doll;
    stage.classList.remove(
      'vfx-playing-slash',
      'vfx-playing-heal',
      'vfx-playing-shield',
      'vfx-playing-acid',
    );
    void stage.offsetWidth;
    stage.classList.add(`vfx-playing-${vfx}`);

    els.vfx.replaceChildren();
    const burst = document.createElement('div');
    burst.className = `vfx-burst vfx-${vfx}`;
    const label = document.createElement('div');
    label.className = 'vfx-label';
    label.textContent = nameZh;
    burst.appendChild(label);
    if (vfx === 'slash') {
      const L = document.createElement('div');
      L.className = 'vfx-blade left';
      const R = document.createElement('div');
      R.className = 'vfx-blade right';
      burst.append(L, R);
    } else if (vfx === 'acid') {
      const blob = document.createElement('div');
      blob.className = 'vfx-acid-blob';
      burst.appendChild(blob);
    } else if (vfx === 'heal') {
      const ring = document.createElement('div');
      ring.className = 'vfx-heal-ring';
      burst.appendChild(ring);
    } else if (vfx === 'shield') {
      const shimmer = document.createElement('div');
      shimmer.className = 'vfx-shield-shimmer';
      burst.appendChild(shimmer);
    }
    els.vfx.appendChild(burst);

    window.clearTimeout(vfxClearTimer);
    vfxClearTimer = window.setTimeout(() => {
      stage.classList.remove(`vfx-playing-${vfx}`);
      clearPartAnim(els.doll);
      if (els.vfx.contains(burst)) burst.remove();
    }, 780);
  }

  /** Animate relevant doll parts first, then play VFX. */
  function playVfx(vfx: string, nameZh: string): void {
    window.clearTimeout(partAnimTimer);
    window.clearTimeout(vfxClearTimer);
    pulseBodyParts(vfx);
    // Body motion leads (~180ms), then energy / pulse / spray VFX
    partAnimTimer = window.setTimeout(() => {
      spawnVfxBurst(vfx, nameZh);
    }, 180);
  }

  function renderDoll(snap: GameSnapshot): void {
    const sig = EQUIP_SLOTS.map((s) => {
      const g = snap.equipment[s];
      return g ? `${g.itemId}+${g.enhanceLevel}` : '';
    }).join('|');
    if (sig === lastDollSig && els.doll.querySelectorAll('img.layer').length > 0) {
      return;
    }
    lastDollSig = sig;
    const layers = composePaperDoll(doll, snap.equipment, content.itemsById);
    // Keep VFX layer; only replace gear images
    const keep = els.vfx;
    els.doll.replaceChildren();
    for (const layer of layers) {
      const img = document.createElement('img');
      img.className = 'layer';
      img.alt = '';
      img.draggable = false;
      img.dataset.part = layerPartKind(layer.src, layer.kind);
      img.src = resolveDollAsset(layer.src);
      els.doll.appendChild(img);
    }
    els.doll.appendChild(keep);
  }

  function applyHpBar(
    fill: HTMLElement,
    bar: HTMLElement,
    numEl: HTMLElement,
    cur: number,
    max: number,
    emptyLabel: string,
  ): void {
    const pct = hpPct(cur, max);
    fill.style.width = `${pct}%`;
    const band = hpBand(pct);
    bar.dataset.band = band;
    fill.dataset.band = band;
    if (showDetailedNumbers && max > 0) {
      numEl.hidden = false;
      numEl.textContent = `${cur}/${max}`;
    } else {
      numEl.hidden = true;
      numEl.textContent = emptyLabel;
    }
  }

  function renderCombat(snap: GameSnapshot): void {
    const c = snap.combat;
    const enemy = c.enemy;
    renderSeekButtons(snap.seekMode);

    if (c.phase === 'fighting' && enemy) {
      els.enemyName.textContent = enemy.nameZh;
      els.vsTitle.textContent = `对峙 · ${enemy.nameZh}`;
      applyHpBar(
        els.enemyHp,
        els.enemyBar,
        els.enemyHpNum,
        enemy.hp,
        enemy.maxHp,
        '—',
      );
      const state = fightState(
        c.playerHp,
        c.playerMaxHp,
        enemy.hp,
        enemy.maxHp,
      );
      els.fightState.hidden = false;
      els.fightState.textContent = state;
      els.fightState.dataset.state = state;

      const pKey = `${enemy.defId}|${enemy.portrait ?? ''}`;
      if (pKey !== lastPortraitKey) {
        lastPortraitKey = pKey;
        const src = resolveEnemyPortrait(enemy.portrait, enemy.defId);
        els.enemyPortrait.innerHTML = '';
        const img = document.createElement('img');
        img.alt = enemy.nameZh;
        img.draggable = false;
        img.src = src;
        img.onerror = () => {
          img.onerror = null;
          img.src = resolveEnemyPortrait('portraits/tier_fallback.svg', 'fallback');
        };
        els.enemyPortrait.appendChild(img);
        els.enemyStage.dataset.enemyId = enemy.defId;
        els.enemyStage.classList.add('has-enemy');
      }
    } else if (c.phase === 'breather') {
      els.enemyName.textContent = '喘息中…';
      els.vsTitle.textContent = '喘息中…下一场即将开始';
      applyHpBar(els.enemyHp, els.enemyBar, els.enemyHpNum, 0, 0, '—');
      els.fightState.hidden = true;
      els.fightState.textContent = '';
      delete els.fightState.dataset.state;
      if (lastPortraitKey !== '') {
        lastPortraitKey = '';
        els.enemyPortrait.innerHTML = '';
        delete els.enemyStage.dataset.enemyId;
        els.enemyStage.classList.remove('has-enemy', 'hit');
      }
    } else {
      els.enemyName.textContent = '已暂停';
      els.vsTitle.textContent = '已暂停';
      applyHpBar(els.enemyHp, els.enemyBar, els.enemyHpNum, 0, 0, '—');
      els.fightState.hidden = true;
      els.fightState.textContent = '';
      delete els.fightState.dataset.state;
      if (lastPortraitKey !== '') {
        lastPortraitKey = '';
        els.enemyPortrait.innerHTML = '';
        delete els.enemyStage.dataset.enemyId;
        els.enemyStage.classList.remove('has-enemy', 'hit');
      }
    }

    applyHpBar(
      els.playerHp,
      els.playerBar,
      els.playerHpNum,
      c.playerHp,
      c.playerMaxHp,
      '—',
    );

    if (c.playerShield > 0) {
      const tier = shieldTier(c.playerShield, c.playerMaxHp);
      els.shield.textContent = showDetailedNumbers
        ? `护盾 ${c.playerShield}（${tier}）`
        : `${tier}护体中`;
    } else {
      els.shield.textContent = '';
    }

    const logSig = c.log.map((l) => l.text).join('\n');
    if (logSig !== lastLogSig) {
      lastLogSig = logSig;
      els.combatLog.replaceChildren();
      for (const line of c.log.slice(0, 5)) {
        const div = document.createElement('div');
        div.className = `log-line log-${line.kind}`;
        div.textContent = line.text;
        els.combatLog.appendChild(div);
      }
      if (c.log.length === 0) {
        const div = document.createElement('div');
        div.className = 'log-line meta';
        div.textContent = '战斗日志将显示在这里';
        els.combatLog.appendChild(div);
      }
    }

    if (c.lastEnemyHitSeq > lastEnemyHitSeq) {
      lastEnemyHitSeq = c.lastEnemyHitSeq;
      flashEnemyHit();
    }

    if (c.lastVfx && c.lastVfx.seq !== lastVfxSeq) {
      lastVfxSeq = c.lastVfx.seq;
      playVfx(c.lastVfx.vfx, c.lastVfx.nameZh);
    }
  }

  function skillBarSignature(snap: GameSnapshot): string {
    return snap.combat.skillSlots
      .map((s) => `${s.skillId ?? ''}:${s.ready ? 1 : 0}:${Math.ceil(s.cooldownRemainingMs / 200)}`)
      .join('|') + `|pick:${pickSlot}`;
  }

  function openPickerFor(slotIndex: number): void {
    pickSlot = pickSlot === slotIndex ? null : slotIndex;
    pickPassiveSlot = null;
    renderPassiveBar(engine.getSnapshot(), true);
    renderPassivePicker(engine.getSnapshot());
    renderSkillBar(engine.getSnapshot(), true);
    renderSkillPicker(engine.getSnapshot());
  }

  function renderSkillBar(snap: GameSnapshot, force = false): void {
    const sig = skillBarSignature(snap);
    if (!force && sig === lastSkillSig && els.skillBar.childElementCount === SKILL_BAR_SIZE) {
      // Lightweight CD text update only
      for (let i = 0; i < SKILL_BAR_SIZE; i++) {
        const slot = snap.combat.skillSlots[i];
        const btn = els.skillBar.children[i] as HTMLButtonElement | undefined;
        if (!btn || !slot?.skill) continue;
        const cdEl = btn.querySelector('.skill-cd');
        if (cdEl) {
          cdEl.textContent = slot.ready
            ? '就绪'
            : formatCd(slot.cooldownRemainingMs);
        }
        btn.classList.toggle('ready', slot.ready);
        btn.classList.toggle('cooling', !slot.ready);
      }
      return;
    }
    lastSkillSig = sig;

    els.skillBar.replaceChildren();
    for (let i = 0; i < SKILL_BAR_SIZE; i++) {
      const slot = snap.combat.skillSlots[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-slot';
      btn.setAttribute('data-slot', String(i));
      if (pickSlot === i) btn.classList.add('picking');

      if (slot?.skill) {
        btn.classList.toggle('ready', slot.ready);
        btn.classList.toggle('cooling', !slot.ready);
        const name = document.createElement('span');
        name.className = 'skill-name';
        name.textContent = slot.skill.nameZh;
        const cd = document.createElement('span');
        cd.className = 'skill-cd';
        cd.textContent = slot.ready ? '就绪' : formatCd(slot.cooldownRemainingMs);
        const hint = document.createElement('span');
        hint.className = 'skill-hint';
        hint.textContent = '点击更换';
        btn.append(name, cd, hint);
        btn.title = `${slot.skill.description ?? ''}\n点击打开选择器（清空 / 重选）`;
      } else {
        btn.classList.add('empty');
        btn.innerHTML =
          `<span class="skill-name">空位 ${i + 1}</span>` +
          `<span class="skill-cd">点击装配</span>`;
        btn.title = '点击选择已解锁技能';
      }

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openPickerFor(i);
      });
      els.skillBar.appendChild(btn);
    }
  }

  function renderSkillPicker(snap: GameSnapshot): void {
    els.skillPicker.replaceChildren();
    if (pickSlot === null) {
      els.skillPicker.hidden = true;
      els.skillPicker.classList.remove('open');
      return;
    }
    els.skillPicker.hidden = false;
    els.skillPicker.classList.add('open');

    const header = document.createElement('div');
    header.className = 'skill-picker-header';
    header.textContent = `为第 ${pickSlot + 1} 格选择技能`;
    els.skillPicker.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'skill-picker-actions';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'skill-pick-btn danger';
    clearBtn.textContent = '清空此格';
    clearBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const idx = pickSlot!;
      pickSlot = null;
      engine.setSkillBarSlot(idx, null);
      lastSkillSig = '';
      renderSkillBar(engine.getSnapshot(), true);
      renderSkillPicker(engine.getSnapshot());
    });
    actions.appendChild(clearBtn);

    const assigned = snap.combat.skillSlots[pickSlot]?.skill;
    if (
      assigned &&
      snap.combat.phase === 'fighting' &&
      snap.combat.skillSlots[pickSlot]?.ready
    ) {
      const castBtn = document.createElement('button');
      castBtn.type = 'button';
      castBtn.className = 'skill-pick-btn primary';
      castBtn.textContent = `立即施放「${assigned.nameZh}」`;
      castBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        engine.useSkill(assigned.id);
        pickSlot = null;
        lastSkillSig = '';
        renderSkillBar(engine.getSnapshot(), true);
        renderSkillPicker(engine.getSnapshot());
      });
      actions.appendChild(castBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'skill-pick-btn';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pickSlot = null;
      lastSkillSig = '';
      renderSkillBar(engine.getSnapshot(), true);
      renderSkillPicker(engine.getSnapshot());
    });
    actions.appendChild(closeBtn);
    els.skillPicker.appendChild(actions);

    if (snap.availableSkills.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent =
        '暂无可用技能。请先装备带★的道具（腕刃 / 臂甲 / 胸甲 / 头盔 / 圣物 / 头骨等）。';
      els.skillPicker.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'skill-picker-list';
    for (const skill of snap.availableSkills) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-pick-btn choice';
      const already = snap.skillBar.includes(skill.id);
      btn.textContent = `${skill.nameZh} · CD ${((skill.cooldownMs ?? 0) / 1000).toFixed(0)}秒${
        already ? '（已装配）' : ''
      }`;
      btn.title = skill.description ?? '';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = pickSlot!;
        pickSlot = null;
        engine.setSkillBarSlot(idx, skill.id);
        lastSkillSig = '';
        renderSkillBar(engine.getSnapshot(), true);
        renderSkillPicker(engine.getSnapshot());
      });
      list.appendChild(btn);
    }
    els.skillPicker.appendChild(list);
  }

  function shortPassiveLabel(skill: {
    effect: { type: string; amount: number };
    description?: string;
  }): string {
    const t = skill.effect.type;
    const a = skill.effect.amount;
    if (t === 'damageAmp') return `伤害+${Math.round(a * 100)}%`;
    if (t === 'damageReduction') return `减伤${Math.round(a * 100)}%`;
    if (t === 'regen') return '缓慢回血';
    return skill.description ?? '被动效果';
  }

  function passiveBarSignature(snap: GameSnapshot): string {
    return (
      snap.combat.passiveSlots.map((slot) => `${slot.skillId ?? ''}`).join('|') +
      `|pick:${pickPassiveSlot}`
    );
  }

  function openPassivePickerFor(slotIndex: number): void {
    pickPassiveSlot = pickPassiveSlot === slotIndex ? null : slotIndex;
    pickSlot = null;
    renderSkillBar(engine.getSnapshot(), true);
    renderSkillPicker(engine.getSnapshot());
    renderPassiveBar(engine.getSnapshot(), true);
    renderPassivePicker(engine.getSnapshot());
  }

  function renderPassiveBar(snap: GameSnapshot, force = false): void {
    const sig = passiveBarSignature(snap);
    if (
      !force &&
      sig === lastPassiveSig &&
      els.passiveBar.childElementCount === PASSIVE_SKILL_BAR_SIZE
    ) {
      return;
    }
    lastPassiveSig = sig;
    els.passiveBar.replaceChildren();
    for (let i = 0; i < PASSIVE_SKILL_BAR_SIZE; i++) {
      const slot = snap.combat.passiveSlots[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-slot passive-slot';
      btn.setAttribute('data-slot', String(i));
      if (pickPassiveSlot === i) btn.classList.add('picking');
      if (slot?.skill) {
        btn.classList.add('ready');
        const name = document.createElement('span');
        name.className = 'skill-name';
        name.textContent = slot.skill.nameZh;
        const desc = document.createElement('span');
        desc.className = 'skill-cd';
        desc.textContent = shortPassiveLabel(slot.skill);
        const hint = document.createElement('span');
        hint.className = 'skill-hint';
        hint.textContent = '持续生效 · 点击更换';
        btn.append(name, desc, hint);
        btn.title = `${slot.skill.description ?? shortPassiveLabel(slot.skill)}\n点击打开选择器（清空 / 重选）`;
      } else {
        btn.classList.add('empty');
        btn.innerHTML =
          `<span class="skill-name">被动 ${i + 1}</span>` +
          `<span class="skill-cd">点击装配</span>`;
        btn.title = '点击选择已解锁被动';
      }
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openPassivePickerFor(i);
      });
      els.passiveBar.appendChild(btn);
    }
  }

  function renderPassivePicker(snap: GameSnapshot): void {
    els.passivePicker.replaceChildren();
    if (pickPassiveSlot === null) {
      els.passivePicker.hidden = true;
      els.passivePicker.classList.remove('open');
      return;
    }
    els.passivePicker.hidden = false;
    els.passivePicker.classList.add('open');

    const header = document.createElement('div');
    header.className = 'skill-picker-header';
    header.textContent = `为被动第 ${pickPassiveSlot + 1} 格选择技能`;
    els.passivePicker.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'skill-picker-actions';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'skill-pick-btn danger';
    clearBtn.textContent = '清空此格';
    clearBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const idx = pickPassiveSlot!;
      pickPassiveSlot = null;
      engine.setPassiveSkillBarSlot(idx, null);
      lastPassiveSig = '';
      renderPassiveBar(engine.getSnapshot(), true);
      renderPassivePicker(engine.getSnapshot());
    });
    actions.appendChild(clearBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'skill-pick-btn';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pickPassiveSlot = null;
      lastPassiveSig = '';
      renderPassiveBar(engine.getSnapshot(), true);
      renderPassivePicker(engine.getSnapshot());
    });
    actions.appendChild(closeBtn);
    els.passivePicker.appendChild(actions);

    if (snap.availablePassiveSkills.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent =
        '暂无可用被动。请先装备带被动的道具（战地兴奋剂 / 护胫 / 胸甲 / 头盔 / 圣物等）。';
      els.passivePicker.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'skill-picker-list';
    for (const skill of snap.availablePassiveSkills) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-pick-btn choice';
      const already = snap.passiveSkillBar.includes(skill.id);
      btn.textContent = `${skill.nameZh} · ${shortPassiveLabel(skill)}${
        already ? '（已装配）' : ''
      }`;
      btn.title = skill.description ?? '';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = pickPassiveSlot!;
        pickPassiveSlot = null;
        engine.setPassiveSkillBarSlot(idx, skill.id);
        lastPassiveSig = '';
        renderPassiveBar(engine.getSnapshot(), true);
        renderPassivePicker(engine.getSnapshot());
      });
      list.appendChild(btn);
    }
    els.passivePicker.appendChild(list);
  }

  function renderEquip(snap: GameSnapshot): void {
    const sig = EQUIP_SLOTS.map((s) => {
      const g = snap.equipment[s];
      return g ? `${g.itemId}+${g.enhanceLevel}` : '';
    }).join('|');
    if (sig === lastEquipSig && els.equip.childElementCount === EQUIP_SLOTS.length) {
      return;
    }
    lastEquipSig = sig;

    els.equip.replaceChildren();
    for (const slot of EQUIP_SLOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      const gear = snap.equipment[slot];
      const item = gear ? content.itemsById.get(gear.itemId) : undefined;
      btn.innerHTML = `<span class="slot-label">${SLOT_LABEL_ZH[slot]}</span>`;
      const span = document.createElement('span');
      span.className = 'slot-item';
      if (item && gear) {
        span.classList.add(rarityClass(item.rarity));
        if (isEnhanceMilestone(gear.enhanceLevel)) span.classList.add('enhance-glow');
        const marks =
          (item.skill && (item.skill.kind ?? 'active') === 'active' ? '★' : '') +
          (item.passiveSkill || item.skill?.kind === 'passive' ? '◆' : '');
        const plus = gear.enhanceLevel > 0 ? `+${gear.enhanceLevel}` : '';
        span.textContent = `${item.nameZh}${plus}${marks}`;
        const tips: string[] = [];
        if (gear.enhanceLevel > 0) tips.push(`强化 +${gear.enhanceLevel}`);
        if (item.skill && (item.skill.kind ?? 'active') === 'active') {
          tips.push(`主动：${item.skill.nameZh}`);
        }
        if (item.passiveSkill) tips.push(`被动：${item.passiveSkill.nameZh}`);
        else if (item.skill?.kind === 'passive') tips.push(`被动：${item.skill.nameZh}`);
        tips.push('左键卸下 · 强化面板可选为主装备');
        btn.title = tips.join(' — ');
        if (enhanceOpen) {
          btn.classList.add('enhance-pickable');
          if (
            enhanceMain?.kind === 'equipped' &&
            enhanceMain.slot === slot
          ) {
            btn.classList.add('enhance-main');
          }
        }
      } else {
        span.textContent = '空';
        span.style.opacity = '0.4';
      }
      btn.appendChild(span);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cur = engine.getSnapshot().equipment[slot];
        if (!cur) return;
        if (enhanceOpen) {
          enhanceMain = { kind: 'equipped', slot };
          enhanceFodderIndex = null;
          lastInvSig = '';
          renderEnhance(engine.getSnapshot());
          renderEquip(engine.getSnapshot());
          renderInv(engine.getSnapshot());
          return;
        }
        const s = engine.getSave();
        const result = unequipSlot(s.inventory, s.equipment, slot);
        engine.replaceSave({
          ...s,
          inventory: result.inventory,
          equipment: result.equipment,
        });
      });
      els.equip.appendChild(btn);
    }
  }

  function renderShop(snap: GameSnapshot): void {
    els.fragments.textContent = `碎片 ${snap.fragments}`;
    els.shopPanel.hidden = !shopOpen;
    els.shopToggle.textContent = shopOpen ? '收起商店' : '打开商店';
    if (!shopOpen) return;
    els.shopGrid.replaceChildren();
    for (const rarity of RARITY_ORDER) {
      const cost = SHOP_PULL_COST[rarity];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `shop-pull rarity-${rarity}`;
      btn.disabled = snap.fragments < cost;
      btn.innerHTML =
        `<span class="shop-rarity">${RARITY_LABEL_ZH[rarity]}</span>` +
        `<span class="shop-cost">${cost} 碎片</span>`;
      btn.title = `抽取一件${RARITY_LABEL_ZH[rarity]}装备（约等于 10 次同稀有度分解）`;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const res = engine.shopPull(rarity);
        if (!res.ok) {
          alert(res.reason ?? '抽取失败');
          return;
        }
        lastInvSig = '';
        renderAll(engine.getSnapshot(), null);
      });
      els.shopGrid.appendChild(btn);
    }
  }

  function renderEnhance(snap: GameSnapshot): void {
    els.enhancePanel.hidden = !enhanceOpen;
    els.enhanceToggle.textContent = enhanceOpen ? '收起强化' : '打开强化';
    if (!enhanceOpen) {
      els.enhanceStatus.textContent = '';
      els.enhanceActions.replaceChildren();
      return;
    }

    let mainLabel = '未选择主装备（点装备栏或背包中的装备）';
    let mainLv = 0;
    if (enhanceMain?.kind === 'equipped') {
      const g = snap.equipment[enhanceMain.slot];
      const it = g ? content.itemsById.get(g.itemId) : undefined;
      if (g && it) {
        mainLv = g.enhanceLevel;
        mainLabel = `主：${it.nameZh} +${mainLv}（${SLOT_LABEL_ZH[enhanceMain.slot]}）`;
      }
    } else if (enhanceMain?.kind === 'inventory') {
      const row = snap.inventory[enhanceMain.index];
      const it = row ? content.itemsById.get(row.itemId) : undefined;
      if (row && it) {
        mainLv = clampEnhanceLevel(row.enhanceLevel ?? 0);
        mainLabel = `主：${it.nameZh} +${mainLv}（背包）`;
      }
    }

    let fodderLabel = '未选择材料（点背包中同强化等级的另一件装备）';
    if (enhanceFodderIndex != null) {
      const row = snap.inventory[enhanceFodderIndex];
      const it = row ? content.itemsById.get(row.itemId) : undefined;
      if (row && it) {
        fodderLabel = `材：${it.nameZh} +${clampEnhanceLevel(row.enhanceLevel ?? 0)}`;
      }
    }

    const chance =
      mainLv < ENHANCE_CAP
        ? enhanceSuccessChance(mainLv, snap.enhanceFailStreak)
        : 0;
    els.enhanceStatus.innerHTML =
      `<div>${mainLabel}</div><div>${fodderLabel}</div>` +
      `<div class="meta">成功率约 ${Math.round(chance * 100)}% · 连续失败 ${snap.enhanceFailStreak} · 上限 +${ENHANCE_CAP}</div>`;

    els.enhanceActions.replaceChildren();
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'primary';
    go.textContent = '尝试强化 +1';
    go.disabled = !enhanceMain || enhanceFodderIndex == null || mainLv >= ENHANCE_CAP;
    go.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!enhanceMain || enhanceFodderIndex == null) return;
      const res = engine.enhanceGear(enhanceMain, enhanceFodderIndex);
      enhanceFodderIndex = null;
      if (res.ok && res.success && enhanceMain.kind === 'inventory') {
        // index may have shifted; clear selection to be safe
        enhanceMain = null;
      }
      lastInvSig = '';
      lastEquipSig = '';
      renderAll(engine.getSnapshot(), null);
      if (res.ok === false) alert(res.reason ?? '无法强化');
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = '清除选择';
    clear.addEventListener('click', (ev) => {
      ev.stopPropagation();
      enhanceMain = null;
      enhanceFodderIndex = null;
      lastInvSig = '';
      lastEquipSig = '';
      renderEnhance(engine.getSnapshot());
      renderEquip(engine.getSnapshot());
      renderInv(engine.getSnapshot());
    });
    els.enhanceActions.append(go, clear);
  }

  function renderInv(snap: GameSnapshot): void {
    const sig =
      snap.inventory
        .map((e) => `${e.itemId}:${e.qty}:${e.enhanceLevel ?? 0}`)
        .join(',') +
      '|' +
      EQUIP_SLOTS.map((s) => {
        const g = snap.equipment[s];
        return g ? `${g.itemId}+${g.enhanceLevel}` : '';
      }).join('|') +
      `|enh:${enhanceOpen}:${enhanceMain ? JSON.stringify(enhanceMain) : ''}:${enhanceFodderIndex}`;
    if (sig === lastInvSig) return;
    lastInvSig = sig;

    els.inv.replaceChildren();
    if (snap.inventory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent = '背包空空如也，继续挂机…';
      els.inv.appendChild(empty);
      return;
    }

    type Row = {
      item: ItemDef;
      qty: number;
      equippable: boolean;
      enhanceLevel: number;
      index: number;
      stackable: boolean;
    };
    const rows: Row[] = [];
    // Preserve indices for salvage/enhance — render each inventory row
    snap.inventory.forEach((entry, index) => {
      const item = content.itemsById.get(entry.itemId);
      if (!item) return;
      rows.push({
        item,
        qty: entry.qty,
        equippable: !!item.slot,
        enhanceLevel: clampEnhanceLevel(entry.enhanceLevel ?? 0),
        index,
        stackable: item.stackable,
      });
    });

    const rarityRank: Record<Rarity, number> = {
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    };
    rows.sort((a, b) => {
      if (a.equippable !== b.equippable) return a.equippable ? -1 : 1;
      return rarityRank[b.item.rarity] - rarityRank[a.item.rarity];
    });

    for (const row of rows) {
      const wrap = document.createElement('div');
      wrap.className = 'inv-row';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inv-item';
      if (enhanceOpen && row.equippable) btn.classList.add('enhance-pickable');
      if (
        enhanceMain?.kind === 'inventory' &&
        enhanceMain.index === row.index
      ) {
        btn.classList.add('enhance-main');
      }
      if (enhanceFodderIndex === row.index) btn.classList.add('enhance-fodder');

      const name = document.createElement('span');
      name.className = rarityClass(row.item.rarity);
      if (isEnhanceMilestone(row.enhanceLevel)) name.classList.add('enhance-glow');
      const skillMark =
        (row.item.skill && (row.item.skill.kind ?? 'active') === 'active' ? '★' : '') +
        (row.item.passiveSkill || row.item.skill?.kind === 'passive' ? '◆' : '');
      name.textContent = `${itemLabel(row.item, row.enhanceLevel)}${skillMark}`;
      const qty = document.createElement('span');
      qty.className = 'qty';
      if (row.stackable) qty.textContent = `×${row.qty}`;
      else if (row.item.slot) qty.textContent = SLOT_LABEL_ZH[row.item.slot];
      else qty.textContent = '';
      btn.append(name, qty);
      {
        const tips = [row.item.description ?? ''];
        if (row.enhanceLevel > 0) tips.push(`强化 +${row.enhanceLevel}`);
        if (row.item.skill && (row.item.skill.kind ?? 'active') === 'active') {
          tips.push(`主动：${row.item.skill.nameZh}`);
        }
        if (row.item.passiveSkill) tips.push(`被动：${row.item.passiveSkill.nameZh}`);
        tips.push(`分解可得 ${SALVAGE_FRAGMENTS[row.item.rarity]} 碎片`);
        btn.title = tips.filter(Boolean).join('\n');
      }

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (enhanceOpen && row.equippable) {
          if (
            !enhanceMain ||
            (enhanceMain.kind === 'inventory' &&
              enhanceMain.index === row.index)
          ) {
            enhanceMain = { kind: 'inventory', index: row.index };
            enhanceFodderIndex = null;
          } else {
            const mainLv =
              enhanceMain.kind === 'equipped'
                ? engine.getSnapshot().equipment[enhanceMain.slot]?.enhanceLevel ?? 0
                : clampEnhanceLevel(
                    engine.getSnapshot().inventory[enhanceMain.index]
                      ?.enhanceLevel ?? 0,
                  );
            if (row.enhanceLevel !== mainLv) {
              alert(`材料须与主装备同为 +${mainLv}`);
              return;
            }
            enhanceFodderIndex = row.index;
          }
          lastInvSig = '';
          lastEquipSig = '';
          renderEnhance(engine.getSnapshot());
          renderEquip(engine.getSnapshot());
          renderInv(engine.getSnapshot());
          return;
        }
        if (!row.equippable) return;
        const s = engine.getSave();
        const result = equipItem(s.inventory, s.equipment, row.item, {
          inventoryIndex: row.index,
        });
        if (!result) return;
        engine.replaceSave({
          ...s,
          inventory: result.inventory,
          equipment: result.equipment,
        });
      });

      const salvageBtn = document.createElement('button');
      salvageBtn.type = 'button';
      salvageBtn.className = 'salvage-btn';
      salvageBtn.textContent = '分解';
      salvageBtn.title = `分解 → ${SALVAGE_FRAGMENTS[row.item.rarity]} 碎片`;
      salvageBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const res = engine.salvageInventoryAt(row.index);
        if (!res.ok) return;
        if (enhanceMain?.kind === 'inventory' && enhanceMain.index === row.index) {
          enhanceMain = null;
        }
        if (enhanceFodderIndex === row.index) enhanceFodderIndex = null;
        lastInvSig = '';
        renderAll(engine.getSnapshot(), null);
      });

      wrap.append(btn, salvageBtn);
      els.inv.appendChild(wrap);
    }
  }

  function renderDrops(snap: GameSnapshot): void {
    els.drops.replaceChildren();
    if (snap.recentDrops.length === 0) {
      const d = document.createElement('div');
      d.className = 'drop-line meta';
      d.textContent = '尚无掉落';
      els.drops.appendChild(d);
      return;
    }
    for (const id of snap.recentDrops.slice(0, 8)) {
      const item = content.itemsById.get(id);
      const line = document.createElement('div');
      line.className = 'drop-chip';
      if (item) {
        line.classList.add(rarityClass(item.rarity));
        line.textContent = `✦ ${item.nameZh}`;
      } else {
        line.textContent = id;
      }
      els.drops.appendChild(line);
    }
  }

  function renderAll(snap: GameSnapshot, _tick: TickResult | null): void {
    const killing = snap.idleStatus === 'killing';
    els.dot.classList.toggle('paused', !killing);
    if (!killing) {
      els.status.textContent = '已暂停';
    } else if (snap.combat.phase === 'fighting') {
      els.status.textContent = '交战中';
    } else {
      els.status.textContent = `搜寻中 · ${SEEK_MODE_LABEL_ZH[snap.seekMode]}`;
    }
    els.level.textContent = String(snap.level);
    els.xp.textContent = String(snap.xp);
    els.xpNext.textContent = String(snap.xpToNext);
    const pct =
      snap.xpToNext > 0 ? Math.min(100, (snap.xp / snap.xpToNext) * 100) : 0;
    els.xpFill.style.width = `${pct}%`;
    els.toggle.textContent = killing ? '暂停挂机' : '继续挂机';

    renderCombat(snap);
    renderSkillBar(snap);
    renderPassiveBar(snap);
    if (pickSlot !== null) {
      const open = els.skillPicker.classList.contains('open');
      if (!open) renderSkillPicker(snap);
    } else if (!els.skillPicker.hidden) {
      renderSkillPicker(snap);
    }
    if (pickPassiveSlot !== null) {
      const open = els.passivePicker.classList.contains('open');
      if (!open) renderPassivePicker(snap);
    } else if (!els.passivePicker.hidden) {
      renderPassivePicker(snap);
    }
    renderDoll(snap);
    renderEquip(snap);
    renderShop(snap);
    renderEnhance(snap);
    renderInv(snap);
    renderDrops(snap);
  }

  // Close pickers when clicking outside skill sections
  panel.addEventListener('click', (ev) => {
    const t = ev.target as Node;
    if (pickSlot !== null) {
      if (!els.skillBar.contains(t) && !els.skillPicker.contains(t)) {
        pickSlot = null;
        lastSkillSig = '';
        renderSkillBar(engine.getSnapshot(), true);
        renderSkillPicker(engine.getSnapshot());
      }
    }
    if (pickPassiveSlot !== null) {
      if (!els.passiveBar.contains(t) && !els.passivePicker.contains(t)) {
        pickPassiveSlot = null;
        lastPassiveSig = '';
        renderPassiveBar(engine.getSnapshot(), true);
        renderPassivePicker(engine.getSnapshot());
      }
    }
  });

  els.seekRow.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-seek]') as HTMLElement | null;
    if (!t?.dataset.seek) return;
    const mode = t.dataset.seek as SeekMode;
    engine.setSeekMode(mode);
  });

  els.detailToggle.addEventListener('change', () => {
    showDetailedNumbers = els.detailToggle.checked;
    panel.classList.toggle('show-detail-nums', showDetailedNumbers);
    try {
      localStorage.setItem(DETAIL_KEY, showDetailedNumbers ? '1' : '0');
    } catch {
      /* */
    }
    renderCombat(engine.getSnapshot());
  });

  engine.subscribe((snap, tick) => renderAll(snap, tick));
  renderAll(engine.getSnapshot(), null);
  renderSkillPicker(engine.getSnapshot());
  renderPassivePicker(engine.getSnapshot());

  els.shopToggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    shopOpen = !shopOpen;
    if (shopOpen) enhanceOpen = false;
    renderShop(engine.getSnapshot());
    renderEnhance(engine.getSnapshot());
    lastEquipSig = '';
    lastInvSig = '';
    renderEquip(engine.getSnapshot());
    renderInv(engine.getSnapshot());
  });

  els.enhanceToggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    enhanceOpen = !enhanceOpen;
    if (enhanceOpen) shopOpen = false;
    if (!enhanceOpen) {
      enhanceMain = null;
      enhanceFodderIndex = null;
    }
    renderShop(engine.getSnapshot());
    renderEnhance(engine.getSnapshot());
    lastEquipSig = '';
    lastInvSig = '';
    renderEquip(engine.getSnapshot());
    renderInv(engine.getSnapshot());
  });

  els.toggle.addEventListener('click', () => {
    if (engine.getSnapshot().idleStatus === 'killing') engine.pause();
    else engine.start();
  });

  els.reset.addEventListener('click', () => {
    if (!confirm('确定重置存档？等级 / 背包 / 装备 / 碎片 / 强化 / 技能栏将清空。')) return;
    engine.pause();
    const fresh = defaultSave(content.world.id);
    writeSave(fresh);
    pickSlot = null;
    pickPassiveSlot = null;
    enhanceMain = null;
    enhanceFodderIndex = null;
    shopOpen = false;
    enhanceOpen = false;
    lastSkillSig = '';
    lastPassiveSig = '';
    lastEquipSig = '';
    lastInvSig = '';
    lastDollSig = '';
    lastLogSig = '';
    lastEnemyHitSeq = 0;
    lastPortraitKey = '';
    engine.replaceSave(fresh);
    engine.start();
  });

  engine.start();

  (window as unknown as { __idle?: IdleEngine; __doll?: PaperDollDef }).__idle =
    engine;
  (window as unknown as { __doll?: PaperDollDef }).__doll = doll;
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<pre style="color:#f88;padding:16px;background:#200">Failed to start:\n${String(err)}</pre>`;
  }
});

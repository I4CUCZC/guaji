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
  SPACE_ITEM_IDS,
  SKILL_BAR_SIZE,
} from '@core/index';
import type {
  EquipSlot,
  GameSnapshot,
  ItemDef,
  PaperDollDef,
  Rarity,
  TickResult,
} from '@core/index';
import { createBridge } from './bridge';

const WORLD_BASE = './content/worlds/space';
const DOLL_BASE = './content/characters/paper-doll';

const SLOT_LABEL_ZH: Record<EquipSlot, string> = {
  head: '头部',
  body: '身体',
  arm_left: '左臂',
  arm_right: '右臂',
  legs: '腿部',
  weapon: '武器',
  accessory: '饰品',
};

function rarityClass(r: Rarity): string {
  return `rarity-${r}`;
}

function itemLabel(item: ItemDef): string {
  return `${item.nameZh}〔${RARITY_LABEL_ZH[item.rarity]}〕`;
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
    <div class="main-row">
      <div class="doll-wrap">
        <div class="doll-stage" data-doll>
          <div class="vfx-layer" data-vfx aria-hidden="true"></div>
        </div>
        <div class="meta no-drag">纸娃娃预览</div>
      </div>
      <div class="idle-box no-drag">
        <div class="status-line">
          <span class="status-dot" data-dot></span>
          <span data-status>准备中…</span>
        </div>
        <div class="xp-row">
          <div>等级 <strong data-level>1</strong> · XP <span data-xp>0</span>/<span data-xp-next>50</span></div>
          <div class="xp-bar"><div class="xp-fill" data-xp-fill></div></div>
        </div>
        <div class="combat-block">
          <div class="combat-title" data-enemy-name>等待遭遇…</div>
          <div class="hp-row">
            <span class="hp-label">敌</span>
            <div class="hp-bar enemy"><div class="hp-fill" data-enemy-hp></div></div>
            <span class="hp-num" data-enemy-hp-num>—</span>
          </div>
          <div class="hp-row">
            <span class="hp-label">我</span>
            <div class="hp-bar player"><div class="hp-fill" data-player-hp></div></div>
            <span class="hp-num" data-player-hp-num>—</span>
          </div>
          <div class="shield-line meta" data-shield></div>
          <div class="combat-log" data-combat-log></div>
        </div>
      </div>
    </div>
    <div class="skill-section no-drag">
      <div class="section-title">技能栏（点空位装配 · 点已装可清空/重选 · 战斗中自动释放）</div>
      <div class="skill-bar" data-skill-bar></div>
      <div class="skill-picker" data-skill-picker hidden></div>
    </div>
    <div class="equip-section no-drag">
      <div class="section-title">装备栏</div>
      <div class="equip-grid" data-equip></div>
    </div>
    <div class="inv-section no-drag">
      <div class="section-title">背包（点击可装备）</div>
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
    <p class="hint no-drag">一场势均力敌的遭遇约 5 分钟。点技能栏空位打开选择器，选已解锁技能装配；点已装配技能可清空或更换。数据保存在 localStorage。</p>
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
    enemyName: panel.querySelector('[data-enemy-name]') as HTMLElement,
    enemyHp: panel.querySelector('[data-enemy-hp]') as HTMLElement,
    enemyHpNum: panel.querySelector('[data-enemy-hp-num]') as HTMLElement,
    playerHp: panel.querySelector('[data-player-hp]') as HTMLElement,
    playerHpNum: panel.querySelector('[data-player-hp-num]') as HTMLElement,
    shield: panel.querySelector('[data-shield]') as HTMLElement,
    combatLog: panel.querySelector('[data-combat-log]') as HTMLElement,
    drops: panel.querySelector('[data-drops]') as HTMLElement,
    skillBar: panel.querySelector('[data-skill-bar]') as HTMLElement,
    skillPicker: panel.querySelector('[data-skill-picker]') as HTMLElement,
    equip: panel.querySelector('[data-equip]') as HTMLElement,
    inv: panel.querySelector('[data-inv]') as HTMLElement,
    toggle: panel.querySelector('[data-toggle]') as HTMLButtonElement,
    reset: panel.querySelector('[data-reset]') as HTMLButtonElement,
  };

  els.world.textContent = content.world.nameZh;

  let pickSlot: number | null = null;
  let lastSkillSig = '';
  let lastEquipSig = '';
  let lastInvSig = '';
  let lastDollSig = '';
  let lastVfxSeq = 0;
  let lastLogSig = '';

  function resolveDollAsset(src: string): string {
    try {
      return new URL(`${DOLL_BASE}/${src}`, window.location.href).href;
    } catch {
      return `${DOLL_BASE}/${src}`;
    }
  }

  function playVfx(vfx: string, nameZh: string): void {
    const stage = els.doll;
    stage.classList.remove(
      'vfx-playing-slash',
      'vfx-playing-heal',
      'vfx-playing-shield',
      'vfx-playing-acid',
    );
    // force reflow so re-trigger works
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
    }
    els.vfx.appendChild(burst);

    window.setTimeout(() => {
      stage.classList.remove(`vfx-playing-${vfx}`);
      if (els.vfx.contains(burst)) burst.remove();
    }, 700);
  }

  function renderDoll(snap: GameSnapshot): void {
    const sig = EQUIP_SLOTS.map((s) => snap.equipment[s] ?? '').join('|');
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
      img.src = resolveDollAsset(layer.src);
      els.doll.appendChild(img);
    }
    els.doll.appendChild(keep);
  }

  function renderCombat(snap: GameSnapshot): void {
    const c = snap.combat;
    const enemy = c.enemy;
    if (c.phase === 'fighting' && enemy) {
      els.enemyName.textContent = `遭遇了${enemy.nameZh}`;
      els.enemyHp.style.width = `${hpPct(enemy.hp, enemy.maxHp)}%`;
      els.enemyHpNum.textContent = `${enemy.hp}/${enemy.maxHp}`;
    } else if (c.phase === 'breather') {
      els.enemyName.textContent = '喘息中…下一场即将开始';
      els.enemyHp.style.width = '0%';
      els.enemyHpNum.textContent = '—';
    } else {
      els.enemyName.textContent = '已暂停';
      els.enemyHp.style.width = '0%';
      els.enemyHpNum.textContent = '—';
    }

    els.playerHp.style.width = `${hpPct(c.playerHp, c.playerMaxHp)}%`;
    els.playerHpNum.textContent = `${c.playerHp}/${c.playerMaxHp}`;
    els.shield.textContent =
      c.playerShield > 0 ? `护盾 ${c.playerShield}` : '';

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
      btn.textContent = `${skill.nameZh} · CD ${(skill.cooldownMs / 1000).toFixed(0)}秒${
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

  function renderEquip(snap: GameSnapshot): void {
    const sig = EQUIP_SLOTS.map((s) => snap.equipment[s] ?? '').join('|');
    if (sig === lastEquipSig && els.equip.childElementCount === EQUIP_SLOTS.length) {
      return;
    }
    lastEquipSig = sig;

    els.equip.replaceChildren();
    for (const slot of EQUIP_SLOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      const itemId = snap.equipment[slot];
      const item = itemId ? content.itemsById.get(itemId) : undefined;
      btn.innerHTML = `<span class="slot-label">${SLOT_LABEL_ZH[slot]}</span>`;
      const span = document.createElement('span');
      span.className = 'slot-item';
      if (item) {
        span.classList.add(rarityClass(item.rarity));
        span.textContent = item.skill ? `${item.nameZh}★` : item.nameZh;
        btn.title = item.skill
          ? `技能：${item.skill.nameZh} — 点击卸下`
          : '点击卸下';
      } else {
        span.textContent = '空';
        span.style.opacity = '0.4';
      }
      btn.appendChild(span);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!engine.getSnapshot().equipment[slot]) return;
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

  function renderInv(snap: GameSnapshot): void {
    const sig = snap.inventory.map((e) => `${e.itemId}:${e.qty}`).join(',') +
      '|' +
      EQUIP_SLOTS.map((s) => snap.equipment[s] ?? '').join('|');
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

    const rows: { item: ItemDef; qty: number; equippable: boolean }[] = [];
    const seenStack = new Map<string, number>();
    for (const entry of snap.inventory) {
      const item = content.itemsById.get(entry.itemId);
      if (!item) continue;
      if (item.stackable) {
        seenStack.set(item.id, (seenStack.get(item.id) ?? 0) + entry.qty);
      } else {
        rows.push({ item, qty: entry.qty, equippable: !!item.slot });
      }
    }
    for (const [id, qty] of seenStack) {
      const item = content.itemsById.get(id);
      if (item) rows.push({ item, qty, equippable: !!item.slot });
    }

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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inv-item';
      btn.disabled = !row.equippable;
      const name = document.createElement('span');
      name.className = rarityClass(row.item.rarity);
      const skillMark = row.item.skill ? '★' : '';
      name.textContent = `${itemLabel(row.item)}${skillMark}`;
      const qty = document.createElement('span');
      qty.className = 'qty';
      qty.textContent = row.equippable
        ? row.item.slot
          ? SLOT_LABEL_ZH[row.item.slot]
          : ''
        : `×${row.qty}`;
      if (row.item.stackable) qty.textContent = `×${row.qty}`;
      btn.append(name, qty);
      btn.title = row.item.skill
        ? `${row.item.description ?? ''}\n技能：${row.item.skill.nameZh}`
        : row.item.description ?? '';
      if (row.equippable) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const s = engine.getSave();
          const result = equipItem(s.inventory, s.equipment, row.item);
          if (!result) return;
          engine.replaceSave({
            ...s,
            inventory: result.inventory,
            equipment: result.equipment,
          });
        });
      }
      els.inv.appendChild(btn);
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
      els.status.textContent = '搜寻中';
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
    // picker only rebuilt when pickSlot changes / equip changes — keep open state
    if (pickSlot !== null) {
      // refresh available list without closing
      const open = els.skillPicker.classList.contains('open');
      if (!open) renderSkillPicker(snap);
    } else if (!els.skillPicker.hidden) {
      renderSkillPicker(snap);
    }
    renderDoll(snap);
    renderEquip(snap);
    renderInv(snap);
    renderDrops(snap);
  }

  // Close picker when clicking outside skill section
  panel.addEventListener('click', (ev) => {
    if (pickSlot === null) return;
    const t = ev.target as Node;
    if (els.skillBar.contains(t) || els.skillPicker.contains(t)) return;
    pickSlot = null;
    lastSkillSig = '';
    renderSkillBar(engine.getSnapshot(), true);
    renderSkillPicker(engine.getSnapshot());
  });

  engine.subscribe((snap, tick) => renderAll(snap, tick));
  renderAll(engine.getSnapshot(), null);
  renderSkillPicker(engine.getSnapshot());

  els.toggle.addEventListener('click', () => {
    if (engine.getSnapshot().idleStatus === 'killing') engine.pause();
    else engine.start();
  });

  els.reset.addEventListener('click', () => {
    if (!confirm('确定重置存档？等级 / 背包 / 装备 / 技能栏将清空。')) return;
    engine.pause();
    const fresh = defaultSave(content.world.id);
    writeSave(fresh);
    pickSlot = null;
    lastSkillSig = '';
    lastEquipSig = '';
    lastInvSig = '';
    lastDollSig = '';
    lastLogSig = '';
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

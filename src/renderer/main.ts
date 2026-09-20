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

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  const bridge = createBridge();
  document.body.classList.add(bridge.isElectron ? 'electron' : 'browser-demo');

  // Electron gear panel needs mouse; disable click-through for MVP panel
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
    itemsById: content.itemsById,
    save,
    persist: true,
  });

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header">
      <h1>挂机桌宠 · 星际挂机</h1>
      <span class="world-badge" data-world></span>
    </div>
    <div class="main-row">
      <div class="doll-wrap">
        <div class="doll-stage" data-doll></div>
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
        <div class="meta" data-tick-msg>等待战斗…</div>
        <div>
          <div class="section-title">最近掉落</div>
          <div class="last-drops" data-drops></div>
        </div>
      </div>
    </div>
    <div class="no-drag">
      <div class="section-title">装备栏</div>
      <div class="equip-grid" data-equip></div>
    </div>
    <div class="no-drag" style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div class="section-title">背包（点击可装备）</div>
      <div class="inv-list" data-inv></div>
    </div>
    <div class="toolbar no-drag">
      <button type="button" class="primary" data-toggle>暂停挂机</button>
      <button type="button" data-reset>重置存档</button>
    </div>
    <p class="hint no-drag">挂机自动战斗获得经验与战利品。装备后纸娃娃图层会切换。数据保存在 localStorage。</p>
  `;
  app.appendChild(panel);

  const els = {
    world: panel.querySelector('[data-world]') as HTMLElement,
    doll: panel.querySelector('[data-doll]') as HTMLElement,
    dot: panel.querySelector('[data-dot]') as HTMLElement,
    status: panel.querySelector('[data-status]') as HTMLElement,
    level: panel.querySelector('[data-level]') as HTMLElement,
    xp: panel.querySelector('[data-xp]') as HTMLElement,
    xpNext: panel.querySelector('[data-xp-next]') as HTMLElement,
    xpFill: panel.querySelector('[data-xp-fill]') as HTMLElement,
    tickMsg: panel.querySelector('[data-tick-msg]') as HTMLElement,
    drops: panel.querySelector('[data-drops]') as HTMLElement,
    equip: panel.querySelector('[data-equip]') as HTMLElement,
    inv: panel.querySelector('[data-inv]') as HTMLElement,
    toggle: panel.querySelector('[data-toggle]') as HTMLButtonElement,
    reset: panel.querySelector('[data-reset]') as HTMLButtonElement,
  };

  els.world.textContent = content.world.nameZh;

  function resolveDollAsset(src: string): string {
    try {
      return new URL(`${DOLL_BASE}/${src}`, window.location.href).href;
    } catch {
      return `${DOLL_BASE}/${src}`;
    }
  }

  function renderDoll(snap: GameSnapshot): void {
    const layers = composePaperDoll(doll, snap.equipment, content.itemsById);
    els.doll.replaceChildren();
    for (const layer of layers) {
      const img = document.createElement('img');
      img.className = 'layer';
      img.alt = '';
      img.draggable = false;
      img.src = resolveDollAsset(layer.src);
      els.doll.appendChild(img);
    }
  }

  function renderEquip(snap: GameSnapshot): void {
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
        span.textContent = item.nameZh;
        btn.title = '点击卸下';
      } else {
        span.textContent = '空';
        span.style.opacity = '0.4';
      }
      btn.appendChild(span);
      btn.addEventListener('click', () => {
        if (!snap.equipment[slot]) return;
        const s = engine.getSave();
        const result = unequipSlot(s.inventory, s.equipment, slot);
        engine.replaceSave({ ...s, inventory: result.inventory, equipment: result.equipment });
      });
      els.equip.appendChild(btn);
    }
  }

  function renderInv(snap: GameSnapshot): void {
    els.inv.replaceChildren();
    if (snap.inventory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent = '背包空空如也，继续挂机…';
      els.inv.appendChild(empty);
      return;
    }

    // Aggregate stackables for display
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

    // Sort: equippable first, then rarity, then name
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
      name.textContent = itemLabel(row.item);
      const qty = document.createElement('span');
      qty.className = 'qty';
      qty.textContent = row.equippable
        ? row.item.slot
          ? SLOT_LABEL_ZH[row.item.slot]
          : ''
        : `×${row.qty}`;
      if (row.item.stackable) qty.textContent = `×${row.qty}`;
      btn.append(name, qty);
      btn.title = row.item.description ?? '';
      if (row.equippable) {
        btn.addEventListener('click', () => {
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
    for (const id of snap.recentDrops.slice(0, 5)) {
      const item = content.itemsById.get(id);
      const line = document.createElement('div');
      line.className = 'drop-line';
      if (item) {
        line.classList.add(rarityClass(item.rarity));
        line.textContent = `✦ ${item.nameZh}`;
      } else {
        line.textContent = id;
      }
      els.drops.appendChild(line);
    }
  }

  function renderAll(snap: GameSnapshot, tick: TickResult | null): void {
    const killing = snap.idleStatus === 'killing';
    els.dot.classList.toggle('paused', !killing);
    els.status.textContent = killing ? '清剿中 / killing' : '已暂停';
    els.level.textContent = String(snap.level);
    els.xp.textContent = String(snap.xp);
    els.xpNext.textContent = String(snap.xpToNext);
    const pct = snap.xpToNext > 0 ? Math.min(100, (snap.xp / snap.xpToNext) * 100) : 0;
    els.xpFill.style.width = `${pct}%`;
    els.toggle.textContent = killing ? '暂停挂机' : '继续挂机';

    if (tick) {
      let msg = `击败 ${tick.enemyFlavor} · +${tick.xpGained} XP`;
      if (tick.leveledUp) msg += ` · 升级！→ Lv.${tick.levelAfter}`;
      if (tick.loot) msg += ` · 掉落 ${tick.loot.nameZh}`;
      els.tickMsg.textContent = msg;
      if (tick.loot) {
        els.tickMsg.className = `meta ${rarityClass(tick.loot.rarity)}`;
      } else {
        els.tickMsg.className = 'meta';
      }
    }

    renderDoll(snap);
    renderEquip(snap);
    renderInv(snap);
    renderDrops(snap);
  }

  engine.subscribe((snap, tick) => renderAll(snap, tick));
  renderAll(engine.getSnapshot(), null);

  els.toggle.addEventListener('click', () => {
    if (engine.getSnapshot().idleStatus === 'killing') engine.pause();
    else engine.start();
  });

  els.reset.addEventListener('click', () => {
    if (!confirm('确定重置存档？等级 / 背包 / 装备将清空。')) return;
    engine.pause();
    const fresh = defaultSave(content.world.id);
    writeSave(fresh);
    engine.replaceSave(fresh);
    engine.start();
  });

  engine.start();

  (window as unknown as { __idle?: IdleEngine; __doll?: PaperDollDef }).__idle = engine;
  (window as unknown as { __doll?: PaperDollDef }).__doll = doll;
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<pre style="color:#f88;padding:16px;background:#200">Failed to start:\n${String(err)}</pre>`;
  }
});

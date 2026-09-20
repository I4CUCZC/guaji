import './styles.css';
import { Companion, loadCharacter } from '@core/index';
import type { CharacterDef, CompanionInputEvent } from '@core/types';
import { createBridge } from './bridge';

const CHARACTER_ID = 'bongo-cat';
const CHARACTER_BASE = `./content/characters/${CHARACTER_ID}`;

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  const bridge = createBridge();
  if (bridge.isElectron) {
    document.body.classList.add('electron');
  } else {
    document.body.classList.add('browser-demo');
  }

  const character: CharacterDef = await loadCharacter(`${CHARACTER_BASE}/character.json`);

  const stage = document.createElement('div');
  stage.className = 'pet-stage';
  stage.style.width = `${character.meta.width}px`;
  stage.style.height = `${character.meta.height}px`;

  const img = document.createElement('img');
  img.alt = character.meta.name;
  img.draggable = false;
  stage.appendChild(img);
  app.appendChild(stage);

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = bridge.isElectron
    ? `<div><strong>${character.meta.nameZh ?? character.meta.name}</strong></div>
       <div>状态 / state: <span data-state>—</span></div>
       <div>拖拽宠物移动 · 点击宠物触发反应</div>`
    : `<div><strong>${character.meta.nameZh ?? character.meta.name}</strong> · 浏览器预览</div>
       <div>状态 / state: <span data-state>—</span></div>
       <div class="hud-browser-only">按键 → 敲击 · 鼠标点击 → 点击反应</div>`;
  app.appendChild(hud);
  const stateEl = hud.querySelector('[data-state]') as HTMLElement;

  const companion = new Companion({
    character,
    resolveAsset: (src) => {
      if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
        return src;
      }
      try {
        return new URL(`${CHARACTER_BASE}/${src}`, window.location.href).href;
      } catch {
        return `${CHARACTER_BASE}/${src}`;
      }
    },
    onFrame: (_frame, _idx, _stateId, resolvedSrc) => {
      if (img.getAttribute('src') !== resolvedSrc) {
        img.src = resolvedSrc;
      }
    },
    onStateChange: (stateId) => {
      stateEl.textContent = stateId;
    },
    bridge,
  });

  // Electron: mouse on the pet (keyboard arrives via main → preload → bridge)
  if (bridge.isElectron) {
    const send = (type: CompanionInputEvent['type'], detail?: string | number) => {
      companion.handleInput({ type, detail, timestamp: Date.now() });
    };
    stage.addEventListener('mousedown', (e) => send('mousedown', e.button));
    stage.addEventListener('mouseup', (e) => send('mouseup', e.button));
  }

  // Click-through except over the pet
  if (bridge.isElectron && bridge.setIgnoreMouseEvents) {
    bridge.setIgnoreMouseEvents(true, { forward: true });
    stage.addEventListener('mouseenter', () => {
      bridge.setIgnoreMouseEvents?.(false);
    });
    stage.addEventListener('mouseleave', () => {
      bridge.setIgnoreMouseEvents?.(true, { forward: true });
    });
  }

  (window as unknown as { __companion?: Companion }).__companion = companion;
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<pre style="color:#f88;padding:16px;background:#200">Failed to start:\n${String(err)}</pre>`;
  }
});

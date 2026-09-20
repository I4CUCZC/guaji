# 挂机桌宠 · Guaji Desktop Pet

透明置顶的桌面挂机小宠物（Bongo Cat 风格）。  
A transparent, always-on-top desktop idle companion (Bongo Cat–style).

**架构 / Architecture：** 可移植的 Vite + TypeScript 核心（数据驱动 JSON + 素材）+ 薄 Electron 壳（窗口 / 输入转发）。核心不依赖 Phaser / Unity / Godot，后续可迁到浏览器或 Tauri。

---

## 中文

### 功能（MVP）

- 透明、无边框、始终置顶的桌面浮层
- 状态：`idle`（待机）、`typing`（敲击）、`click`（点击），超时回待机
- 键盘 → 敲击动画；鼠标点击宠物 → 点击反应
- 拖拽宠物移动窗口
- 通过 `character.json` + 图片/SVG 扩展角色，无需改引擎

### 环境

- Node.js **≥ 18**（推荐 20+）
- npm 9+

### 安装

```bash
cd guaji-desktop-pet
npm install
```

### 运行

**浏览器预览（推荐先测动画 / 反应）：**

```bash
npm run dev
```

打开终端提示的地址（默认 `http://127.0.0.1:5173`）。在页面内按键或点击即可切换状态。

**Electron 透明置顶浮层：**

```bash
# 开发：Vite 热更新 + Electron 窗口
npm run electron:dev

# 或：先构建再打开 Electron
npm run electron
```

单独构建前端：

```bash
npm run build
```

### 如何添加 / 替换角色

1. 在 `content/characters/` 下新建目录，例如 `content/characters/my-pet/`。
2. 放入 `character.json` 与 `assets/` 图片（SVG / PNG 均可）。
3. 修改 `src/renderer/main.ts` 里的 `CHARACTER_ID` 为你的目录名。
4. 重新 `npm run dev` 或 `npm run electron:dev`。

`character.json` 结构要点：

| 字段 | 说明 |
|------|------|
| `meta` | `id` / `name` / `nameZh` / `width` / `height` |
| `defaultState` | 默认状态 id（通常 `idle`） |
| `states[]` | `id`、`frames[]`（`src` + 可选 `durationMs`）、`fps`、`loop`、`timeoutMs` |
| `reactions[]` | `trigger`: `keyboard` \| `mousedown` \| `mouseup` \| `mousemove` → `state` |

帧路径相对于角色目录，例如 `"src": "assets/idle.svg"`。

替换邦戈猫画风：直接覆盖 `content/characters/bongo-cat/assets/*.svg`，保持文件名或同步改 JSON 即可。

### 目录结构

```
guaji-desktop-pet/
├── content/characters/<id>/     # 角色 JSON + 素材
├── electron/                    # 主进程 / preload（薄壳）
├── src/core/                    # 动画播放器、反应引擎、Companion
├── src/renderer/                # UI：加载角色、贴图、拖拽
├── index.html
├── package.json
└── vite.config.ts
```

### 输入说明（Electron）

- **点击 / 拖拽**：鼠标悬停在宠物上时可点可拖；移开后窗口点击穿透，不挡操作。
- **键盘**：窗口能收到焦点时的按键会触发敲击；经典「全局后台键盘钩子」需原生模块，刻意未引入以保持依赖精简，可作为后续扩展。

### 脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev` | Vite 浏览器开发服务器 |
| `npm run build` | TypeScript 检查 + 打包到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run electron` | 构建后启动 Electron |
| `npm run electron:dev` | Vite + Electron 并行开发 |
| `npm run typecheck` | 仅类型检查 |

---

## English

### Features (MVP)

- Transparent, frameless, always-on-top overlay
- States: `idle`, `typing` (bongo), `click` — return to idle after a short timeout
- Keyboard → typing animation; click the pet → click reaction
- Drag the pet to move the window
- Extend characters via JSON + assets — no engine lock-in

### Requirements

- Node.js **≥ 18** (20+ recommended)
- npm 9+

### Install

```bash
cd guaji-desktop-pet
npm install
```

### Run

**Browser preview (great for testing animations):**

```bash
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`). Press keys or click to change states.

**Electron transparent overlay:**

```bash
npm run electron:dev   # Vite HMR + Electron
# or
npm run electron       # production build, then Electron
```

Build only:

```bash
npm run build
```

### Add / swap a character

1. Create `content/characters/<your-id>/` with `character.json` and an `assets/` folder.
2. Set `CHARACTER_ID` in `src/renderer/main.ts` to `<your-id>`.
3. Restart `npm run dev` or `npm run electron:dev`.

Frame `src` paths are relative to the character folder (e.g. `assets/idle.svg`).

To re-skin the starter cat, replace files under `content/characters/bongo-cat/assets/` (keep names or update the JSON).

### Layout

```
guaji-desktop-pet/
├── content/characters/<id>/   # character.json + images
├── electron/                  # main + preload (thin shell)
├── src/core/                  # animation player, reaction engine
├── src/renderer/              # UI loader / display
├── index.html
├── package.json
└── vite.config.ts
```

### Electron input notes

- **Mouse:** hover the pet to click/drag; outside the pet, the window is click-through.
- **Keyboard:** keys are forwarded when the overlay can receive input. Full OS-global key hooks need a native addon and are intentionally omitted for a minimal dependency tree (easy Phase-2 addition).

### License

Project scaffolding is yours to use. Starter SVG art is original placeholder art for this repo.

# 挂机桌宠 · Guaji Desktop Pet

透明置顶的桌面挂机小宠物 + **星际世界 idle-gear MVP**。  
Transparent desktop idle companion with a data-driven space-world gear grind.

**架构：** Vite + TypeScript 核心（JSON + 素材，无重型游戏引擎）+ 薄 Electron 壳。

---

## 中文

### 功能（Idle-Gear MVP）

1. **单一世界：** 星际世界（`content/worlds/space/`）。生化 / 中土仅留目录占位。
2. **挂机战斗：** 运行中每约 1.5s 自动 tick：获得 XP，按概率从掉落表掷战利品。
3. **稀有度：** 普通 / 优良 / 稀有 / 史诗 / 传说，UI 按颜色显示。
4. **粉丝风味装备名：** 如「狂热者光刃」「极限战士式动力臂甲」「异形头骨战利品」等（原创命名，定义在 JSON）。
5. **细部位装备：** head / body / arm_left / arm_right / legs / weapon / accessory，每槽一件。
6. **像素纸娃娃：** 多层 SVG；装备后对应图层替换/叠加，外观可见变化。
7. **存档：** 等级、XP、背包、装备写入 `localStorage`。

早期 Bongo Cat 动画核心仍保留在 `src/core/`（`Companion` 等），当前 UI 以挂机装备面板为主。

### 环境

- Node.js **≥ 18**（推荐 20+）
- npm 9+

### 安装与运行

```bash
cd guaji-desktop-pet
npm install
```

**浏览器预览（推荐先看挂机 / 装备 / 纸娃娃）：**

```bash
npm run dev
```

打开 `http://127.0.0.1:5173`。挂机会自动开始；观察「最近掉落」与 XP 条；在背包点击可装备物品，纸娃娃图层会变；点装备栏可卸下。

**Electron 浮层面板：**

```bash
npm run electron:dev   # Vite 热更新 + Electron
# 或
npm run electron       # 先 build 再启动
```

单独构建：

```bash
npm run build
```

### 如何看到掉落与换装

1. `npm run dev` 打开页面，状态显示「清剿中」。
2. 等待数秒：XP 条上涨；有概率在「最近掉落」出现带颜色的物品名。
3. 在「背包」点击带部位标签的装备（如武器 / 头部）→ 装备栏填入，左侧纸娃娃出现对应图层（光刃、护目镜、动力臂甲等）。
4. 再点装备栏格子可卸下。存档自动保存，刷新页面保留进度。

### 如何添加一件装备 / 图层

1. **物品 JSON** — 新建 `content/worlds/space/items/<id>.json`：

```json
{
  "id": "my_helm",
  "name": "My Helm",
  "nameZh": "我的头盔",
  "rarity": "rare",
  "slot": "head",
  "stackable": false,
  "description": "说明文字",
  "layer": "gear/head_my_helm.svg"
}
```

`slot` 为 `null` 表示不可装备（废料等）。`layer` 相对 `content/characters/paper-doll/layers/`。

2. **掉落表** — 在 `content/worlds/space/drop_table.json` 的 `entries` 增加一行，`weight` 越大越常见。

3. **注册 id** — 把 `<id>` 加入 `src/core/game/content-loader.ts` 的 `SPACE_ITEM_IDS`（保证能被加载）。

4. **图层 SVG** — 在 `content/characters/paper-doll/layers/gear/` 放同名 SVG，`viewBox="0 0 64 80"`，`shape-rendering="crispEdges"`，与基底对齐。

5. **槽位顺序** — 若新槽位，更新 `paper-doll.json` 的 `slots` / `layerOrder`（`slot:head` 等形式），以及 `src/core/game/types.ts` 的 `EquipSlot`。

6. 重新 `npm run dev` 验证。

### 目录结构

```
guaji-desktop-pet/
├── content/
│   ├── worlds/
│   │   ├── space/           # 星际世界 JSON + items
│   │   ├── bio/             # 占位
│   │   └── middle-earth/    # 占位
│   └── characters/
│       ├── bongo-cat/       # 早期动画角色（保留）
│       └── paper-doll/      # 纸娃娃基底 + gear 图层
├── electron/                # 薄壳（窗口略放大以容纳装备 UI）
├── src/core/                # 动画伴侣 + idle/loot/inventory/equip/paper-doll
│   └── game/                # 挂机引擎等纯逻辑
├── src/renderer/            # UI 绑定
├── index.html
├── package.json
└── vite.config.ts
```

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

### Idle-gear MVP

- One world: **Space** (`content/worlds/space/`). Bio / Middle-earth folders are stubs only.
- Idle ticks (~1.5s): XP + chance to roll loot from a weighted drop table.
- Rarity colors in UI; fan-flavor item names in JSON (original naming).
- Equipment slots: head, body, arm_left, arm_right, legs, weapon, accessory.
- Layered pixel SVG paper-doll updates when you equip gear.
- Save: level / xp / inventory / equipment → `localStorage`.

### Run

```bash
npm install
npm run dev          # browser
npm run electron:dev # Electron panel
npm run build        # must succeed
```

### Add an item

1. Add `content/worlds/space/items/<id>.json` with `slot` + `layer`.
2. Add entry to `drop_table.json`.
3. Append id to `SPACE_ITEM_IDS` in `src/core/game/content-loader.ts`.
4. Drop matching SVG under `content/characters/paper-doll/layers/gear/`.

### License

Scaffolding is free to use. Starter SVG art is original placeholder art for this repo.

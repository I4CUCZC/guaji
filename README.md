# 挂机桌宠 · Guaji Desktop Pet

透明置顶的桌面挂机小宠物 + **星际世界 idle-gear MVP**。  
Transparent desktop idle companion with a data-driven space-world gear grind.

**架构：** Vite + TypeScript 核心（JSON + 素材，无重型游戏引擎）+ 薄 Electron 壳。

---

## 中文

### 功能（Idle-Gear MVP）

1. **单一世界：** 星际世界（`content/worlds/space/`）。生化 / 中土仅留目录占位。
2. **遭遇战斗（柔和数值）：** 挂机时生成敌人 → 双方用**血条格段 + 颜色**表示状态（默认不显示 ATK/DEF/HP/伤害整数）→ 自动互相攻击。日志用「轻击 / 扎实 / 重击 / 破防」，战况标签「压制 / 胶着 / 苦战」。可选「显示详细数值」给进阶玩家。势均力敌约 **5 分钟**；内部数值未重爆。
3. **物品技能 + 三格技能栏：** 部分装备定义 `skill`。点空位装配 / 点已装清空重选。施放时**纸娃娃对应部位先动**，再播特效：腕刃→双臂挥砍后刃光；治疗→胸甲脉冲；护盾→肩饰微光；酸蚀→头颅喷溅。
4. **稀有度：** 普通 / 优良 / 稀有 / 史诗 / 传说，UI 按颜色显示。
5. **原创风味装备名：** 如「脉冲光刃」「虚空伺服臂甲」「虚空兽头骨」等（JSON 定义，致敬风格但不抄袭可识别 IP）。
6. **细部位装备：** head / body / arm_left / arm_right / legs / weapon / accessory。
7. **像素纸娃娃：** 多层 SVG。脉冲腕刃从**双腕发射器**伸出能量刃（非手持握剑）；虚空兽头骨为拉长圆顶 + 肋管 + 下颚须的原创异星轮廓。装备切换图层清晰可见。
8. **存档：** 等级、XP、背包、装备、技能栏 → `localStorage`。

### 遭遇与技能（怎么玩）

1. `npm run dev` 打开页面，状态「搜寻中 / 交战中」。
2. 遭遇后出现敌名、格段血条与战况标签；日志为定性手感词（可勾选「显示详细数值」看具体 HP）。
3. 打赢才掷掉落；稀有度颜色与掉落高亮体现成长，而非 DPS 文字。
4. 装备带 ★ 的物品后装配技能；就绪自动释放，纸娃娃部位动画 + 特效联动。

### 环境

- Node.js **≥ 18**（推荐 20+）
- npm 9+

### 安装与运行

```bash
cd guaji-desktop-pet
npm install
npm run dev          # 浏览器
npm run electron:dev # Electron 面板
npm run build        # 必须通过
```

### 如何添加敌人 / 技能装备

**敌人** — 编辑 `content/worlds/space/enemies.json`：`minLevel` / `maxLevel`、`hp`、`attack`、`drops`（权重表）。

**带技能的装备** — 在物品 JSON 增加：

```json
"skill": {
  "id": "skill_example",
  "name": "Example",
  "nameZh": "示例技",
  "description": "说明",
  "cooldownMs": 10000,
  "effect": { "type": "damage", "amount": 15 }
}
```

`effect.type` 可为 `damage` | `heal` | `shield`。

### 目录结构

```
guaji-desktop-pet/
├── content/worlds/space/     # world / enemies / drop_table / items
├── content/characters/paper-doll/
├── electron/
├── src/core/game/            # 遭遇引擎、技能、掉落、存档
└── src/renderer/             # UI
```

### 脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev` | Vite 浏览器开发服务器 |
| `npm run build` | TypeScript 检查 + 打包到 `dist/` |
| `npm run electron` | 构建后启动 Electron |
| `npm run electron:dev` | Vite + Electron 并行开发 |
| `npm run typecheck` | 仅类型检查 |

---

## English

- **Encounter combat:** spawn enemy → HP bars → auto attacks for a few seconds → loot on win; short breather between fights. Early enemies = weak + junk loot; later enemies scale with player level.
- **Item skills:** equip gear that defines a `skill`; assign up to **3** skills to the skill bar (persisted). Independent cooldowns; auto-cast in combat.
- **Paper-doll:** finer pixel SVG layers; gear still swaps visibly.
- Data-driven JSON under `content/worlds/space/` (including `enemies.json`).

### License

Scaffolding is free to use. Starter SVG art is original placeholder art for this repo.

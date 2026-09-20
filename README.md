# 挂机桌宠 · Guaji Desktop Pet

透明置顶的桌面挂机小宠物 + **星际世界 idle-gear MVP**。  
Transparent desktop idle companion with a data-driven space-world gear grind.

**架构：** Vite + TypeScript 核心（JSON + 素材，无重型游戏引擎）+ 薄 Electron 壳。

---

## 中文

### 功能（Idle-Gear MVP）

1. **单一世界：** 星际世界（`content/worlds/space/`）。生化 / 中土仅留目录占位。
2. **对峙遭遇（柔和数值）：** 左纸娃娃 / 右敌方像素肖像，双方血条在角色上方。日志用「轻击 / 普通 / 重击 / 破防」，战况「压制 / 胶着 / 苦战」。**寻觅弱敌 / 寻常对手 / 寻觅强敌**可切换难度与掉落（存档记忆）。新手可稳定击败前几场；势均力敌仍约数分钟。战败后回满生命并继续当前寻觅模式。
3. **主动 3 格 + 被动 3 格：** 装备可定义主动 `skill`（`kind: active`）或 `passiveSkill` / `skill.kind: "passive"`。两栏各自点空位装配、点已装清空重选。主动在战斗中自动释放并播部位特效；被动持续生效（伤害增幅 / 缓慢回血 / 减伤），无施放冷却。
4. **稀有度：** 普通 / 优良 / 稀有 / 史诗 / 传说，UI 按颜色显示。
5. **Lore-first 装备：** 星际世界致敬星际争霸 / 战锤40K / 异形气质（中文贡品名 OK），去掉纯凑槽占位件；槽位数量不必齐。另有 **碎片商店抽取**、**分解**、**强化 +0～+9**。
6. **15 部位装备：** 头部、颈部、左右肩、左右臂、左右手、两枚戒指、腰部、左右腿、左右脚。旧存档映射：body→腰部、legs→左腿、weapon→右手、accessory→颈部（虚空兽头骨→右肩）。
7. **像素纸娃娃：** 多层 SVG。脉冲腕刃从**双腕发射器**伸出能量刃（非手持握剑）；虚空兽头骨为拉长圆顶 + 肋管 + 下颚须的原创异星轮廓。装备切换图层清晰可见。
8. **存档：** 等级、XP、背包、装备、主动栏、被动栏、寻觅模式 → `localStorage`。

### 装备 ↔ 纸娃娃外观（如何验收）

对峙场左侧主战角色是**像素纸娃娃**（不再用 `public/art/` 动漫立绘作为主战图；那些 PNG 仍保留作未用素材/图库）。

| 装备物品 | 槽位 | 出现的图层 | 卸下后 |
|---------|------|-----------|--------|
| `pulse_blade` 脉冲腕刃 | `hand_right` | `gear/weapon_pulse_blade.svg`（双腕能量刃） | 刃消失 |
| `aegis_helm` 神盾式战盔 | `head` | `gear/head_aegis_helm.svg` | 头盔消失 |
| `carapace_torso` 甲壳式胸甲 | `waist` | `gear/body_carapace.svg` | 胸甲消失 |
| `power_gauntlet_l` / `_r` | `arm_left` / `arm_right` | `gear/arm_*_power.svg` | 臂甲消失 |
| `voidbeast_trophy` 异星战利头骨 | `shoulder_right` | `gear/accessory_voidbeast_trophy.svg` | 头骨消失 |
| `acid_gland` 异种酸腺 | `shoulder_left` | `gear/ph_shoulder_left.svg` | 色块消失 |
| `starfall_relic` 亚空间裂片圣物 | `neck` | `gear/accessory_starfall.svg` | 圣物消失 |
| `greaves_voidwalker` 磁锁护胫 | `leg_left` | `gear/legs_voidwalker.svg` | 护胫消失 |
| `combat_stim` 战地兴奋剂 | `ring_1` | `gear/ph_ring_1.svg` | 色块消失 |

**操作：** 战斗掉落或背包里点击装备 → 对峙场纸娃娃对应部位立刻出现图层；再点装备栏该槽卸下 → 图层立刻消失。15 个槽均有图层（精美 SVG 或鲜明彩色像素占位）。

### 遭遇与技能（怎么玩）

1. `npm run dev` 打开页面，状态「搜寻中 / 交战中」。
2. 对峙场：左我右敌；可选寻觅弱/寻常/强敌。日志为定性手感词（可勾选「显示详细数值」）。
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

**带技能的装备** — 在物品 JSON 增加主动或被动：

```json
"skill": {
  "id": "skill_example",
  "name": "Example",
  "nameZh": "示例技",
  "kind": "active",
  "description": "说明",
  "cooldownMs": 10000,
  "effect": { "type": "damage", "amount": 15 }
},
"passiveSkill": {
  "id": "passive_example",
  "name": "Example Aura",
  "nameZh": "示例光环",
  "kind": "passive",
  "description": "轻微提高输出。",
  "effect": { "type": "damageAmp", "amount": 0.08 }
}
```

主动 `effect.type`：`damage` | `heal` | `shield`。  
被动：`damageAmp`（增伤比例）| `regen`（每隔约 5 秒回血）| `damageReduction`（减伤比例）。也可只写 `skill.kind: "passive"`。

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
- **Item skills:** 3 active + 3 passive slots. Actives auto-cast; passives apply ongoing amp / regen / damage reduction. Soft combat logs use 轻击 / 普通 / 重击 / 破防 (no raw numbers by default).
- **Paper-doll / slots:** 15 body slots (head, neck, shoulders, arms, hands, rings, waist, legs, feet). Wrist blades occupy a hand slot.
- Data-driven JSON under `content/worlds/space/` (including `enemies.json`).

### License

Scaffolding is free to use. Starter SVG art is original placeholder art for this repo.

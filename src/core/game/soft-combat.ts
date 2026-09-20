/**
 * Soft / qualitative combat presentation.
 * Internal math stays numeric; UI & logs use tiers and bars.
 */

export type DamageTier = '轻击' | '普通' | '重击' | '破防';
export type FightState = '压制' | '胶着' | '苦战';
export type HealTier = '微愈' | '回春' | '大愈';
export type ShieldTier = '薄盾' | '护盾' | '坚壁';

/** Map raw damage vs target max HP → qualitative tier. */
export function damageTier(damage: number, targetMaxHp: number): DamageTier {
  if (targetMaxHp <= 0) return '普通';
  const r = damage / targetMaxHp;
  // Clear mapping by target max HP: <2% 轻击, 2–5% 普通, 5–12% 重击, ≥12% 破防.
  if (r >= 0.12) return '破防';
  if (r >= 0.05) return '重击';
  if (r >= 0.02) return '普通';
  return '轻击';
}

/** Player vs enemy HP% comparison → fight feel label. */
export function fightState(
  playerHp: number,
  playerMaxHp: number,
  enemyHp: number,
  enemyMaxHp: number,
): FightState {
  const p = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
  const e = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;
  const delta = p - e;
  if (delta >= 0.12) return '压制';
  if (delta <= -0.12) return '苦战';
  // Also lean 苦战 when player is critically low regardless of enemy
  if (p <= 0.28 && e >= 0.4) return '苦战';
  if (e <= 0.28 && p >= 0.45) return '压制';
  return '胶着';
}

export function healTier(amount: number, maxHp: number): HealTier {
  if (maxHp <= 0) return '回春';
  const r = amount / maxHp;
  if (r >= 0.28) return '大愈';
  if (r >= 0.12) return '回春';
  return '微愈';
}

export function shieldTier(amount: number, maxHp: number): ShieldTier {
  if (maxHp <= 0) return '护盾';
  const r = amount / maxHp;
  if (r >= 0.25) return '坚壁';
  if (r >= 0.1) return '护盾';
  return '薄盾';
}

/** HP fill color band from remaining percent (0–100). */
export function hpBand(pct: number): 'high' | 'mid' | 'low' | 'critical' {
  if (pct > 60) return 'high';
  if (pct > 35) return 'mid';
  if (pct > 15) return 'low';
  return 'critical';
}

export function formatDamageOutLog(
  enemyNameZh: string,
  damage: number,
  enemyMaxHp: number,
  detailed: boolean,
): string {
  const tier = damageTier(damage, enemyMaxHp);
  if (detailed) return `你对${enemyNameZh}造成 ${damage} 伤害（${tier}）`;
  return `你打出了一次${tier}`;
}

export function formatDamageInLog(
  enemyNameZh: string,
  damage: number,
  playerMaxHp: number,
  absorbed: number,
  detailed: boolean,
): string {
  const tier = damageTier(damage + absorbed, playerMaxHp);
  if (detailed) {
    const shieldNote = absorbed > 0 ? `（护盾抵消 ${absorbed}）` : '';
    return `${enemyNameZh}击中你 ${damage}${shieldNote}（${tier}）`;
  }
  if (absorbed > 0 && damage <= 0) return `${enemyNameZh}的攻击被护盾挡住了`;
  if (absorbed > 0) return `${enemyNameZh}的${tier}被护盾削弱了`;
  return `${enemyNameZh}打来一次${tier}`;
}

export function formatSkillDamageLog(
  skillNameZh: string,
  enemyNameZh: string,
  amount: number,
  enemyMaxHp: number,
  detailed: boolean,
): string {
  const tier = damageTier(amount, enemyMaxHp);
  if (detailed) {
    return `【${skillNameZh}】对${enemyNameZh}造成 ${amount} 伤害（${tier}）`;
  }
  return `【${skillNameZh}】打出${tier}`;
}

export function formatSkillHealLog(
  skillNameZh: string,
  healed: number,
  maxHp: number,
  detailed: boolean,
): string {
  const tier = healTier(healed, maxHp);
  if (detailed) return `【${skillNameZh}】回复 ${healed} 生命（${tier}）`;
  return `【${skillNameZh}】·${tier}`;
}

export function formatSkillShieldLog(
  skillNameZh: string,
  amount: number,
  maxHp: number,
  detailed: boolean,
): string {
  const tier = shieldTier(amount, maxHp);
  if (detailed) return `【${skillNameZh}】获得 ${amount} 护盾（${tier}）`;
  return `【${skillNameZh}】·${tier}展开`;
}

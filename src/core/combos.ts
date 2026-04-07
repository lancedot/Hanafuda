import type { CardEval } from "../types/game";

export interface ComboMatch {
  name: string;
  addMult: number;
  addChips: number;
}

export interface ComboContext {
  disableSameMonthCombo: boolean;
  wildcardMonth11: boolean;
}

export function evaluateCombos(
  cards: CardEval[],
  comboLevels: Record<string, number>,
  ctx: ComboContext,
): ComboMatch[] {
  const matches: ComboMatch[] = [];
  const monthCounts = new Map<number, number>();
  const rankCounts = { HIKARI: 0, TAN: 0, KASU: 0, TANE: 0 };
  const tags = new Set<string>();
  for (const c of cards) {
    monthCounts.set(c.month, (monthCounts.get(c.month) ?? 0) + 1);
    rankCounts[c.rank] += 1;
    for (const t of c.tags) tags.add(t);
  }

  const getLvBonus = (name: string, chipsPerLv: number, multPerLv: number) => {
    const lv = comboLevels[name] ?? 0;
    return { chips: lv * chipsPerLv, mult: lv * multPerLv };
  };

  if (!ctx.disableSameMonthCombo) {
    const monthBest = Math.max(...Array.from(monthCounts.values()), 0);
    if (monthBest >= 2) {
      const bonus = getLvBonus("同族 (同月)", 20, 2);
      matches.push({
        name: "同族 (同月)",
        addMult: 2 + Math.max(0, monthBest - 2) * 2 + bonus.mult,
        addChips: bonus.chips,
      });
    } else if (ctx.wildcardMonth11) {
      const has11 = cards.some((c) => c.month === 11);
      if (has11) {
        const bonus = getLvBonus("同族 (同月)", 20, 2);
        matches.push({ name: "同族 (同月)", addMult: 2 + bonus.mult, addChips: bonus.chips });
      }
    }
  }

  if (cards.length === 5 && rankCounts.KASU === 5) {
    const bonus = getLvBonus("皮聚 (Kasu Pack)", 40, 3);
    matches.push({ name: "皮聚 (Kasu Pack)", addMult: 4 + bonus.mult, addChips: bonus.chips });
  }
  const hasFlowerViewing = cards.some((c) => c.month === 3 && c.rank === "HIKARI");
  const hasSakeCup = cards.some((c) => c.tags.includes("SAKE_CUP"));
  if (hasFlowerViewing && hasSakeCup) {
    const bonus = getLvBonus("花见/月见酒", 50, 5);
    matches.push({ name: "花见/月见酒", addMult: 8 + bonus.mult, addChips: bonus.chips });
  }
  if (rankCounts.TAN + rankCounts.TANE >= 3) {
    const bonus = getLvBonus("短册/荒魂流", 60, 6);
    matches.push({ name: "短册/荒魂流", addMult: 10 + bonus.mult, addChips: bonus.chips });
  }
  const redCount = cards.filter((c) => c.tags.includes("RED_RIBBON")).length;
  const blueCount = cards.filter((c) => c.tags.includes("BLUE_RIBBON")).length;
  if (redCount >= 3 || blueCount >= 3) {
    const bonus = getLvBonus("青短/赤短", 100, 10);
    matches.push({ name: "青短/赤短", addMult: 15 + bonus.mult, addChips: bonus.chips });
  }
  const hasBoar = tags.has("BOAR");
  const hasDeer = tags.has("DEER");
  const hasButterfly = tags.has("BUTTERFLY");
  if (hasBoar && hasDeer && hasButterfly) {
    const bonus = getLvBonus("猪鹿蝶", 150, 12);
    matches.push({ name: "猪鹿蝶", addMult: 20 + bonus.mult, addChips: bonus.chips });
  }
  if (rankCounts.HIKARI >= 3 && rankCounts.HIKARI <= 4) {
    const bonus = getLvBonus("三光/四光", 200, 20);
    const base = rankCounts.HIKARI === 4 ? 30 : 15;
    matches.push({ name: "三光/四光", addMult: base + bonus.mult, addChips: bonus.chips });
  }
  if (rankCounts.HIKARI >= 5) {
    const bonus = getLvBonus("五光 (天灾)", 500, 50);
    matches.push({ name: "五光 (天灾)", addMult: 50 + bonus.mult, addChips: bonus.chips });
  }
  if (matches.length === 0) {
    const bonus = getLvBonus("乱舞 (散牌)", 10, 1);
    matches.push({ name: "乱舞 (散牌)", addMult: 1 + bonus.mult, addChips: bonus.chips });
  }
  return matches;
}

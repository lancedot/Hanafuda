import type { CardEval, ComboMatch } from "../types/game";

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
  for (const c of cards) {
    monthCounts.set(c.month, (monthCounts.get(c.month) ?? 0) + 1);
    rankCounts[c.rank] += 1;
  }

  const getLvBonus = (name: string, chipsPerLv: number, multPerLv: number) => {
    const lv = comboLevels[name] ?? 0;
    return { chips: lv * chipsPerLv, mult: lv * multPerLv };
  };
  const byScoreDesc = (a: CardEval, b: CardEval) => b.chips + b.mult * 10 - (a.chips + a.mult * 10);
  const pushMatch = (name: string, addMult: number, addChips: number, usedCards: CardEval[]) => {
    matches.push({
      name,
      addMult,
      addChips,
      cardUids: usedCards.map((card) => card.uid),
    });
  };

  if (!ctx.disableSameMonthCombo) {
    const monthBest = Math.max(...Array.from(monthCounts.values()), 0);
    if (monthBest >= 2) {
      const monthCards = Array.from(monthCounts.entries())
        .filter(([, count]) => count === monthBest)
        .map(([month]) => cards.filter((card) => card.month === month).sort(byScoreDesc))
        .sort((left, right) => byScoreDesc(left[0]!, right[0]!));
      const bestUsedCards = monthCards[0] ?? [];
      const bonus = getLvBonus("同族 (同月)", 20, 2);
      pushMatch("同族 (同月)", 2 + Math.max(0, monthBest - 2) * 2 + bonus.mult, bonus.chips, bestUsedCards);
    } else if (ctx.wildcardMonth11) {
      const month11Cards = cards.filter((c) => c.month === 11).sort(byScoreDesc);
      if (month11Cards.length > 0) {
        const bonus = getLvBonus("同族 (同月)", 20, 2);
        pushMatch("同族 (同月)", 2 + bonus.mult, bonus.chips, [month11Cards[0]!]);
      }
    }
  }

  const kasuCards = cards.filter((c) => c.rank === "KASU").sort(byScoreDesc);
  if (kasuCards.length >= 5) {
    const bonus = getLvBonus("皮聚 (Kasu Pack)", 40, 3);
    pushMatch("皮聚 (Kasu Pack)", 4 + bonus.mult, bonus.chips, kasuCards.slice(0, 5));
  }
  const flowerViewingCards = cards.filter((c) => c.month === 3 && c.rank === "HIKARI").sort(byScoreDesc);
  const sakeCupCards = cards.filter((c) => c.tags.includes("SAKE_CUP")).sort(byScoreDesc);
  if (flowerViewingCards.length > 0 && sakeCupCards.length > 0) {
    const bonus = getLvBonus("花见/月见酒", 50, 5);
    pushMatch("花见/月见酒", 8 + bonus.mult, bonus.chips, [flowerViewingCards[0]!, sakeCupCards[0]!]);
  }
  const ribbonAndSeedCards = cards.filter((c) => c.rank === "TAN" || c.rank === "TANE").sort(byScoreDesc);
  if (ribbonAndSeedCards.length >= 3) {
    const bonus = getLvBonus("短册/荒魂流", 60, 6);
    pushMatch("短册/荒魂流", 10 + bonus.mult, bonus.chips, ribbonAndSeedCards);
  }
  const redRibbonCards = cards.filter((c) => c.tags.includes("RED_RIBBON")).sort(byScoreDesc);
  const blueRibbonCards = cards.filter((c) => c.tags.includes("BLUE_RIBBON")).sort(byScoreDesc);
  if (redRibbonCards.length >= 3 || blueRibbonCards.length >= 3) {
    const chosenRibbonCards =
      redRibbonCards.length > blueRibbonCards.length
        ? redRibbonCards
        : blueRibbonCards.length > redRibbonCards.length
          ? blueRibbonCards
          : scoreCards(redRibbonCards) >= scoreCards(blueRibbonCards)
            ? redRibbonCards
            : blueRibbonCards;
    const bonus = getLvBonus("青短/赤短", 100, 10);
    pushMatch("青短/赤短", 15 + bonus.mult, bonus.chips, chosenRibbonCards);
  }
  const boar = cards.filter((c) => c.tags.includes("BOAR")).sort(byScoreDesc)[0];
  const deer = cards.filter((c) => c.tags.includes("DEER")).sort(byScoreDesc)[0];
  const butterfly = cards.filter((c) => c.tags.includes("BUTTERFLY")).sort(byScoreDesc)[0];
  if (boar && deer && butterfly) {
    const bonus = getLvBonus("猪鹿蝶", 150, 12);
    pushMatch("猪鹿蝶", 20 + bonus.mult, bonus.chips, [boar, deer, butterfly]);
  }
  const hikariCards = cards.filter((c) => c.rank === "HIKARI").sort(byScoreDesc);
  if (hikariCards.length >= 3 && hikariCards.length <= 4) {
    const bonus = getLvBonus("三光/四光", 200, 20);
    const base = hikariCards.length === 4 ? 30 : 15;
    pushMatch("三光/四光", base + bonus.mult, bonus.chips, hikariCards);
  }
  if (hikariCards.length >= 5) {
    const bonus = getLvBonus("五光 (天灾)", 500, 50);
    pushMatch("五光 (天灾)", 50 + bonus.mult, bonus.chips, hikariCards.slice(0, 5));
  }
  const scatterBonus = getLvBonus("乱舞 (散牌)", 10, 1);
  for (const card of cards) {
    pushMatch("乱舞 (散牌)", 1 + scatterBonus.mult, scatterBonus.chips, [card]);
  }
  return matches;
}

function scoreCards(cards: CardEval[]): number {
  return cards.reduce((sum, card) => sum + card.chips + card.mult * 10, 0);
}

import { cardById, parseTargetScore, stages } from "../content/data";
import { evaluateCombos } from "./combos";
import { applyPreScoreRuleTweaks, type StageRuleContext } from "./rules";
import { targetMultiplierByStage } from "./balance";
import { SeededRng } from "./rng";
import type { CardEval, CardInstance, RunState, ScoreBreakdown } from "../types/game";

export interface EvaluateParams {
  run: RunState;
  /** The card UIDs to score (typically run.capturedCards) */
  selectedUids: string[];
  stageRuleCtx: StageRuleContext;
}

export function evaluatePlay(params: EvaluateParams): ScoreBreakdown {
  const { run, selectedUids, stageRuleCtx } = params;
  const initial = selectedUids.map((uid) => evalCard(run.cardsByUid[uid]));
  const cards = applyPreScoreRuleTweaks(initial, stageRuleCtx);

  let chipsFromEffects = run.globalFlatChips + run.seasonChipBonus + (run.nextPlayFlatChipBonus ?? 0);
  let addMult = run.globalFlatMult;
  let multiplicative = run.globalMultFactor;

  applyCardTraitEffects(run, cards, (chips, mult, mul) => {
    chipsFromEffects += chips;
    addMult += mult;
    multiplicative *= mul;
  });

  const evaluatedCombos = evaluateCombos(cards, run.comboLevels, {
    disableSameMonthCombo: stageRuleCtx.bossKey === "DISORDER",
    wildcardMonth11: run.relics.includes("B-12"),
  });

  applyRelicEffects(run, cards, evaluatedCombos, (chips, mult, mul) => {
    chipsFromEffects += chips;
    addMult += mult;
    multiplicative *= mul;
  });

  if (run.monthBuffTarget) {
    for (const card of cards) {
      if (card.month === run.monthBuffTarget) chipsFromEffects += 50;
    }
  }

  const allMatches = evaluateCombos(cards, run.comboLevels, {
    disableSameMonthCombo: stageRuleCtx.bossKey === "DISORDER",
    wildcardMonth11: run.relics.includes("B-12"),
  });
  const scoringMatches = allMatches.some((combo) => combo.name !== "乱舞 (散牌)")
    ? allMatches.filter((combo) => combo.name !== "乱舞 (散牌)")
    : allMatches.slice(0, 1);

  const usedCardUids = Array.from(new Set(scoringMatches.flatMap((combo) => combo.cardUids)));
  const chipsFromCards = cards.reduce((sum, card) => sum + card.chips, 0);
  const chipsFromCombos = scoringMatches.reduce((sum, combo) => sum + combo.addChips, 0);
  const comboMult = scoringMatches.reduce((sum, combo) => sum + combo.addMult, 0);
  const base = chipsFromCards + chipsFromCombos + chipsFromEffects;
  const totalMult = Math.max(1, comboMult + addMult);
  let finalScore = Math.max(0, Math.floor(base * totalMult * multiplicative));

  // Apply Koi-Koi multiplier (stacks each time player continues)
  if (run.koiKoiMultiplier > 1) {
    finalScore = Math.floor(finalScore * run.koiKoiMultiplier);
  }

  if (run.relics.includes("B-18") && !run.phoenixPending && finalScore < getCurrentStageThreshold(run)) {
    finalScore *= 10;
    run.phoenixPending = true;
    run.relics = run.relics.filter((r) => r !== "B-18");
  }

  return {
    cardEvals: cards,
    chipsFromCards,
    chipsFromCombos,
    chipsFromEffects,
    addedMult: comboMult + addMult,
    multiplicative,
    comboNames: scoringMatches.map((combo) => combo.name),
    usedCardUids,
    finalScore,
  };
}

function evalCard(instance: CardInstance | undefined): CardEval {
  if (!instance) {
    return { uid: "?", chips: 0, mult: 0, month: 1, rank: "KASU", tags: [], traits: [] };
  }
  const def = cardById.get(instance.cardId);
  if (!def) {
    return {
      uid: instance.uid,
      chips: 0,
      mult: 0,
      month: 1,
      rank: "KASU",
      tags: [],
      traits: [...instance.traits],
    };
  }
  const rank = instance.rankOverride ?? def.rank;
  const month = instance.monthOverride ?? def.month;
  return {
    uid: instance.uid,
    chips: def.baseChips + instance.bonusChips,
    mult: def.baseMult + instance.bonusMult,
    month,
    rank,
    tags: [...def.tags],
    traits: [...instance.traits],
  };
}

function applyCardTraitEffects(
  run: RunState,
  cards: CardEval[],
  add: (chips: number, mult: number, mul: number) => void,
): void {
  for (const card of cards) {
    if (card.traits.includes("PICTURED")) add(0, 10, 1);
    if (card.traits.includes("INK")) add(0, 0, 1.5);
    if (card.traits.includes("FORTUNE")) run.gold += 3;
    if (card.traits.includes("BLESSING")) {
      const luckyRng = new SeededRng(run.seed + run.scoreThisStage + run.hand.length);
      if (luckyRng.next() < 0.2) run.gold += 20;
      else if (luckyRng.next() < 0.4) add(0, 0, 2.0);
    }
    if (card.traits.includes("WILD_SAKURA")) {
      add(0, 0, 2.0);
      const glassRng = new SeededRng(run.seed + run.totalScore);
      if (glassRng.next() < 0.25) run.removed.push(card.uid);
    }
  }

  const newYearOnHand = run.hand
    .map((uid) => run.cardsByUid[uid])
    .filter((c) => c && c.traits.includes("NEW_YEAR"));
  if (newYearOnHand.length > 0) add(0, 0, 1.5);
}

function applyRelicEffects(
  run: RunState,
  cards: CardEval[],
  combos: ReturnType<typeof evaluateCombos>,
  add: (chips: number, mult: number, mul: number) => void,
): void {
  const ranks = cards.map((c) => c.rank);
  const months = cards.map((c) => c.month);
  const tags = new Set(cards.flatMap((c) => c.tags));
  const allMonthsUnique = new Set(months).size === months.length;

  for (const relicId of run.relics) {
    switch (relicId) {
      case "B-01":
        add(ranks.filter(r => r === "KASU").length * 20, 0, 1);
        break;
      case "B-02":
        if (combos.some(c => c.name === "青短")) add(0, 2, 1);
        break;
      case "B-03":
        if (run.koiKoi.continued && run.koiKoi.success) add(0, 0, 2);
        break;
      case "B-04":
        add(run.globalFlatChips, 0, 1);
        break;
      // B-05 赏樱席 is handled in run.ts (gives discards)
      case "B-06":
        add(0, cards.filter(c => c.tags.includes("BOAR") || c.tags.includes("DEER") || c.tags.includes("BUTTERFLY")).length * 1, 1);
        break;
      case "B-07":
        if (combos.some(c => c.name === "猪鹿蝶")) add(0, 0, 3);
        break;
      case "B-08":
        if (run.fieldCards.length <= 4) add(0, 0, 2.0);
        break;
      case "B-09":
        if (ranks.filter(r => r === "HIKARI").length >= 2) add(0, 0, 3);
        break;
      case "B-10":
        add(0, 0, 1 + cards.filter(c => c.month >= 7).length * 0.1);
        break;
      default:
        break;
    }
  }
}

function getRank(instance: CardInstance) {
  const def = cardById.get(instance.cardId);
  return instance.rankOverride ?? def?.rank ?? "KASU";
}

function countEnhancedCards(run: RunState): number {
  let count = 0;
  for (const ci of Object.values(run.cardsByUid)) {
    if (
      ci.bonusChips !== 0 ||
      ci.bonusMult !== 0 ||
      ci.rankOverride !== undefined ||
      ci.monthOverride !== undefined ||
      ci.traits.length > 0
    ) {
      count += 1;
    }
  }
  return count;
}

function getCurrentStageThreshold(run: RunState): number {
  const stageIndex = Math.min(run.stageIndex, stages.length - 1);
  return Math.max(200, Math.floor(parseTargetScore(stages[stageIndex]!.targetScoreText) * targetMultiplierByStage(stageIndex)));
}

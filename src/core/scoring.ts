import { cardById } from "../content/data";
import { evaluateCombos } from "./combos";
import { applyPreScoreRuleTweaks, type StageRuleContext } from "./rules";
import type { CardEval, CardInstance, RunState, ScoreBreakdown } from "../types/game";

export interface EvaluateParams {
  run: RunState;
  selectedUids: string[];
  stageRuleCtx: StageRuleContext;
  isFirstPlayInStage: boolean;
}

export function evaluatePlay(params: EvaluateParams): ScoreBreakdown {
  const { run, selectedUids, stageRuleCtx, isFirstPlayInStage } = params;
  const initial = selectedUids.map((uid) => evalCard(run.cardsByUid[uid]));
  const cards = applyPreScoreRuleTweaks(initial, stageRuleCtx, isFirstPlayInStage);

  let chipsFromEffects = run.globalFlatChips + run.seasonChipBonus;
  let addMult = run.globalFlatMult;
  let multiplicative = run.globalMultFactor;

  applyCardTraitEffects(run, cards, (chips, mult, mul) => {
    chipsFromEffects += chips;
    addMult += mult;
    multiplicative *= mul;
  });

  applyRelicEffects(run, cards, (chips, mult, mul) => {
    chipsFromEffects += chips;
    addMult += mult;
    multiplicative *= mul;
  });

  if (run.monthBuffTarget) {
    for (const c of cards) {
      if (c.month === run.monthBuffTarget) chipsFromEffects += 50;
    }
  }
  if (stageRuleCtx.season === "SUMMER" && run.discardsLeft < 3) {
    chipsFromEffects += 3 - run.discardsLeft;
  }

  const comboMatches = evaluateCombos(cards, run.comboLevels, {
    disableSameMonthCombo: stageRuleCtx.bossKey === "DISORDER",
    wildcardMonth11: run.relics.includes("B-12"),
  });

  const chipsFromCards = cards.reduce((sum, c) => sum + c.chips, 0);
  const chipsFromCombos = comboMatches.reduce((sum, c) => sum + c.addChips, 0);
  const comboMult = comboMatches.reduce((sum, c) => sum + c.addMult, 0);
  const base = chipsFromCards + chipsFromCombos + chipsFromEffects;
  const totalMult = Math.max(1, comboMult + addMult);
  let finalScore = Math.max(0, Math.floor(base * totalMult * multiplicative));

  if (run.relics.includes("B-18") && !run.phoenixPending) {
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
    comboNames: comboMatches.map((c) => c.name),
    finalScore,
  };
}

function evalCard(instance: CardInstance): CardEval {
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
    if (card.traits.includes("HOLO")) add(0, 10, 1);
    if (card.traits.includes("COLOR")) add(0, 0, 1.5);
    if (card.traits.includes("GOLDEN")) run.gold += 3;
    if (card.traits.includes("LUCKY")) {
      const roll = Math.random();
      if (roll < 0.5) run.gold += 20;
      else add(0, 15, 1);
    }
    if (card.traits.includes("GLASS")) {
      add(0, 0, 2);
      if (Math.random() < 0.25) run.removed.push(card.uid);
    }
  }
  const steelOnHand = run.hand
    .map((uid) => run.cardsByUid[uid])
    .filter((c) => c && c.traits.includes("STEEL"));
  if (steelOnHand.length > 0) add(0, 0, 1.5);
}

function applyRelicEffects(
  run: RunState,
  cards: CardEval[],
  add: (chips: number, mult: number, mul: number) => void,
): void {
  const ranks = cards.map((c) => c.rank);
  const months = cards.map((c) => c.month);
  const tags = new Set(cards.flatMap((c) => c.tags));
  const allMonthsUnique = new Set(months).size === months.length;

  for (const relicId of run.relics) {
    switch (relicId) {
      case "B-01":
        add(20, 0, 1);
        break;
      case "B-02":
        add(0, ranks.filter((r) => r === "TAN").length * 4, 1);
        break;
      case "B-03":
        add(run.hand.map((uid) => run.cardsByUid[uid]).filter((ci) => ci && getRank(ci) === "KASU").length * 10, 0, 1);
        break;
      case "B-04":
        if (months.includes(3) || months.includes(9)) add(0, 0, 1.5);
        break;
      case "B-07":
        if (allMonthsUnique) add(0, 0, 2);
        break;
      case "B-08":
        add(0, cards.filter((c) => c.rank === "HIKARI").reduce((sum, c) => sum + c.mult, 0), 1);
        break;
      case "B-09":
        if (cards.length === 1) add(100, 0, 1);
        break;
      case "B-10":
        if (tags.has("BOAR") || tags.has("DEER") || tags.has("BUTTERFLY")) add(0, 0, 1.5);
        if (tags.has("BOAR") && tags.has("DEER") && tags.has("BUTTERFLY")) add(0, 0, 5 / 1.5);
        break;
      case "B-11":
        add(cards.filter((c) => c.tags.includes("BLUE_RIBBON")).length * 50, 0, 1);
        break;
      case "B-14":
        add(0, countEnhancedCards(run) * 10, 1);
        break;
      case "B-16":
        add(0, 0, Math.pow(1.1, run.unlockedComboNames.length));
        break;
      case "B-20":
        add(0, cards.filter((c) => c.month === 1).length * 5, 1);
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

import { cardById, cards, parseTargetScore, relicById, rules, stages } from "../content/data";
import { SeededRng } from "./rng";
import { stageRuleContext } from "./rules";
import { evaluatePlay } from "./scoring";
import { stageClearGrowth, targetMultiplierByStage } from "./balance";
import type { CardDef, CardInstance, RunState, ScoreBreakdown } from "../types/game";

function uid(prefix: string, seq: number): string {
  return `${prefix}-${seq.toString().padStart(5, "0")}`;
}

export function createRun(seed = Date.now()): RunState {
  const rng = new SeededRng(seed);
  const allDefs = rng.shuffle(cards);
  const initialDefs = allDefs.slice(0, 12);
  const cardsByUid: Record<string, CardInstance> = {};
  let seq = 1;
  for (const def of initialDefs) {
    const id = uid("card", seq++);
    cardsByUid[id] = {
      uid: id,
      cardId: def.id,
      bonusChips: 0,
      bonusMult: 0,
      traits: [],
      appliedCharmIds: [],
    };
  }
  const drawPile = rng.shuffle(Object.keys(cardsByUid));
  const run: RunState = {
    seed,
    stageIndex: 0,
    gold: 12,
    scoreThisStage: 0,
    totalScore: 0,
    playsLeft: rules.basePlays,
    discardsLeft: rules.baseDiscards,
    drawPile,
    hand: [],
    discardPile: [],
    removed: [],
    cardsByUid,
    relics: [],
    charms: [],
    purchasedCharms: [],
    comboLevels: {},
    unlockedComboNames: [],
    seasonChipBonus: 0,
    nextPlayFlatChipBonus: 0,
    kasuPlayedCounter: 0,
    globalFlatChips: 0,
    globalFlatMult: 0,
    globalMultFactor: 1,
    stageCleared: false,
    runLost: false,
    stageRewardPending: 0,
    koiKoi: {
      offered: false,
      continued: false,
      pendingChoice: false,
      needExtraCombo: false,
      success: false,
      failed: false,
    },
    phoenixPending: false,
  };
  drawToHand(run, rules.maxHandSize);
  return run;
}

export function getCurrentStageTarget(run: RunState): number {
  const idx = Math.min(run.stageIndex, stages.length - 1);
  const raw = parseTargetScore(stages[idx].targetScoreText);
  return Math.max(200, Math.floor(raw * targetMultiplierByStage(idx)));
}

export function getMaxPlayCards(run: RunState): number {
  return run.relics.includes("B-19") ? 6 : rules.maxPlayCards;
}

export function drawToHand(run: RunState, targetSize: number): void {
  const rng = new SeededRng(run.seed + run.stageIndex * 100 + run.hand.length + run.drawPile.length);
  while (run.hand.length < targetSize) {
    if (run.drawPile.length === 0) {
      if (run.discardPile.length === 0) break;
      run.drawPile = rng.shuffle(run.discardPile);
      run.discardPile = [];
    }
    const next = run.drawPile.shift();
    if (!next) break;
    if (run.removed.includes(next)) continue;
    run.hand.push(next);
  }
}

export function playCards(run: RunState, selectedUids: string[]): ScoreBreakdown {
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const score = evaluatePlay({
    run,
    selectedUids,
    stageRuleCtx: stageRuleContext(stage),
    isFirstPlayInStage: run.playsLeft === rules.basePlays,
  });

  for (const uid of selectedUids) {
    run.hand = run.hand.filter((h) => h !== uid);
    if (!run.removed.includes(uid)) run.discardPile.push(uid);
  }
  run.playsLeft -= 1;

  run.scoreThisStage += score.finalScore;
  run.totalScore += score.finalScore;

  for (const name of score.comboNames) {
    run.comboLevels[name] = (run.comboLevels[name] ?? 0) + 1;
    if (name !== "乱舞 (散牌)" && !run.unlockedComboNames.includes(name)) {
      run.unlockedComboNames.push(name);
    }
  }
  applyPostPlayRelics(run, selectedUids);

  if (stage.bossRuleText.includes("冻结") && run.hand.length > 0) {
    const rng = new SeededRng(run.seed + run.totalScore + run.hand.length);
    run.frozenCardUid = run.hand[rng.int(0, run.hand.length - 1)];
  } else {
    run.frozenCardUid = undefined;
  }

  const target = getCurrentStageTarget(run);
  if (!run.koiKoi.offered && run.scoreThisStage >= target) {
    run.koiKoi.offered = true;
    run.koiKoi.pendingChoice = true;
  }
  if (run.koiKoi.continued && run.koiKoi.needExtraCombo) {
    if (score.comboNames.some((name) => name !== "乱舞 (散牌)")) {
      run.koiKoi.success = true;
      run.koiKoi.needExtraCombo = false;
      run.stageCleared = true;
    }
  }

  if (!run.stageCleared && run.playsLeft <= 0) {
    if (run.scoreThisStage >= target) {
      run.stageCleared = true;
      if (run.koiKoi.continued && run.koiKoi.needExtraCombo) {
        run.koiKoi.failed = true;
        run.koiKoi.needExtraCombo = false;
      }
    } else {
      run.runLost = true;
    }
  }

  drawToHand(run, rules.maxHandSize);
  return score;
}

export function previewPlayScore(run: RunState, selectedUids: string[]): ScoreBreakdown {
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const shadow: RunState = {
    ...run,
    drawPile: [...run.drawPile],
    hand: [...run.hand],
    discardPile: [...run.discardPile],
    removed: [...run.removed],
    relics: [...run.relics],
    charms: [...run.charms],
    purchasedCharms: [...(run.purchasedCharms ?? [])],
    comboLevels: { ...run.comboLevels },
    unlockedComboNames: [...run.unlockedComboNames],
    koiKoi: { ...run.koiKoi },
    cardsByUid: Object.fromEntries(
      Object.entries(run.cardsByUid).map(([k, v]) => [
        k,
        {
          ...v,
          traits: [...v.traits],
          appliedCharmIds: [...(v.appliedCharmIds ?? [])],
        },
      ]),
    ),
  };
  return evaluatePlay({
    run: shadow,
    selectedUids,
    stageRuleCtx: stageRuleContext(stage),
    isFirstPlayInStage: run.playsLeft === rules.basePlays,
  });
}

function applyPostPlayRelics(run: RunState, selectedUids: string[]): void {
  if (run.relics.includes("B-05")) {
    const kasuCount = selectedUids
      .map((uid) => run.cardsByUid[uid])
      .map((ci) => ci && cardById.get(ci.cardId))
      .filter((def) => def?.rank === "KASU").length;
    run.kasuPlayedCounter += kasuCount;
    while (run.kasuPlayedCounter >= 5) {
      run.kasuPlayedCounter -= 5;
      run.globalFlatMult += 1;
    }
  }
  run.nextPlayFlatChipBonus = 0;
}

export function discardCards(run: RunState, selectedUids: string[]): void {
  if (run.discardsLeft <= 0 || selectedUids.length === 0) return;
  for (const uid of selectedUids) {
    run.hand = run.hand.filter((h) => h !== uid);
    run.discardPile.push(uid);
  }
  run.discardsLeft -= 1;
  if (run.relics.includes("B-06")) run.nextPlayFlatChipBonus += 30;
  if (stages[run.stageIndex].season === "SUMMER") run.seasonChipBonus += 1;
  drawToHand(run, rules.maxHandSize);
}

export function settleStageAndPrepareShop(run: RunState): number {
  const target = getCurrentStageTarget(run);
  const ratio = Math.max(1, run.scoreThisStage / Math.max(1, target));
  let reward = Math.floor(8 + ratio * 5);
  reward += Math.floor(Math.min(run.gold, rules.interest.cap) / rules.interest.step) * rules.interest.bonus;

  if (run.koiKoi.continued && run.koiKoi.success) {
    reward += Math.max(2, run.playsLeft);
    run.globalFlatMult += Math.max(1, run.playsLeft);
  }
  if (run.koiKoi.continued && run.koiKoi.failed) reward = Math.floor(reward * rules.koiKoi.onFail.goldMultiplier);
  if (run.relics.includes("B-17")) reward += run.playsLeft * 2;

  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const growth = stageClearGrowth(run.stageIndex, stage.chapter.includes("BOSS"));
  run.globalFlatChips += growth.chips;
  run.globalFlatMult += growth.mult;
  run.globalMultFactor *= growth.multFactor;
  reward += growth.bonusGold;

  run.gold += reward;
  run.stageRewardPending = reward;
  return reward;
}

export function startNextStage(run: RunState): void {
  if (run.stageIndex < stages.length - 1) run.stageIndex += 1;
  run.scoreThisStage = 0;
  run.playsLeft = rules.basePlays;
  run.discardsLeft = rules.baseDiscards;
  run.seasonChipBonus = 0;
  run.monthBuffTarget = undefined;
  run.nextPlayFlatChipBonus = 0;
  run.stageCleared = false;
  run.frozenCardUid = undefined;
  run.koiKoi = {
    offered: false,
    continued: false,
    pendingChoice: false,
    needExtraCombo: false,
    success: false,
    failed: false,
  };
  drawToHand(run, rules.maxHandSize);
}

export function handleKoiKoiChoice(run: RunState, choice: "END" | "CONTINUE"): void {
  run.koiKoi.pendingChoice = false;
  if (choice === "END") {
    run.stageCleared = true;
    return;
  }
  run.koiKoi.continued = true;
  run.koiKoi.needExtraCombo = true;
}

export function addCardToDeck(run: RunState, cardDef: CardDef): void {
  const nextIndex = Object.keys(run.cardsByUid).length + 1;
  const newUid = uid("card", nextIndex);
  run.cardsByUid[newUid] = {
    uid: newUid,
    cardId: cardDef.id,
    bonusChips: 0,
    bonusMult: 0,
    traits: [],
    appliedCharmIds: [],
  };
  run.drawPile.push(newUid);
}

export function buyRelic(run: RunState, relicId: string): boolean {
  const relic = relicById.get(relicId);
  if (!relic || run.gold < relic.price) return false;
  if (!run.relics.includes(relicId)) run.relics.push(relicId);
  run.gold -= relic.price;
  if (relicId === "B-15" && run.relics.length > 1) {
    const copySource = run.relics[0];
    if (copySource !== "B-15") run.relics.push(copySource);
  }
  return true;
}

export function sellRelic(run: RunState, relicId: string): number {
  const relic = relicById.get(relicId);
  if (!relic) return 0;
  if (!run.relics.includes(relicId)) return 0;
  run.relics = run.relics.filter((id) => id !== relicId);
  const value = Math.floor(relic.price * 0.5);
  run.gold += value;
  if (relicId === "B-13") {
    for (const ci of Object.values(run.cardsByUid)) {
      const def = cardById.get(ci.cardId);
      if (!def) continue;
      const rank = ci.rankOverride ?? def.rank;
      const month = ci.monthOverride ?? def.month;
      if (rank === "KASU" && month === 1) {
        ci.rankOverride = "HIKARI";
        ci.bonusMult += 8;
      }
    }
  }
  return value;
}

export function buyCharm(run: RunState, charmId: string, price: number): boolean {
  if (!run.purchasedCharms) run.purchasedCharms = [];
  if (run.purchasedCharms.includes(charmId)) return false;
  if (run.gold < price) return false;
  run.gold -= price;
  run.charms.push(charmId);
  run.purchasedCharms.push(charmId);
  return true;
}

export function applyCharm(
  run: RunState,
  charmId: string,
  targetUid?: string,
  secondaryUid?: string,
): string {
  const pick = targetUid && run.cardsByUid[targetUid] ? run.cardsByUid[targetUid] : undefined;
  const first = pick ?? (run.hand.length > 0 ? run.cardsByUid[run.hand[0]] : undefined);
  if (!first && charmId !== "C-11" && charmId !== "C-12" && charmId !== "C-13") return "失败：没有可施法目标";
  if (first && first.appliedCharmIds.includes(charmId) && charmId !== "C-11" && charmId !== "C-12" && charmId !== "C-13") {
    return "失败：该牌已拥有相同符咒效果，不能重复施加";
  }

  switch (charmId) {
    case "C-01":
      first!.bonusChips += 30;
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} +30 Chips`;
    case "C-02":
      first!.bonusMult += 4;
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} +4 Mult`;
    case "C-03":
      first!.monthOverride = 8;
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 变为8月`;
    case "C-04":
      first!.monthOverride = 3;
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 变为3月`;
    case "C-05":
      first!.rankOverride = "TANE";
      first!.bonusChips += 45;
      first!.bonusMult += 5;
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 升阶为种`;
    case "C-06": {
      const cloneUid = uid("card", Object.keys(run.cardsByUid).length + 1);
      run.cardsByUid[cloneUid] = {
        ...first!,
        uid: cloneUid,
        traits: [...first!.traits],
        appliedCharmIds: [...first!.appliedCharmIds],
      };
      run.drawPile.push(cloneUid);
      recordCharm(first!, charmId);
      return `复制了 ${cardName(first!.uid, run)}`;
    }
    case "C-07":
      addTrait(first!.traits, "GOLDEN");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得黄金`;
    case "C-08":
      addTrait(first!.traits, "STEEL");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得钢化`;
    case "C-09":
      addTrait(first!.traits, "GLASS");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得玻璃`;
    case "C-10":
      addTrait(first!.traits, "HOLO");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得全息`;
    case "C-11": {
      const a = targetUid ?? run.hand[0];
      const b = secondaryUid ?? run.hand[1];
      [a, b].filter(Boolean).forEach((uidValue) => destroyCard(run, uidValue!));
      return "已摧毁最多2张牌";
    }
    case "C-12": {
      const rng = new SeededRng(run.seed + run.totalScore + run.hand.length);
      const targets = run.hand.slice(0, 3);
      for (const uidValue of targets) run.cardsByUid[uidValue].monthOverride = rng.int(1, 12);
      return "已重置3张手牌月份";
    }
    case "C-13":
      if (first) {
        run.monthBuffTarget = first.monthOverride ?? cardById.get(first.cardId)?.month ?? 1;
      } else {
        run.monthBuffTarget = 8;
      }
      return `本关月份${run.monthBuffTarget}获得+50 Chips`;
    case "C-14":
      addTrait(first!.traits, "LUCKY");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得幸运`;
    case "C-15":
      addTrait(first!.traits, "COLOR");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得彩色`;
    default:
      return "符咒未实现";
  }
}

function destroyCard(run: RunState, uidValue: string): void {
  run.hand = run.hand.filter((uid) => uid !== uidValue);
  run.drawPile = run.drawPile.filter((uid) => uid !== uidValue);
  run.discardPile = run.discardPile.filter((uid) => uid !== uidValue);
  run.removed.push(uidValue);
}

function addTrait(arr: CardInstance["traits"], trait: CardInstance["traits"][number]): void {
  if (!arr.includes(trait)) arr.push(trait);
}

function recordCharm(card: CardInstance, charmId: string): void {
  if (!card.appliedCharmIds) card.appliedCharmIds = [];
  if (!card.appliedCharmIds.includes(charmId)) card.appliedCharmIds.push(charmId);
}

function cardName(uidValue: string, run: RunState): string {
  const ci = run.cardsByUid[uidValue];
  if (!ci) return "未知牌";
  return cardById.get(ci.cardId)?.name ?? ci.cardId;
}

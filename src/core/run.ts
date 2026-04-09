import { cardById, cards, parseTargetScore, relicById, rules, stages } from "../content/data";
import { SeededRng } from "./rng";
import { stageRuleContext } from "./rules";
import { evaluatePlay } from "./scoring";
import { stageClearGrowth, targetMultiplierByStage } from "./balance";
import type { CardDef, CardInstance, KoiKoiState, RunState, ScoreBreakdown } from "../types/game";

export const MAX_RELIC_SLOTS = 4;
export const MAX_CHARM_SLOTS = 4;
/** How many single-card plays a player gets per stage */
export const STAGE_PLAYS = 8;
/** How many cards are dealt face-up to the field at stage start */
const INITIAL_FIELD_SIZE = 4;

function uid(prefix: string, seq: number): string {
  return `${prefix}-${seq.toString().padStart(5, "0")}`;
}

function freshKoiKoi(): KoiKoiState {
  return {
    pendingChoice: false,
    continued: false,
    success: false,
    failed: false,
    baselineCombos: [],
    triggerComboName: "",
  };
}

export function createRun(seed = Date.now()): RunState {
  const rng = new SeededRng(seed);
  const allDefs = rng.shuffle(cards);
  const cardsByUid: Record<string, CardInstance> = {};
  let seq = 1;
  for (const def of allDefs) {
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
  const drawPile = Object.keys(cardsByUid);
  const run: RunState = {
    seed,
    randomCounter: 0,
    stageIndex: 0,
    gold: 12,
    scoreThisStage: 0,
    totalScore: 0,
    playsLeft: STAGE_PLAYS,
    discardsLeft: rules.baseDiscards,
    drawPile,
    hand: [],
    fieldCards: [],
    capturedCards: [],
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
    koiKoiMultiplier: 1,
    koiKoi: freshKoiKoi(),
    bossCollected: [],
    phoenixPending: false,
  };
  startFieldDeal(run);
  drawToHand(run, rules.maxHandSize);
  return run;
}

function nextRandomSeed(run: RunState, salt = 0): number {
  run.randomCounter += 1;
  return (run.seed + run.randomCounter * 2654435761 + salt) >>> 0;
}

export function getCurrentStageTarget(run: RunState): number {
  const idx = Math.min(run.stageIndex, stages.length - 1);
  const raw = parseTargetScore(stages[idx].targetScoreText);
  return Math.max(200, Math.floor(raw * targetMultiplierByStage(idx)));
}

export function getMaxPlayCards(_run: RunState): number {
  // In field-matching mode, players always play 1 card at a time
  return 1;
}

export function getRelicSlots(run: RunState): Array<string | undefined> {
  return Array.from({ length: MAX_RELIC_SLOTS }, (_, index) => run.relics[index]);
}

export function getCharmSlots(run: RunState): Array<string | undefined> {
  return Array.from({ length: MAX_CHARM_SLOTS }, (_, index) => run.charms[index]);
}

/** Deal cards face-up to the field at the start of a stage */
export function startFieldDeal(run: RunState): void {
  for (let i = 0; i < INITIAL_FIELD_SIZE; i++) {
    const next = run.drawPile.shift();
    if (next && !run.removed.includes(next)) {
      run.fieldCards.push(next);
    }
  }
}

export function drawToHand(run: RunState, targetSize: number): void {
  const rng = new SeededRng(nextRandomSeed(run, run.stageIndex * 1009 + run.discardPile.length * 31));
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

/** Get the month of a card instance */
function getCardMonth(run: RunState, uid: string): number {
  const inst = run.cardsByUid[uid];
  if (!inst) return -1;
  const def = cardById.get(inst.cardId);
  return inst.monthOverride ?? def?.month ?? -1;
}

/** Find the best-scoring field card that matches a given month (for player to capture) */
function findFieldMatch(run: RunState, month: number): string | undefined {
  // Prefer higher-rank card if multiple same-month cards are on the field
  const matches = run.fieldCards.filter((u) => getCardMonth(run, u) === month);
  if (matches.length === 0) return undefined;
  // Sort by base value descending and pick the best
  return matches.sort((a, b) => {
    const da = cardById.get(run.cardsByUid[a]?.cardId ?? "");
    const db = cardById.get(run.cardsByUid[b]?.cardId ?? "");
    const va = (da?.baseChips ?? 0) + (da?.baseMult ?? 0) * 10;
    const vb = (db?.baseChips ?? 0) + (db?.baseMult ?? 0) * 10;
    return vb - va;
  })[0];
}

export interface PlayOneCardResult {
  /** uid of the played hand card */
  handUid: string;
  /** uid of the field card that was matched (if any) */
  handMatchUid?: string;
  /** uid of the card flipped from the draw pile */
  flippedUid?: string;
  /** uid of the field card matched by the flipped card (if any) */
  flipMatchUid?: string;
  /** New combo names that appeared after this play (triggers Koi-Koi choice) */
  newComboNames: string[];
  /** Full score breakdown at this point (only valid when stage ends or Koi-Koi triggers) */
  scoreBreakdown?: ScoreBreakdown;
  /** Whether the stage is now cleared */
  stageCleared: boolean;
  /** Whether the run is now lost */
  runLost: boolean;
}

/**
 * Core play action: play ONE card from hand into the field.
 * Implements the Hanafuda matching mechanic:
 *   1. Play hand card → capture if matching field card exists, else go to field
 *   2. Flip one card from draw pile → same logic
 *   3. Detect new yaku in capturedCards → trigger Koi-Koi if new yaku formed
 *   4. Boss takes one card from field (boss stages only)
 */
export function playOneCard(run: RunState, handUid: string): PlayOneCardResult {
  if (run.koiKoi.pendingChoice) {
    return { handUid, newComboNames: [], stageCleared: false, runLost: false };
  }
  if (!run.hand.includes(handUid)) {
    return { handUid, newComboNames: [], stageCleared: false, runLost: false };
  }

  // ── 1. Remove from hand ──────────────────────────────────────────────────
  run.hand = run.hand.filter((u) => u !== handUid);
  run.playsLeft -= 1;

  // Handle relic B-05 (Kasu counter)
  const playedInst = run.cardsByUid[handUid];
  const playedDef = playedInst ? cardById.get(playedInst.cardId) : undefined;
  if (run.relics.includes("B-05") && playedDef?.rank === "KASU") {
    run.kasuPlayedCounter += 1;
    while (run.kasuPlayedCounter >= 5) {
      run.kasuPlayedCounter -= 5;
      run.globalFlatMult += 1;
    }
  }

  let matchedSakura = false;
  let matchedSake = false;
  const kikuSakeId = "MONTH_9_TANE_SAKE";
  const checkMatch = (u: string) => {
    if (getCardMonth(run, u) === 3) matchedSakura = true;
    if (run.cardsByUid[u]?.cardId === kikuSakeId) matchedSake = true;
  };

  // ── 2. Match played card to field ─────────────────────────────────────────
  run.hand = run.hand.filter((u) => u !== handUid);
  const playedMonth = getCardMonth(run, handUid);
  const handMatchUid = findFieldMatch(run, playedMonth);
  if (handMatchUid) {
    checkMatch(handUid);
    checkMatch(handMatchUid);
    run.fieldCards = run.fieldCards.filter((u) => u !== handMatchUid);
    run.capturedCards.push(handUid, handMatchUid);
    // FORTUNE trait: earn $3 per captured card
    applyFortuneTrait(run, handUid);
    applyFortuneTrait(run, handMatchUid);
  } else {
    run.fieldCards.push(handUid);
  }

  // ── 3. Flip one card from draw pile ──────────────────────────────────────
  let flippedUid: string | undefined;
  let flipMatchUid: string | undefined;
  if (run.drawPile.length > 0) {
    flippedUid = run.drawPile.shift()!;
    while (flippedUid && run.removed.includes(flippedUid)) {
      flippedUid = run.drawPile.shift();
    }
    if (flippedUid) {
      const flippedMonth = getCardMonth(run, flippedUid);
      flipMatchUid = findFieldMatch(run, flippedMonth);
      if (flipMatchUid) {
        checkMatch(flippedUid);
        checkMatch(flipMatchUid);
        run.fieldCards = run.fieldCards.filter((u) => u !== flipMatchUid);
        run.capturedCards.push(flippedUid, flipMatchUid);
        applyFortuneTrait(run, flippedUid);
        applyFortuneTrait(run, flipMatchUid);
      } else {
        run.fieldCards.push(flippedUid);
      }
    }
  }

  if (matchedSakura && run.relics.includes("B-05")) {
    run.playsLeft = Math.min(rules.basePlays, run.playsLeft + 1);
  }
  if (matchedSake && run.relics.includes("B-04")) {
    run.globalFlatChips += 50;
  }

  // ── 4. Detect new yaku ────────────────────────────────────────────────────
  run.nextPlayFlatChipBonus = 0;
  const newComboNames = detectNewCombos(run);

  // ── 5. Boss action (boss stages) ─────────────────────────────────────────
  executeBossAction(run);

  // ── 6. Summer season chip bonus on discard ───────────────────────────────
  // (Applied in discard path; only the relic B-06 flip bonus here)
  if (run.relics.includes("B-06")) run.nextPlayFlatChipBonus += 30;

  // ── 7. Check Koi-Koi trigger ─────────────────────────────────────────────
  if (newComboNames.length > 0) {
    const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
    const score = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stage),
    });
    const target = getCurrentStageTarget(run);
    if (score.finalScore >= target || run.playsLeft <= 0) {
      // Enough to pass — offer Koi-Koi
      run.koiKoi.pendingChoice = true;
      run.koiKoi.triggerComboName = newComboNames[0] ?? "";
      // Draw new hand card so player has cards when Koi-Koi resolves
      drawToHand(run, rules.maxHandSize);
      return {
        handUid, handMatchUid, flippedUid, flipMatchUid,
        newComboNames,
        scoreBreakdown: score,
        stageCleared: false,
        runLost: false,
      };
    }
  }

  // No Koi-Koi → check if out of plays
  if (run.playsLeft <= 0) {
    return finalizeStage(run, handUid, handMatchUid, flippedUid, flipMatchUid, newComboNames);
  }

  // ── 8. Draw back up to hand size ─────────────────────────────────────────
  drawToHand(run, rules.maxHandSize);

  // Freeze mechanic (BOSS: 极寒)
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  if (stage.bossRuleText.includes("冻结") && run.hand.length > 0) {
    const rng = new SeededRng(nextRandomSeed(run, run.totalScore + run.hand.length));
    run.frozenCardUid = run.hand[rng.int(0, run.hand.length - 1)];
  } else {
    run.frozenCardUid = undefined;
  }

  return { handUid, handMatchUid, flippedUid, flipMatchUid, newComboNames, stageCleared: false, runLost: false };
}

/** Called when playsLeft hits 0 without a pending Koi-Koi, to finalize scoring */
function finalizeStage(
  run: RunState,
  handUid: string,
  handMatchUid: string | undefined,
  flippedUid: string | undefined,
  flipMatchUid: string | undefined,
  newComboNames: string[],
): PlayOneCardResult {
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const score = evaluatePlay({
    run,
    selectedUids: run.capturedCards,
    stageRuleCtx: stageRuleContext(stage),
  });
  const target = getCurrentStageTarget(run);

  run.scoreThisStage = score.finalScore;
  run.totalScore += score.finalScore;

  // Track which combos were achieved
  for (const name of score.comboNames) {
    run.comboLevels[name] = (run.comboLevels[name] ?? 0) + 1;
    if (name !== "乱舞 (散牌)" && !run.unlockedComboNames.includes(name)) {
      run.unlockedComboNames.push(name);
    }
  }

  if (score.finalScore >= target) {
    run.stageCleared = true;
    if (run.koiKoi.continued) run.koiKoi.success = true;
    return {
      handUid, handMatchUid, flippedUid, flipMatchUid,
      newComboNames, scoreBreakdown: score,
      stageCleared: true, runLost: false,
    };
  } else {
    // Koi-Koi was active but no new yaku formed → failure penalty check
    if (run.koiKoi.continued) {
      run.koiKoi.failed = true;
    }
    run.runLost = true;
    return {
      handUid, handMatchUid, flippedUid, flipMatchUid,
      newComboNames, scoreBreakdown: score,
      stageCleared: false, runLost: true,
    };
  }
}

/** Detect which combo names are newly present in capturedCards vs. the Koi-Koi baseline */
function detectNewCombos(run: RunState): string[] {
  if (run.capturedCards.length === 0) return [];
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const score = evaluatePlay({
    run,
    selectedUids: run.capturedCards,
    stageRuleCtx: stageRuleContext(stage),
  });
  const currentCombos = score.comboNames.filter((n) => n !== "乱舞 (散牌)");
  const baseline = run.koiKoi.baselineCombos;
  return currentCombos.filter((n) => !baseline.includes(n));
}

/** Boss steals one card from the field according to its strategy */
function executeBossAction(run: RunState): void {
  if (run.fieldCards.length === 0) return;
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  if (!stage.boss || !stage.bossRuleText) return;

  // Determine Boss strategy from its name/rule
  let targetUid: string | undefined;

  if (stage.boss.includes("酒吞")) {
    // Prefers TAN (ribbon) cards to block 赤短/青短
    targetUid = run.fieldCards.find((u) => {
      const def = cardById.get(run.cardsByUid[u]?.cardId ?? "");
      return def?.rank === "TAN";
    });
  } else if (stage.boss.includes("玉藻")) {
    // Prefers TANE (seed/animal) cards
    targetUid = run.fieldCards.find((u) => {
      const def = cardById.get(run.cardsByUid[u]?.cardId ?? "");
      return def?.rank === "TANE";
    });
  } else if (stage.boss.includes("土蜘蛛")) {
    // Prefers to break same-month combos: takes a card that would let player complete a pair
    const monthCounts = new Map<number, string[]>();
    for (const u of run.fieldCards) {
      const m = getCardMonth(run, u);
      if (!monthCounts.has(m)) monthCounts.set(m, []);
      monthCounts.get(m)!.push(u);
    }
    // Pick from a month that also appears in player's hand (to ruin future matches)
    for (const hUid of run.hand) {
      const hMonth = getCardMonth(run, hUid);
      const group = monthCounts.get(hMonth);
      if (group && group.length > 0) {
        targetUid = group[0];
        break;
      }
    }
  } else if (stage.boss.includes("宿儺") || stage.boss.includes("辉夜")) {
    // Prefers HIKARI (bright) cards
    targetUid = run.fieldCards.find((u) => {
      const def = cardById.get(run.cardsByUid[u]?.cardId ?? "");
      return def?.rank === "HIKARI";
    });
  }

  // Fallback: take leftmost field card
  if (!targetUid) targetUid = run.fieldCards[0];
  if (!targetUid) return;

  run.fieldCards = run.fieldCards.filter((u) => u !== targetUid);
  run.bossCollected.push(targetUid!);
}

function applyFortuneTrait(run: RunState, cardUid: string): void {
  const inst = run.cardsByUid[cardUid];
  if (inst?.traits.includes("FORTUNE")) run.gold += 3;
}

export function discardCards(run: RunState, selectedUids: string[]): void {
  if (run.discardsLeft <= 0 || selectedUids.length === 0) return;
  for (const uid of selectedUids) {
    run.hand = run.hand.filter((h) => h !== uid);
    run.discardPile.push(uid);
  }
  run.discardsLeft -= 1;
  if (run.relics.includes("B-06")) run.nextPlayFlatChipBonus += 30;
  if (stages[run.stageIndex]?.season === "SUMMER") run.seasonChipBonus += 1;
  drawToHand(run, rules.maxHandSize);
}

/** Called when player picks 「結了」(End) in the Koi-Koi dialog: finalize scoring */
export function handleKoiKoiChoice(run: RunState, choice: "END" | "CONTINUE"): ScoreBreakdown {
  run.koiKoi.pendingChoice = false;

  if (choice === "END") {
    const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
    const score = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stage),
    });

    run.scoreThisStage = score.finalScore;
    run.totalScore += score.finalScore;
    run.stageCleared = true;

    for (const name of score.comboNames) {
      run.comboLevels[name] = (run.comboLevels[name] ?? 0) + 1;
      if (name !== "乱舞 (散牌)" && !run.unlockedComboNames.includes(name)) {
        run.unlockedComboNames.push(name);
      }
    }
    return score;
  }

  // CONTINUE: stack the Koi-Koi multiplier and record current combos as baseline
  run.koiKoi.continued = true;
  run.koiKoiMultiplier *= 2;

  // Record current yaku as baseline so we can detect NEW ones next time
  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const currentScore = evaluatePlay({
    run,
    selectedUids: run.capturedCards,
    stageRuleCtx: stageRuleContext(stage),
  });
  run.koiKoi.baselineCombos = currentScore.comboNames.filter((n) => n !== "乱舞 (散牌)");

  // Give player one more play if they've run out
  if (run.playsLeft <= 0) run.playsLeft = 2;
  drawToHand(run, rules.maxHandSize);

  return currentScore;
}

export function settleStageAndPrepareShop(run: RunState): number {
  const target = getCurrentStageTarget(run);
  const ratio = Math.max(1, Math.min(6, run.scoreThisStage / Math.max(1, target)));
  let reward = Math.floor(4 + ratio * 1.5);
  reward += Math.floor(Math.min(run.gold, rules.interest.cap) / rules.interest.step) * rules.interest.bonus;

  if (run.koiKoi.continued && run.koiKoi.success) {
    reward += Math.max(1, Math.ceil(run.playsLeft / 2));
    run.globalFlatMult += Math.max(1, run.playsLeft);
  }
  if (run.koiKoi.continued && run.koiKoi.failed) reward = Math.floor(reward * rules.koiKoi.onFail.goldMultiplier);
  if (run.relics.includes("B-17")) reward += run.playsLeft;

  const stage = stages[Math.min(run.stageIndex, stages.length - 1)];
  const growth = stageClearGrowth(run.stageIndex, stage.chapter.includes("BOSS"));
  run.globalFlatChips += growth.chips;
  run.globalFlatMult += growth.mult;
  run.globalMultFactor *= growth.multFactor;
  reward += growth.bonusGold;

  reward = Math.max(3, reward);
  run.gold += reward;
  run.stageRewardPending = reward;
  return reward;
}

export function startNextStage(run: RunState): void {
  if (run.stageIndex < stages.length - 1) run.stageIndex += 1;
  run.scoreThisStage = 0;
  run.playsLeft = STAGE_PLAYS;
  run.discardsLeft = rules.baseDiscards;

  // Move all field + captured cards to discard
  for (const uid of [...run.fieldCards, ...run.capturedCards]) {
    if (!run.removed.includes(uid)) run.discardPile.push(uid);
  }
  run.fieldCards = [];
  run.capturedCards = [];
  run.bossCollected = [];

  run.seasonChipBonus = 0;
  run.monthBuffTarget = undefined;
  run.nextPlayFlatChipBonus = 0;
  run.stageCleared = false;
  run.frozenCardUid = undefined;
  run.koiKoiMultiplier = 1;
  run.koiKoi = freshKoiKoi();

  startFieldDeal(run);
  drawToHand(run, rules.maxHandSize);
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
  if (run.relics.length >= MAX_RELIC_SLOTS) return false;
  if (run.relics.includes(relicId)) return false;
  run.relics.push(relicId);
  run.gold -= relic.price;
  if (relicId === "B-15" && run.relics.length > 1 && run.relics.length < MAX_RELIC_SLOTS) {
    const copySource = run.relics[0];
    if (copySource !== "B-15") run.relics.push(copySource);
  }
  return true;
}

export function sellRelic(run: RunState, relicId: string, slotIndex?: number): number {
  const relic = relicById.get(relicId);
  if (!relic) return 0;
  const actualIndex = typeof slotIndex === "number" ? slotIndex : run.relics.indexOf(relicId);
  if (actualIndex < 0 || run.relics[actualIndex] !== relicId) return 0;
  run.relics.splice(actualIndex, 1);
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
  if (run.charms.length >= MAX_CHARM_SLOTS) return false;
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
      addTrait(first!.traits, "FORTUNE");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得招财`;
    case "C-08":
      addTrait(first!.traits, "NEW_YEAR");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得守岁`;
    case "C-09":
      addTrait(first!.traits, "WILD_SAKURA");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得狂樱`;
    case "C-10":
      addTrait(first!.traits, "PICTURED");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得绘图`;
    case "C-11": {
      const a = targetUid ?? run.hand[0];
      const b = secondaryUid ?? run.hand[1];
      [a, b].filter(Boolean).forEach((uidValue) => destroyCard(run, uidValue!));
      return "已摧毁最多2张牌";
    }
    case "C-12": {
      const rng = new SeededRng(nextRandomSeed(run, run.totalScore + run.hand.length * 17));
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
      addTrait(first!.traits, "BLESSING");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得赐福`;
    case "C-15":
      addTrait(first!.traits, "INK");
      recordCharm(first!, charmId);
      return `${cardName(first!.uid, run)} 获得水墨`;
    default:
      return "符咒未实现";
  }
}

export function removeCharmAt(run: RunState, slotIndex: number): string | undefined {
  if (slotIndex < 0 || slotIndex >= run.charms.length) return undefined;
  const [removedCharm] = run.charms.splice(slotIndex, 1);
  return removedCharm;
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

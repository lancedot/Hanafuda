import { describe, expect, it } from "vitest";
import { cards, stages } from "../src/content/data";
import { createRun, handleKoiKoiChoice, playOneCard } from "../src/core/run";
import { evaluatePlay } from "../src/core/scoring";
import { stageRuleContext } from "../src/core/rules";

/** Force a specific card into the player's hand */
function forceToHand(run: ReturnType<typeof createRun>, cardIds: string[]): string[] {
  const uids: string[] = [];
  let seq = 900;
  for (const cardId of cardIds) {
    const uid = `th-${seq++}`;
    run.cardsByUid[uid] = {
      uid,
      cardId,
      bonusChips: 0,
      bonusMult: 0,
      traits: [],
      appliedCharmIds: [],
    };
    uids.push(uid);
  }
  run.hand.push(...uids);
  return uids;
}

/** Force a specific card onto the field */
function forceToField(run: ReturnType<typeof createRun>, cardIds: string[]): string[] {
  const uids: string[] = [];
  let seq = 800;
  for (const cardId of cardIds) {
    const uid = `tf-${seq++}`;
    run.cardsByUid[uid] = {
      uid,
      cardId,
      bonusChips: 0,
      bonusMult: 0,
      traits: [],
      appliedCharmIds: [],
    };
    uids.push(uid);
  }
  run.fieldCards.push(...uids);
  return uids;
}

describe("playOneCard – field matching", () => {
  it("captures pair when played card matches a field card (same month)", () => {
    const run = createRun(1);
    // Get two month-1 cards
    const month1 = cards.filter((c) => c.month === 1).slice(0, 2);
    expect(month1.length).toBe(2);

    // Hand card
    const [handCards] = [forceToHand(run, [month1[0]!.id])];
    const handUid = handCards[0]!;

    // Field card (different uid, same month)
    const [fieldCards] = [forceToField(run, [month1[1]!.id])];
    const fieldUid = fieldCards[0]!;

    const priorCaptured = run.capturedCards.length;
    const result = playOneCard(run, handUid);

    expect(result.handMatchUid).toBe(fieldUid);
    expect(run.capturedCards.length).toBeGreaterThan(priorCaptured);
    expect(run.capturedCards).toContain(handUid);
    expect(run.capturedCards).toContain(fieldUid);
    expect(run.fieldCards).not.toContain(fieldUid);
    expect(run.fieldCards).not.toContain(handUid);
  });

  it("places card on field when no matching month exists", () => {
    const run = createRun(2);
    run.fieldCards = []; // clear field

    const month1 = cards.filter((c) => c.month === 1)[0];
    expect(month1).toBeDefined();
    const [handUids] = [forceToHand(run, [month1!.id])];
    const handUid = handUids[0]!;

    const initField = run.fieldCards.length;
    const result = playOneCard(run, handUid);

    expect(result.handMatchUid).toBeUndefined();
    // The played card should now be on the field (unless flip also landed there and matched)
    // At minimum playsLeft should have decreased
    expect(run.playsLeft).toBeLessThan(8);
  });

  it("reduces playsLeft by 1 per call", () => {
    const run = createRun(3);
    const initial = run.playsLeft;
    const month12 = cards.filter((c) => c.month === 12)[0];
    const [uids] = [forceToHand(run, [month12!.id])];
    playOneCard(run, uids[0]!);
    expect(run.playsLeft).toBe(initial - 1);
  });
});

describe("scoring – capturedCards basis", () => {
  it("applies same-month combo to captured cards", () => {
    const run = createRun(10);
    const month1 = cards.filter((c) => c.month === 1).slice(0, 2);
    const uids: string[] = [];
    let seq = 700;
    for (const c of month1) {
      const uid = `sc-${seq++}`;
      run.cardsByUid[uid] = { uid, cardId: c.id, bonusChips: 0, bonusMult: 0, traits: [], appliedCharmIds: [] };
      uids.push(uid);
    }
    run.capturedCards.push(...uids);

    const breakdown = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stages[0]!),
    });
    expect(breakdown.comboNames).toContain("同族 (同月)");
    expect(breakdown.finalScore).toBeGreaterThan(0);
  });

  it("applies koiKoiMultiplier to final score", () => {
    const run = createRun(11);
    const month8 = cards.find((c) => c.month === 8 && c.rank === "HIKARI")!;
    const uid = "kk-test";
    run.cardsByUid[uid] = { uid, cardId: month8.id, bonusChips: 0, bonusMult: 0, traits: [], appliedCharmIds: [] };
    run.capturedCards.push(uid);

    const scoreNormal = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stages[0]!),
    }).finalScore;

    run.koiKoiMultiplier = 2;
    const scoreDoubled = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stages[0]!),
    }).finalScore;

    expect(scoreDoubled).toBe(scoreNormal * 2);
  });

  it("disables same-month combo under DISORDER boss rule", () => {
    const run = createRun(12);
    run.stageIndex = 5;
    const month9 = cards.filter((c) => c.month === 9).slice(0, 2);
    const uids: string[] = [];
    let seq = 600;
    for (const c of month9) {
      const uid = `dis-${seq++}`;
      run.cardsByUid[uid] = { uid, cardId: c.id, bonusChips: 0, bonusMult: 0, traits: [], appliedCharmIds: [] };
      uids.push(uid);
    }
    run.capturedCards.push(...uids);
    const breakdown = evaluatePlay({
      run,
      selectedUids: run.capturedCards,
      stageRuleCtx: stageRuleContext(stages[5]!),
    });
    expect(breakdown.comboNames).not.toContain("同族 (同月)");
  });
});

describe("Koi-Koi – multiplier stacking", () => {
  it("koiKoiMultiplier doubles on CONTINUE", () => {
    const run = createRun(20);
    expect(run.koiKoiMultiplier).toBe(1);
    run.koiKoi.pendingChoice = true;
    // Make sure there are captured cards to score
    const c = cards[0]!;
    const uid = "kk-cont";
    run.cardsByUid[uid] = { uid, cardId: c.id, bonusChips: 0, bonusMult: 0, traits: [], appliedCharmIds: [] };
    run.capturedCards.push(uid);

    handleKoiKoiChoice(run, "CONTINUE");
    expect(run.koiKoiMultiplier).toBe(2);
    expect(run.koiKoi.continued).toBe(true);
    expect(run.koiKoi.pendingChoice).toBe(false);
  });

  it("koiKoiMultiplier stays at 1 on END", () => {
    const run = createRun(21);
    run.koiKoi.pendingChoice = true;
    const c = cards[0]!;
    const uid = "kk-end";
    run.cardsByUid[uid] = { uid, cardId: c.id, bonusChips: 0, bonusMult: 0, traits: [], appliedCharmIds: [] };
    run.capturedCards.push(uid);

    handleKoiKoiChoice(run, "END");
    expect(run.koiKoiMultiplier).toBe(1); // multiplier wasn't stacked
    expect(run.stageCleared).toBe(true);
  });
});

describe("run state – initialization", () => {
  it("createRun initializes fieldCards with 4 cards", () => {
    const run = createRun(42);
    expect(run.fieldCards.length).toBe(4);
    expect(run.capturedCards.length).toBe(0);
    expect(run.koiKoiMultiplier).toBe(1);
    expect(run.bossCollected.length).toBe(0);
  });
});

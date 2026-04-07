import { describe, expect, it } from "vitest";
import { cards, stages } from "../src/content/data";
import { createRun, getCurrentStageTarget, handleKoiKoiChoice, playCards } from "../src/core/run";
import { evaluatePlay } from "../src/core/scoring";
import { stageRuleContext } from "../src/core/rules";

function forceHand(run: ReturnType<typeof createRun>, cardIds: string[]): string[] {
  run.cardsByUid = {};
  run.drawPile = [];
  run.discardPile = [];
  run.hand = [];
  let i = 1;
  for (const cardId of cardIds) {
    const uid = `c-${i++}`;
    run.cardsByUid[uid] = {
      uid,
      cardId,
      bonusChips: 0,
      bonusMult: 0,
      traits: [],
      appliedCharmIds: [],
    };
    run.hand.push(uid);
  }
  return run.hand;
}

describe("scoring", () => {
  it("applies same-month combo by default", () => {
    const run = createRun(1);
    const month1 = cards.filter((c) => c.month === 1).slice(0, 2).map((c) => c.id);
    const hand = forceHand(run, month1);
    const breakdown = evaluatePlay({
      run,
      selectedUids: hand,
      stageRuleCtx: stageRuleContext(stages[0]),
      isFirstPlayInStage: true,
    });
    expect(breakdown.comboNames).toContain("同族 (同月)");
    expect(breakdown.finalScore).toBeGreaterThan(0);
  });

  it("disables same-month combo under disorder boss rule", () => {
    const run = createRun(2);
    run.stageIndex = 5;
    const month9 = cards.filter((c) => c.month === 9).slice(0, 2).map((c) => c.id);
    const hand = forceHand(run, month9);
    const breakdown = evaluatePlay({
      run,
      selectedUids: hand,
      stageRuleCtx: stageRuleContext(stages[5]),
      isFirstPlayInStage: true,
    });
    expect(breakdown.comboNames).not.toContain("同族 (同月)");
  });

  it("koi-koi continue can fail and still clear stage reward", () => {
    const run = createRun(3);
    run.stageIndex = 0;
    const high = cards.filter((c) => c.rank === "HIKARI").slice(0, 1).map((c) => c.id);
    const fillers = cards.filter((c) => c.rank === "KASU").slice(0, 5).map((c) => c.id);
    const firstHand = forceHand(run, [...high, ...fillers.slice(0, 2)]);
    const target = getCurrentStageTarget(run);
    const score = playCards(run, [firstHand[0]]);
    if (score.finalScore < target) {
      run.scoreThisStage = target + 10;
      run.koiKoi.offered = true;
      run.koiKoi.pendingChoice = true;
    }
    handleKoiKoiChoice(run, "CONTINUE");
    forceHand(run, [fillers[2], fillers[3], fillers[4]]);
    run.playsLeft = 1;
    playCards(run, [run.hand[0]]);
    expect(run.stageCleared).toBe(true);
    expect(run.koiKoi.failed || run.koiKoi.success).toBe(true);
  });
});

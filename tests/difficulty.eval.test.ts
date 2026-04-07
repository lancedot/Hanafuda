import { describe, expect, it } from "vitest";
import { cardById, cardPriceByRank, stages } from "../src/content/data";
import {
  addCardToDeck,
  buyCharm,
  buyRelic,
  createRun,
  discardCards,
  getMaxPlayCards,
  handleKoiKoiChoice,
  playCards,
  previewPlayScore,
  settleStageAndPrepareShop,
  startNextStage,
} from "../src/core/run";
import { generateShopOffer } from "../src/core/shop";

type RunResult = {
  seed: number;
  reached: number;
  cleared: boolean;
};

function* combinations<T>(arr: T[], maxSize: number): Generator<T[]> {
  const n = arr.length;
  for (let size = 1; size <= Math.min(maxSize, n); size += 1) {
    const idx = Array.from({ length: size }, (_, i) => i);
    while (true) {
      yield idx.map((i) => arr[i]);
      let p = size - 1;
      while (p >= 0 && idx[p] === n - size + p) p -= 1;
      if (p < 0) break;
      idx[p] += 1;
      for (let j = p + 1; j < size; j += 1) idx[j] = idx[j - 1] + 1;
    }
  }
}

function chooseBest(run: ReturnType<typeof createRun>): string[] {
  const maxPlay = getMaxPlayCards(run);
  const selectable = run.hand.filter((uid) => uid !== run.frozenCardUid);
  let best: string[] = [];
  let bestScore = -1;
  for (const combo of combinations(selectable, maxPlay)) {
    const p = previewPlayScore(run, combo);
    if (p.finalScore > bestScore) {
      bestScore = p.finalScore;
      best = combo;
    }
  }
  return best;
}

function simulate(seed: number): RunResult {
  const run = createRun(seed);
  let guard = 0;
  while (!run.runLost && guard < 500) {
    guard += 1;
    let turnGuard = 0;
    while (!run.runLost && !run.stageCleared && turnGuard < 30) {
      turnGuard += 1;
      if (run.koiKoi.pendingChoice) {
        // 难度评估用保守策略：达标就收，减少波动。
        handleKoiKoiChoice(run, "END");
        continue;
      }
      const best = chooseBest(run);
      if (best.length === 0) {
        if (run.discardsLeft > 0) discardCards(run, run.hand.slice(0, Math.min(3, run.hand.length)));
        else break;
      } else {
        playCards(run, best);
      }
    }

    if (run.runLost) break;
    if (!run.stageCleared) break;

    settleStageAndPrepareShop(run);
    if (run.stageIndex >= stages.length - 1) {
      return { seed, reached: run.stageIndex + 1, cleared: true };
    }

    const stage = stages[run.stageIndex];
    const offer = generateShopOffer(run.seed + run.totalScore, run.stageIndex, stage.season);

    for (const relic of offer.relics.sort((a, b) => b.price - a.price)) {
      if (run.gold >= relic.price) buyRelic(run, relic.id);
    }
    for (const charm of offer.charms) {
      if (run.gold >= charm.price) buyCharm(run, charm.id, charm.price);
    }
    for (const card of offer.cards.slice().sort((a, b) => b.baseChips * b.baseMult - a.baseChips * a.baseMult)) {
      const rank = cardById.get(card.id)?.rank ?? "KASU";
      const price = cardPriceByRank(rank);
      if (run.gold >= price) {
        addCardToDeck(run, card);
        run.gold -= price;
      }
    }
    startNextStage(run);
  }
  return { seed, reached: run.stageIndex + 1, cleared: false };
}

function evaluateDifficulty(sampleSize = 120) {
  const results: RunResult[] = [];
  for (let i = 0; i < sampleSize; i += 1) results.push(simulate(10000 + i));

  const avgReached = results.reduce((s, r) => s + r.reached, 0) / results.length;
  const fullClearRate = results.filter((r) => r.cleared).length / results.length;
  const stagePassRate = stages.map((_, i) => {
    const stageNum = i + 1;
    const pass = results.filter((r) => r.reached > stageNum || (r.reached === stageNum && r.cleared)).length;
    return {
      stage: stageNum,
      passRate: pass / results.length,
    };
  });
  return { sampleSize, avgReached, fullClearRate, stagePassRate, results };
}

describe("难度评估脚本", () => {
  it("输出关卡推进统计", () => {
    const summary = evaluateDifficulty(120);
    console.log("DIFFICULTY_EVAL", JSON.stringify(summary, null, 2));
    expect(summary.sampleSize).toBe(120);
  });
});


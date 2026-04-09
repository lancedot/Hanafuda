import { describe, expect, it } from "vitest";
import { cardById, cardPriceByRank, stages } from "../src/content/data";
import {
  addCardToDeck,
  buyCharm,
  buyRelic,
  createRun,
  discardCards,
  handleKoiKoiChoice,
  playOneCard,
  settleStageAndPrepareShop,
  startNextStage,
} from "../src/core/run";
import { generateShopOffer } from "../src/core/shop";

type RunResult = {
  seed: number;
  reached: number;
  cleared: boolean;
};

/**
 * Greedy AI: play the hand card that has the best chance of matching on the field.
 * Priority: 1) cards that match field  2) high-value cards
 */
function chooseBestCard(run: ReturnType<typeof createRun>): string | undefined {
  const selectable = run.hand.filter((uid) => uid !== run.frozenCardUid);
  if (selectable.length === 0) return undefined;

  // Find cards that have a matching field card
  const withMatch = selectable.filter((uid) => {
    const inst = run.cardsByUid[uid];
    const def = inst ? cardById.get(inst.cardId) : undefined;
    const month = inst?.monthOverride ?? def?.month ?? -1;
    return run.fieldCards.some((fUid) => {
      const fi = run.cardsByUid[fUid];
      const fd = fi ? cardById.get(fi.cardId) : undefined;
      return (fi?.monthOverride ?? fd?.month) === month;
    });
  });

  const candidates = withMatch.length > 0 ? withMatch : selectable;
  // Pick highest baseChips card
  return candidates.sort((a, b) => {
    const da = cardById.get(run.cardsByUid[a]?.cardId ?? "");
    const db = cardById.get(run.cardsByUid[b]?.cardId ?? "");
    return (db?.baseChips ?? 0) - (da?.baseChips ?? 0);
  })[0];
}

function simulate(seed: number): RunResult {
  const run = createRun(seed);
  let guard = 0;
  while (!run.runLost && guard < 1000) {
    guard += 1;
    let turnGuard = 0;
    while (!run.runLost && !run.stageCleared && turnGuard < 50) {
      turnGuard += 1;
      if (run.koiKoi.pendingChoice) {
        // Conservative strategy: always end Koi-Koi once triggered
        handleKoiKoiChoice(run, "END");
        if (run.stageCleared) break;
        continue;
      }
      if (run.playsLeft <= 0) break;
      const best = chooseBestCard(run);
      if (!best) {
        if (run.discardsLeft > 0 && run.hand.length > 0) {
          discardCards(run, run.hand.slice(0, Math.min(3, run.hand.length)));
        } else {
          break;
        }
      } else {
        const result = playOneCard(run, best);
        if (result.stageCleared || result.runLost) break;
      }
    }

    if (run.runLost) break;
    if (!run.stageCleared && !run.koiKoi.pendingChoice) break;

    settleStageAndPrepareShop(run);
    if (run.stageIndex >= stages.length - 1) {
      return { seed, reached: run.stageIndex + 1, cleared: true };
    }

    const stage = stages[run.stageIndex];
    const offer = generateShopOffer(run, stage.season);

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

function evaluateDifficulty(sampleSize = 60) {
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
    const summary = evaluateDifficulty(60);
    console.log("DIFFICULTY_EVAL", JSON.stringify(summary, null, 2));
    expect(summary.sampleSize).toBe(60);
  }, 60000);
});

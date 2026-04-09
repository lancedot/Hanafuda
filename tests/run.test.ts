import { describe, expect, it } from "vitest";
import { cards, rules } from "../src/content/data";
import { createRun } from "../src/core/run";

describe("run setup", () => {
  it("新开局使用完整牌库并抽取初始手牌", () => {
    const run = createRun(123);

    expect(Object.keys(run.cardsByUid)).toHaveLength(cards.length);
    expect(run.hand).toHaveLength(rules.maxHandSize);
    expect(run.drawPile.length + run.hand.length + run.discardPile.length + run.fieldCards.length).toBe(cards.length);
  });

  it("不同 seed 的初始手牌应有差异", () => {
    const runA = createRun(1);
    const runB = createRun(2);
    const handA = runA.hand.map((uid) => runA.cardsByUid[uid]?.cardId);
    const handB = runB.hand.map((uid) => runB.cardsByUid[uid]?.cardId);

    expect(handA).toHaveLength(rules.maxHandSize);
    expect(handA).not.toEqual(handB);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_CHARM_SLOTS, MAX_RELIC_SLOTS, buyCharm, buyRelic, createRun, sellRelic } from "../src/core/run";
import { generateShopOffer } from "../src/core/shop";
import { charms, relics } from "../src/content/data";

describe("商店与随机性", () => {
  it("不会再次刷新本局已拥有的法宝和已买过的符咒", () => {
    const run = createRun(12345);
    run.relics.push("B-01", "B-02");
    run.purchasedCharms.push("C-01", "C-02");

    const offer = generateShopOffer(run, "SPRING");

    expect(offer.relics.some((relic) => run.relics.includes(relic.id))).toBe(false);
    expect(offer.charms.some((charm) => run.purchasedCharms.includes(charm.id))).toBe(false);
  });

  it("同一种子在连续洗牌时会推进随机状态", () => {
    const run = createRun(67890);
    const firstCounter = run.randomCounter;

    generateShopOffer(run, "SPRING");
    generateShopOffer(run, "AUTUMN");

    expect(run.randomCounter).toBe(firstCounter + 2);
  });

  it("法宝槽满后不能继续购买，并且可以按槽位卖出", () => {
    const run = createRun(444);
    run.gold = 999;
    const relicIds = relics.slice(0, MAX_RELIC_SLOTS).map((relic) => relic.id);

    for (const relicId of relicIds) {
      expect(buyRelic(run, relicId)).toBe(true);
    }
    expect(run.relics).toHaveLength(MAX_RELIC_SLOTS);
    expect(buyRelic(run, relics[MAX_RELIC_SLOTS]!.id)).toBe(false);

    const soldId = run.relics[1]!;
    const soldValue = sellRelic(run, soldId, 1);
    expect(soldValue).toBeGreaterThan(0);
    expect(run.relics).not.toContain(soldId);
  });

  it("符咒槽满后不能继续购买", () => {
    const run = createRun(555);
    run.gold = 999;
    const charmDefs = charms.slice(0, MAX_CHARM_SLOTS + 1);

    for (const charm of charmDefs.slice(0, MAX_CHARM_SLOTS)) {
      expect(buyCharm(run, charm.id, charm.price)).toBe(true);
    }
    expect(run.charms).toHaveLength(MAX_CHARM_SLOTS);
    expect(buyCharm(run, charmDefs[MAX_CHARM_SLOTS]!.id, charmDefs[MAX_CHARM_SLOTS]!.price)).toBe(false);
  });
});

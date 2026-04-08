import { createRun } from "../core/run";
import { generateShopOffer } from "../core/shop";
import { stageRuleContext } from "../core/rules";
import { stages } from "../content/data";
import type { RunState, ShopOffer } from "../types/game";

export const session: {
  run: RunState;
  shopOffer: ShopOffer | null;
  log: string[];
} = {
  run: createRun(),
  shopOffer: null,
  log: [],
};

export function resetSession(seed = Date.now()): void {
  session.run = createRun(seed);
  session.shopOffer = null;
  session.log = [];
}

export function ensureShopOffer(): ShopOffer {
  if (session.shopOffer) return session.shopOffer;
  const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
  session.shopOffer = generateShopOffer(session.run, stage.season);
  return session.shopOffer;
}

export function clearShopOffer(): void {
  session.shopOffer = null;
}

export function pushLog(message: string): void {
  session.log.unshift(message);
  session.log = session.log.slice(0, 9);
}

export function currentRuleCtx() {
  const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
  return stageRuleContext(stage);
}

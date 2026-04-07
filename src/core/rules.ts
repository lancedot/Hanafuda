import { parseTargetScore } from "../content/data";
import type { CardEval, Season, StageDef } from "../types/game";

export interface StageRuleContext {
  season: Season;
  targetScore: number;
  bossKey?: "HANGOVER" | "FOXFIRE" | "DISORDER" | "FREEZE" | "NO_LIGHT";
}

export function stageRuleContext(stage: StageDef): StageRuleContext {
  let bossKey: StageRuleContext["bossKey"];
  if (stage.bossRuleText.includes("第一张牌不计分")) bossKey = "HANGOVER";
  if (stage.bossRuleText.includes("种") && stage.bossRuleText.includes("减半")) bossKey = "FOXFIRE";
  if (stage.bossRuleText.includes("无法触发") && stage.bossRuleText.includes("同族")) bossKey = "DISORDER";
  if (stage.bossRuleText.includes("冻结")) bossKey = "FREEZE";
  if (stage.bossRuleText.includes("光") && stage.bossRuleText.includes("降为“皮”")) bossKey = "NO_LIGHT";
  return {
    season: stage.season,
    targetScore: parseTargetScore(stage.targetScoreText),
    bossKey,
  };
}

export function applyPreScoreRuleTweaks(
  cards: CardEval[],
  ruleCtx: StageRuleContext,
  isFirstPlayInStage: boolean,
): CardEval[] {
  const mapped = cards.map((c) => ({ ...c, tags: [...c.tags], traits: [...c.traits] }));
  if (ruleCtx.bossKey === "NO_LIGHT") {
    for (const c of mapped) {
      if (c.rank === "HIKARI") {
        c.rank = "KASU";
        c.chips = Math.max(5, Math.floor(c.chips * 0.45));
        c.mult = Math.max(1, Math.floor(c.mult * 0.3));
      }
    }
  }
  if (ruleCtx.bossKey === "FOXFIRE") {
    for (const c of mapped) {
      if (c.rank === "TANE") c.chips = Math.floor(c.chips * 0.5);
    }
  }
  if (ruleCtx.season === "WINTER") {
    for (const c of mapped) {
      if (c.rank === "KASU") c.chips = Math.round(c.chips * 1.2);
    }
  }
  if (ruleCtx.bossKey === "HANGOVER" && isFirstPlayInStage && mapped.length > 0) {
    mapped[0].chips = 0;
    mapped[0].mult = 0;
  }
  return mapped;
}

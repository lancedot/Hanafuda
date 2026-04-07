import cardsRaw from "./generated/cards.json";
import charmsRaw from "./generated/charms.json";
import combosRaw from "./generated/combos.json";
import relicsRaw from "./generated/relics.json";
import rulesRaw from "./generated/rules.json";
import stagesRaw from "./generated/stages.json";
import type {
  CardDef,
  CharmDef,
  ComboDef,
  Rank,
  RelicDef,
  RuleSet,
  StageDef,
} from "../types/game";

export const cards = cardsRaw as CardDef[];
export const combos = combosRaw as ComboDef[];
export const relics = relicsRaw as RelicDef[];
export const charms = charmsRaw as CharmDef[];
export const rules = rulesRaw as RuleSet;
export const stages = stagesRaw as StageDef[];

export const cardById = new Map(cards.map((c) => [c.id, c]));
export const relicById = new Map(relics.map((r) => [r.id, r]));
export const charmById = new Map(charms.map((c) => [c.id, c]));
export const comboById = new Map(combos.map((c) => [c.id, c]));

export function cardPriceByRank(rank: Rank): number {
  switch (rank) {
    case "KASU":
      return 2;
    case "TAN":
      return 3;
    case "TANE":
      return 5;
    case "HIKARI":
      return 8;
    default:
      return 3;
  }
}

export function parseTargetScore(targetText: string): number {
  if (!targetText) return 1000;
  const parts = targetText.split("/").map((s) => s.trim());
  const last = parts[parts.length - 1];
  return parseHumanNumber(last);
}

function parseHumanNumber(text: string): number {
  const cleaned = text.replaceAll(",", "").replace("+", "").trim().toLowerCase();
  if (cleaned.includes("亿")) {
    const n = Number.parseFloat(cleaned.replace("亿", ""));
    return Number.isFinite(n) ? Math.round(n * 100_000_000) : 100_000_000;
  }
  if (cleaned.endsWith("m")) {
    const n = Number.parseFloat(cleaned.replace("m", ""));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : 1_000_000;
  }
  if (cleaned.endsWith("k")) {
    const n = Number.parseFloat(cleaned.replace("k", ""));
    return Number.isFinite(n) ? Math.round(n * 1_000) : 1000;
  }
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 1000;
}

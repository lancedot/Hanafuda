import { cards, charms, relics } from "../content/data";
import { SeededRng, weightedSampleNoRepeat } from "./rng";
import type { CardDef, RunState, Season, ShopOffer } from "../types/game";

export function generateShopOffer(run: RunState, season: Season): ShopOffer {
  const rng = new SeededRng(nextShopSeed(run));
  const ownedRelics = new Set(run.relics);
  const purchasedCharms = new Set(run.purchasedCharms ?? []);
  const relicPool = relics.filter((relic) => !ownedRelics.has(relic.id));
  const charmPool = charms.filter((charm) => !purchasedCharms.has(charm.id));
  const cardOffers = weightedSampleNoRepeat(rng, cards, (card) => cardWeight(card, season), 3);
  const relicOffers = weightedSampleNoRepeat(rng, relicPool, () => 1, 2);
  const charmOffers = weightedSampleNoRepeat(rng, charmPool, () => 1, 2);
  return {
    cards: cardOffers,
    relics: relicOffers,
    charms: charmOffers,
  };
}

function nextShopSeed(run: RunState): number {
  run.randomCounter += 1;
  return (run.seed + run.stageIndex * 991 + run.randomCounter * 2654435761) >>> 0;
}

function cardWeight(card: CardDef, season: Season): number {
  let weight = 1;
  if (season === "SPRING" && [1, 2, 3].includes(card.month)) weight += 1.4;
  if (season === "AUTUMN" && card.rank === "TANE") weight += 1.8;
  if (season === "WINTER" && card.rank === "KASU") weight += 0.8;
  return weight;
}

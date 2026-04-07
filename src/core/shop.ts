import { cards, charms, relics } from "../content/data";
import { SeededRng, weightedSampleNoRepeat } from "./rng";
import type { CardDef, Season, ShopOffer } from "../types/game";

export function generateShopOffer(seed: number, stageIndex: number, season: Season): ShopOffer {
  const rng = new SeededRng(seed + stageIndex * 991);
  const cardOffers = weightedSampleNoRepeat(rng, cards, (card) => cardWeight(card, season), 3);
  const relicOffers = weightedSampleNoRepeat(rng, relics, () => 1, 2);
  const charmOffers = weightedSampleNoRepeat(rng, charms, () => 1, 2);
  return {
    cards: cardOffers,
    relics: relicOffers,
    charms: charmOffers,
  };
}

function cardWeight(card: CardDef, season: Season): number {
  let weight = 1;
  if (season === "SPRING" && [1, 2, 3].includes(card.month)) weight += 1.4;
  if (season === "AUTUMN" && card.rank === "TANE") weight += 1.8;
  if (season === "WINTER" && card.rank === "KASU") weight += 0.8;
  return weight;
}

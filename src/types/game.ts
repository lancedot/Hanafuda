export type Rank = "HIKARI" | "TAN" | "KASU" | "TANE";
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" | "ECLIPSE";
export type Trait = "GOLDEN" | "STEEL" | "GLASS" | "HOLO" | "LUCKY" | "COLOR";

export interface CardDef {
  id: string;
  month: number;
  rank: Rank;
  name: string;
  baseChips: number;
  baseMult: number;
  note: string;
  lore: string;
  tags: string[];
}

export interface ComboDef {
  id: string;
  name: string;
  conditionText: string;
  baseMultText: string;
  levelUpText: string;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";
  price: number;
  effectScript: string;
  buildHint: string;
}

export interface CharmDef {
  id: string;
  name: string;
  type: string;
  effectScript: string;
  designIntent: string;
  price: number;
  permanence: "PERMANENT" | "TEMPORARY";
}

export interface StageDef {
  id: string;
  chapter: string;
  monthSet: string;
  targetScoreText: string;
  boss: string;
  bossRuleText: string;
  season: Season;
  shopConfig: { cards: number; relics: number; charms: number };
}

export interface RuleSet {
  maxHandSize: number;
  maxPlayCards: number;
  basePlays: number;
  baseDiscards: number;
  scoringFormula: string;
  koiKoi: {
    onSuccess: { bonusType: string };
    onFail: { goldMultiplier: number };
  };
  interest: {
    step: number;
    bonus: number;
    cap: number;
  };
}

export interface CardInstance {
  uid: string;
  cardId: string;
  bonusChips: number;
  bonusMult: number;
  monthOverride?: number;
  rankOverride?: Rank;
  traits: Trait[];
  appliedCharmIds: string[];
}

export interface KoiKoiState {
  offered: boolean;
  continued: boolean;
  pendingChoice: boolean;
  needExtraCombo: boolean;
  success: boolean;
  failed: boolean;
}

export interface RunState {
  seed: number;
  stageIndex: number;
  gold: number;
  scoreThisStage: number;
  totalScore: number;
  playsLeft: number;
  discardsLeft: number;
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  removed: string[];
  cardsByUid: Record<string, CardInstance>;
  relics: string[];
  charms: string[];
  purchasedCharms: string[];
  comboLevels: Record<string, number>;
  unlockedComboNames: string[];
  seasonChipBonus: number;
  monthBuffTarget?: number;
  nextPlayFlatChipBonus: number;
  kasuPlayedCounter: number;
  globalFlatChips: number;
  globalFlatMult: number;
  globalMultFactor: number;
  stageCleared: boolean;
  runLost: boolean;
  stageRewardPending: number;
  frozenCardUid?: string;
  koiKoi: KoiKoiState;
  phoenixPending: boolean;
}

export interface CardEval {
  uid: string;
  chips: number;
  mult: number;
  month: number;
  rank: Rank;
  tags: string[];
  traits: Trait[];
}

export interface ScoreBreakdown {
  cardEvals: CardEval[];
  chipsFromCards: number;
  chipsFromCombos: number;
  chipsFromEffects: number;
  addedMult: number;
  multiplicative: number;
  comboNames: string[];
  finalScore: number;
}

export interface ShopOffer {
  cards: CardDef[];
  relics: RelicDef[];
  charms: CharmDef[];
}

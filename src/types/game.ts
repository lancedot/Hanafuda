export type Rank = "HIKARI" | "TAN" | "KASU" | "TANE";
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" | "ECLIPSE";
export type Trait = "FORTUNE" | "NEW_YEAR" | "WILD_SAKURA" | "PICTURED" | "BLESSING" | "INK" | "MOON_PROXY";

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
  /** Whether Koi-Koi is currently pending a player choice */
  pendingChoice: boolean;
  /** Whether the player has chosen to continue at least once */
  continued: boolean;
  /** Whether the last Koi-Koi continuation succeeded (new yaku formed) */
  success: boolean;
  /** Whether the round ended without forming a new yaku after Koi-Koi */
  failed: boolean;
  /** Yaku names at the moment Koi-Koi was last triggered */
  baselineCombos: string[];
  /** Yaku name that triggered the current Koi-Koi offer */
  triggerComboName: string;
}

export interface RunState {
  seed: number;
  randomCounter: number;
  stageIndex: number;
  gold: number;
  scoreThisStage: number;
  totalScore: number;
  /** Single-card plays remaining this stage (default 8) */
  playsLeft: number;
  discardsLeft: number;
  drawPile: string[];
  hand: string[];
  /** Cards currently on the field (場) waiting to be matched */
  fieldCards: string[];
  /** Cards the player has successfully captured (拿走) this stage - used for scoring */
  capturedCards: string[];
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
  /** Multiplier that stacks each time a player chooses こいこい (starts at 1) */
  koiKoiMultiplier: number;
  koiKoi: KoiKoiState;
  /** Cards taken by the Boss from the field (Boss-stage only) */
  bossCollected: string[];
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

export interface ComboMatch {
  name: string;
  addMult: number;
  addChips: number;
  cardUids: string[];
}

export interface ScoreBreakdown {
  cardEvals: CardEval[];
  chipsFromCards: number;
  chipsFromCombos: number;
  chipsFromEffects: number;
  addedMult: number;
  multiplicative: number;
  comboNames: string[];
  usedCardUids: string[];
  finalScore: number;
}

export interface ShopOffer {
  cards: CardDef[];
  relics: RelicDef[];
  charms: CharmDef[];
}

export const STAGE_TARGET_MULTIPLIER: number[] = [
  1.0, // 1
  1.0, // 2
  0.95, // 3
  0.9, // 4
  0.68, // 5
  0.48, // 6
  0.24, // 7
  0.22, // 8
  0.24, // 9
];

const STAGE_CLEAR_CHIPS: number[] = [
  16, // 1
  22, // 2
  30, // 3
  40, // 4
  54, // 5
  70, // 6
  88, // 7
  108, // 8
  132, // 9
];

const STAGE_CLEAR_MULT: number[] = [
  1, // 1
  2, // 2
  2, // 3
  3, // 4
  3, // 5
  4, // 6
  5, // 7
  6, // 8
  8, // 9
];

const STAGE_CLEAR_BONUS_GOLD: number[] = [
  1, // 1
  1, // 2
  2, // 3
  2, // 4
  3, // 5
  4, // 6
  5, // 7
  6, // 8
  8, // 9
];

const STAGE_CLEAR_MULT_FACTOR: number[] = [
  1.0, // 1
  1.0, // 2
  1.03, // 3
  1.05, // 4
  1.08, // 5
  1.12, // 6
  1.18, // 7
  1.26, // 8
  1.35, // 9
];

export function targetMultiplierByStage(stageIndex: number): number {
  return STAGE_TARGET_MULTIPLIER[Math.min(stageIndex, STAGE_TARGET_MULTIPLIER.length - 1)] ?? 1;
}

export function stageClearGrowth(stageIndex: number, isBossStage: boolean) {
  const idx = Math.min(stageIndex, STAGE_CLEAR_CHIPS.length - 1);
  const chips = (STAGE_CLEAR_CHIPS[idx] ?? 16) + (isBossStage ? 18 : 0);
  const mult = (STAGE_CLEAR_MULT[idx] ?? 1) + (isBossStage ? 1 : 0);
  const bonusGold = (STAGE_CLEAR_BONUS_GOLD[idx] ?? 2) + (isBossStage ? 2 : 0);
  const multFactor = (STAGE_CLEAR_MULT_FACTOR[idx] ?? 1) * (isBossStage ? 1.05 : 1);
  return { chips, mult, bonusGold, multFactor };
}

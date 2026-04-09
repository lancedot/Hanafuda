import type { RunState } from "../types/game";

const SAVE_KEY = "hanafuda-roguelike-save-v1";

interface SaveEnvelope {
  version: 1;
  updatedAt: string;
  payload: RunState;
}

export function saveRun(run: RunState): void {
  const data: SaveEnvelope = {
    version: 1,
    updatedAt: new Date().toISOString(),
    payload: run,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadRun(): RunState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (envelope.version !== 1 || !envelope.payload) return null;
    const run = envelope.payload;
    if (run.randomCounter === undefined) run.randomCounter = 0;
    if (!run.fieldCards) run.fieldCards = [];
    if (!run.purchasedCharms) run.purchasedCharms = [];
    if (!run.koiKoi || !run.koiKoi.baselineCombos) {
      run.koiKoi = {
        pendingChoice: false,
        continued: false,
        success: false,
        failed: false,
        baselineCombos: [],
        triggerComboName: "",
      };
    }
    for (const card of Object.values(run.cardsByUid ?? {})) {
      if (!card.appliedCharmIds) card.appliedCharmIds = [];
      if (!card.traits) card.traits = [];
    }
    return run;
  } catch {
    return null;
  }
}

export function clearRunSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

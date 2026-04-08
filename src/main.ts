import Phaser from "phaser";
import { BootScene } from "./client/scenes/BootScene";
import { BattleScene } from "./client/scenes/BattleScene";
import { ShopScene } from "./client/scenes/ShopScene";
import { cardById, stages } from "./content/data";
import { session } from "./client/session";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#1d1b17",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 900,
    min: {
      width: 320,
      height: 180,
    },
    max: {
      width: 1920,
      height: 1080,
    },
  },
  scene: [BootScene, BattleScene, ShopScene],
});

function stateSnapshot(): string {
  const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
  const hand = session.run.hand.map((uid) => {
    const ci = session.run.cardsByUid[uid];
    const def = ci ? cardById.get(ci.cardId) : undefined;
    return {
      uid,
      name: def?.name ?? "unknown",
      month: ci?.monthOverride ?? def?.month ?? 0,
      rank: ci?.rankOverride ?? def?.rank ?? "KASU",
      traits: ci?.traits ?? [],
      frozen: session.run.frozenCardUid === uid,
    };
  });
  return JSON.stringify({
    coordinate_system: "ui_space_origin_top_left_x_right_y_down",
    mode: game.scene.getScenes(true)[0]?.scene.key ?? "boot",
    stage: {
      index: session.run.stageIndex,
      id: stage.id,
      chapter: stage.chapter,
      monthSet: stage.monthSet,
      target: stage.targetScoreText,
    },
    resources: {
      gold: session.run.gold,
      totalScore: session.run.totalScore,
      stageScore: session.run.scoreThisStage,
      playsLeft: session.run.playsLeft,
      discardsLeft: session.run.discardsLeft,
    },
    hand,
    relics: session.run.relics,
    charms: session.run.charms,
    koiKoi: session.run.koiKoi,
  });
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

window.render_game_to_text = stateSnapshot;
window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    game.step(1000 / 60, 1000 / 60);
  }
};

window.addEventListener("keydown", async (event) => {
  if (event.key.toLowerCase() === "f") {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  }
});

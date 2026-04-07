import Phaser from "phaser";
import { loadRun } from "../../save/storage";
import { resetSession, session } from "../session";
import { combos } from "../../content/data";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x17120e);
    this.add.text(w / 2, 210, "花牌肉鸽", {
      color: "#f7e8c8",
      fontSize: "72px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    }).setOrigin(0.5);
    this.add.text(w / 2, 286, "局内打牌 + 局外商店 + 章节推进", {
      color: "#dcc7a2",
      fontSize: "24px",
      fontFamily: "Microsoft YaHei",
    }).setOrigin(0.5);

    const start = this.makeButton("新开一局", w / 2, 430, () => {
      resetSession(Date.now());
      this.scene.start("battle");
    });
    const load = this.makeButton("读取存档", w / 2, 520, () => {
      const saved = loadRun();
      if (!saved) return;
      session.run = saved;
      this.scene.start("battle");
    });
    const help = this.add
      .text(
        w / 2,
        h - 120,
        "操作：点击手牌选择（最多5或6张）→ 出牌 / 弃牌。达标后可选择 Koi-Koi。",
        { color: "#bda583", fontSize: "16px", fontFamily: "Microsoft YaHei", wordWrap: { width: w - 220 }, align: "center" },
      )
      .setOrigin(0.5);
    const rule = this.add
      .text(
        w / 2,
        h - 50,
        `基础计分：总分 =（单卡筹码 + 牌型加分 + 附加加分）×（牌型倍率 + 附加倍率）× 乘法词条\n常见组合：${combos
          .slice(0, 5)
          .map((c) => c.name)
          .join("、")} ……`,
        { color: "#ccb790", fontSize: "14px", fontFamily: "Microsoft YaHei", wordWrap: { width: w - 140 }, align: "center" },
      )
      .setOrigin(0.5);

    if (!loadRun()) load.setStyle({ backgroundColor: "#3c3c3c", color: "#adadad" });
    this.add.existing(start);
    this.add.existing(load);
    this.add.existing(help);
    this.add.existing(rule);
  }

  private makeButton(label: string, x: number, y: number, onClick: () => void): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        color: "#fef2d8",
        backgroundColor: "#6a3d1f",
        fontFamily: "Microsoft YaHei",
        fontSize: "26px",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", onClick);
    return btn;
  }
}

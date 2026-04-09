import Phaser from "phaser";
import { loadRun } from "../../save/storage";
import { resetSession, session } from "../session";
import { combos } from "../../content/data";
import { 创建主题按钮, 墨金主题, 收束文本对象, 绘制场景底纹, 绘制描边面板, 限制多行 } from "../uiTheme";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("card_front", "assets/images/card_front.png");
    this.load.image("card_back", "assets/images/card_back.png");
    this.load.image("button_bg", "assets/images/button_bg.png");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    绘制场景底纹(this, w, h);
    绘制描边面板(this, 110, 88, w - 220, h - 176, { fill: 0x17120f, alpha: 0.9, radius: 26 });
    绘制描边面板(this, 150, 126, 620, 560, { fill: 0x241a15, alpha: 0.94, radius: 24 });
    绘制描边面板(this, 810, 126, 640, 560, { fill: 0x1d1713, alpha: 0.94, radius: 24 });

    this.add.text(180, 150, "花牌肉鸽", {
      color: 墨金主题.金亮,
      fontSize: "80px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(184, 240, "局内打牌 + 局外商店 + 章节推进", {
      color: 墨金主题.文本次,
      fontSize: "24px",
      fontFamily: "Microsoft YaHei",
    });
    this.add.text(184, 280, "以花札原型构筑牌组，在九重关卡里养成自己的役与法宝。", {
      color: 墨金主题.文本淡,
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
      wordWrap: { width: 560 }
    });

    const start = this.makeButton("新开一局", 182, 380, () => {
      resetSession(makeFreshSeed());
      this.scene.start("battle");
    });
    const load = this.makeButton("读取存档", 182, 450, () => {
      const saved = loadRun();
      if (!saved) return;
      session.run = saved;
      this.scene.start("battle");
    });

    this.add.text(184, 530, "快速上手", {
      color: 墨金主题.金亮,
      fontSize: "22px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(184, 570, "1. 点击手牌打出，若场上有相同月份的牌，会自动配对并进入收获区。\n2. 每次打牌并配对后，系统还会从牌堆自动翻出一张新牌以配对落场。\n3. 当收获区的牌凑成新役时，可直接结算，或选择Koi-Koi追求成倍奖励！", {
      color: 墨金主题.文本次,
      fontSize: "16px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 8,
      wordWrap: { width: 560 }
    });

    this.add.text(820, 150, "役与方向", {
      color: 墨金主题.金亮,
      fontSize: "28px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(820, 200, `常见组合：\n同月（两张同月起步）、短册（红青条）、光札等。\n\n建议节奏：\n前期用同月/短册体系稳住，商店优先拿能给你明确路线的法宝；\n中期围绕酒盅、种札去补关键件；\n后期再拼光/种的爆发与 Koi-Koi 成倍贪分！`, {
      color: 墨金主题.文本次,
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 8,
      wordWrap: { width: 580 }
    });

    this.add.text(820, 480, "当前版本重点", {
      color: 墨金主题.金亮,
      fontSize: "22px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(820, 520, "已支持战斗、首领、商店、Koi-Koi结算、法宝、符咒和回合存档。当前极简程序化界面支持悬停预览。后续可逐步导入高阶花札及首领插画，继续扩充卡池。", {
      color: 墨金主题.文本淡,
      fontSize: "16px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 8,
      wordWrap: { width: 580 }
    });

    if (!loadRun()) load.setStyle({ backgroundColor: "#3a3028", color: "#8f8576" });
    start.setOrigin(0, 0.5);
    load.setOrigin(0, 0.5);
  }

  private makeButton(label: string, x: number, y: number, onClick: () => void): Phaser.GameObjects.Text {
    return 创建主题按钮(this, x, y, label, onClick, "red").setStyle({
      fontSize: "24px",
      padding: { left: 22, right: 22, top: 12, bottom: 12 },
    });
  }
}

function makeFreshSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
  }
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

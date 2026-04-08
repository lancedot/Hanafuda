import Phaser from "phaser";
import { loadRun } from "../../save/storage";
import { resetSession, session } from "../session";
import { combos } from "../../content/data";
import { 创建主题按钮, 墨金主题, 收束文本对象, 绘制场景底纹, 绘制描边面板, 限制多行 } from "../uiTheme";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    绘制场景底纹(this, w, h);
    绘制描边面板(this, 110, 88, w - 220, h - 176, { fill: 0x17120f, alpha: 0.9, radius: 26 });
    绘制描边面板(this, 150, 126, 620, 560, { fill: 0x241a15, alpha: 0.94, radius: 24 });
    绘制描边面板(this, 810, 126, 640, 560, { fill: 0x1d1713, alpha: 0.94, radius: 24 });

    this.add.text(180, 160, "花牌肉鸽", {
      color: 墨金主题.金亮,
      fontSize: "80px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(184, 254, "局内打牌 + 局外商店 + 章节推进", {
      color: 墨金主题.文本次,
      fontSize: "24px",
      fontFamily: "Microsoft YaHei",
    });
    const subTitle = this.add.text(184, 310, "", {
      color: 墨金主题.文本淡,
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
    });
    收束文本对象(subTitle, "以花札原型构筑牌组，在九重关卡里养成自己的役与法宝。", {
      width: 520,
      height: 54,
      maxLines: 2,
      maxCharsLastLine: 30,
      minFontSize: 14,
    });

    const start = this.makeButton("新开一局", 182, 414, () => {
      resetSession(makeFreshSeed());
      this.scene.start("battle");
    });
    const load = this.makeButton("读取存档", 182, 486, () => {
      const saved = loadRun();
      if (!saved) return;
      session.run = saved;
      this.scene.start("battle");
    });

    this.add.text(184, 580, "快速上手", {
      color: 墨金主题.金亮,
      fontSize: "22px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    const helpText = this.add.text(184, 620, "", {
      color: 墨金主题.文本次,
      fontSize: "16px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 5,
    });
    收束文本对象(
      helpText,
      限制多行("1. 点击手牌选中，最多打出 5 张，拿到镜晶之影后可到 6 张。\n2. 先用同月和短册/种札稳定过渡，再追猪鹿蝶、青短/赤短、三光以上。\n3. 达标后可直接收分，也可以 Koi-Koi 继续冲更高成长。", 6, 40),
      {
        width: 520,
        height: 130,
        maxLines: 6,
        maxCharsLastLine: 40,
        minFontSize: 12,
        lineSpacing: 5,
      },
    );

    this.add.text(846, 160, "役与方向", {
      color: 墨金主题.金亮,
      fontSize: "28px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    const comboText = this.add.text(846, 214, "", {
      color: 墨金主题.文本次,
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 7,
    });
    收束文本对象(
      comboText,
      限制多行(
        `常见组合：${combos
          .slice(0, 6)
          .map((c) => c.name)
          .join("、")}\n\n建议节奏：\n前期用同月/短册体系稳住，商店优先拿能给你明确路线的法宝；中期围绕酒盅、赤短、青短和猪鹿蝶去补关键件；后期再拼光札爆发与 Koi-Koi 贪分。`,
        12,
        44,
      ),
      {
        width: 540,
        height: 250,
        maxLines: 12,
        maxCharsLastLine: 44,
        minFontSize: 13,
        lineSpacing: 7,
      },
    );

    this.add.text(846, 486, "当前版本重点", {
      color: 墨金主题.金亮,
      fontSize: "22px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    const featureText = this.add.text(846, 526, "", {
      color: 墨金主题.文本淡,
      fontSize: "16px",
      fontFamily: "Microsoft YaHei",
      lineSpacing: 6,
    });
    收束文本对象(
      featureText,
      限制多行("已支持战斗、商店、章节推进、Koi-Koi、法宝、符咒和本地存档。当前视觉仍以程序化界面为主，后续可逐步替换为正式卡面、法宝图标、场景底图与章节 Boss 插画。", 8, 44),
      {
        width: 540,
        height: 150,
        maxLines: 8,
        maxCharsLastLine: 44,
        minFontSize: 12,
        lineSpacing: 6,
      },
    );

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

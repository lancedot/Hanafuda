import Phaser from "phaser";

export const 墨金主题 = {
  背景深: 0x120f0d,
  背景中: 0x1d1713,
  面板深: 0x211914,
  面板浅: 0x2f241c,
  金边: 0xc6a56a,
  金亮值: 0xf3dfb1,
  朱砂: 0x8a3b2d,
  青墨: 0x24333a,
  松绿: 0x2e5742,
  紫檀: 0x46304f,
  金亮: "#f3dfb1",
  文本主: "#f5ead3",
  文本次: "#d8c5a1",
  文本淡: "#a99677",
};

export function 绘制场景底纹(scene: Phaser.Scene, width: number, height: number): void {
  scene.cameras.main.setBackgroundColor(墨金主题.背景深);
  scene.add.rectangle(width / 2, height / 2, width, height, 墨金主题.背景深);
  scene.add.rectangle(width / 2, height / 2, width - 36, height - 24, 墨金主题.背景中, 0.98);
  scene.add.rectangle(width / 2, height / 2, width - 72, height - 60, 0x0f0c0a, 0.18).setStrokeStyle(2, 墨金主题.金边, 0.45);

  for (let i = 0; i < 7; i += 1) {
    const y = 90 + i * 120;
    scene.add.rectangle(width / 2, y, width - 140, 2, 0xffffff, 0.03);
  }

  scene.add.ellipse(140, 120, 220, 220, 0xa36b38, 0.05);
  scene.add.ellipse(width - 140, height - 120, 280, 240, 0x7c2f22, 0.05);
}

export function 绘制描边面板(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { fill?: number; alpha?: number; stroke?: number; radius?: number },
): void {
  const fill = options?.fill ?? 墨金主题.面板深;
  const alpha = options?.alpha ?? 0.9;
  const stroke = options?.stroke ?? 墨金主题.金边;
  const radius = options?.radius ?? 18;
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha);
  g.lineStyle(2, stroke, 0.9);
  g.fillRoundedRect(x, y, width, height, radius);
  g.strokeRoundedRect(x, y, width, height, radius);
  g.lineStyle(1, 0xffffff, 0.06);
  g.strokeRoundedRect(x + 6, y + 6, width - 12, height - 12, Math.max(6, radius - 6));
}

export function 绘制标题签(scene: Phaser.Scene, x: number, y: number, text: string, width = 220): Phaser.GameObjects.Text {
  绘制描边面板(scene, x, y, width, 40, { fill: 0x2d2019, alpha: 0.94, stroke: 墨金主题.金边, radius: 12 });
  return scene.add.text(x + 14, y + 9, text, {
    color: 墨金主题.金亮,
    fontFamily: "Noto Serif SC, Microsoft YaHei",
    fontSize: "18px",
  });
}

export function 创建主题按钮(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  variant: "brown" | "red" | "green" | "purple" = "brown",
): Phaser.GameObjects.Text {
  const backgroundColor =
    variant === "red"
      ? "#6f2f2a"
      : variant === "green"
        ? "#315640"
        : variant === "purple"
          ? "#4b3558"
          : "#5a3d24";
  const hoverColor =
    variant === "red"
      ? "#8d4138"
      : variant === "green"
        ? "#3f6f52"
        : variant === "purple"
          ? "#644675"
          : "#77502c";

  const btn = scene.add
    .text(x, y, label, {
      color: "#fff3dc",
      backgroundColor,
      fontSize: "15px",
      fontFamily: "Microsoft YaHei",
      padding: { left: 14, right: 14, top: 8, bottom: 8 },
    })
    .setInteractive({ useHandCursor: true });

  btn.on("pointerover", () => btn.setStyle({ backgroundColor: hoverColor }));
  btn.on("pointerout", () => btn.setStyle({ backgroundColor }));
  btn.on("pointerup", onClick);
  return btn;
}

export function 限制多行(text: string, maxLines: number, maxCharsLastLine = 32): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = last.length <= maxCharsLastLine ? last : `${last.slice(0, Math.max(0, maxCharsLastLine - 1))}…`;
  return `${kept.join("\n")}\n……`;
}

export function 收束文本对象(
  textObject: Phaser.GameObjects.Text,
  rawText: string,
  options: {
    width: number;
    height: number;
    maxLines: number;
    maxCharsLastLine?: number;
    minFontSize?: number;
    lineSpacing?: number;
  },
): void {
  const minFontSize = options.minFontSize ?? 11;
  const baseFontSize = Number.parseInt(String(textObject.style.fontSize ?? "16"), 10) || 16;
  const lineSpacing = options.lineSpacing ?? textObject.lineSpacing ?? 0;
  let fontSize = baseFontSize;
  let fitted = 限制多行(rawText, options.maxLines, options.maxCharsLastLine ?? 32);

  textObject.setWordWrapWidth(options.width);
  textObject.setLineSpacing(lineSpacing);
  textObject.setFixedSize(options.width, options.height);

  while (fontSize >= minFontSize) {
    textObject.setFontSize(fontSize);
    textObject.setText(fitted);
    const overflowByHeight = textObject.height > options.height;
    const overflowByLines = textObject.getWrappedText().length > options.maxLines;
    if (!overflowByHeight && !overflowByLines) break;
    fontSize -= 1;
  }
}

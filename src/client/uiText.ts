import type { CardDef, Rank, Season, Trait } from "../types/game";

export const 月份名: Record<number, string> = {
  1: "一月·松",
  2: "二月·梅",
  3: "三月·樱",
  4: "四月·藤",
  5: "五月·菖蒲",
  6: "六月·牡丹",
  7: "七月·萩",
  8: "八月·芒",
  9: "九月·菊",
  10: "十月·枫",
  11: "十一月·柳",
  12: "十二月·桐",
};

export function 等阶名(rank: Rank): string {
  if (rank === "HIKARI") return "光札";
  if (rank === "TANE") return "种札";
  if (rank === "TAN") return "短册";
  return "皮札";
}

export function 等阶颜色(rank: Rank): string {
  if (rank === "HIKARI") return "#9e7bff";
  if (rank === "TANE") return "#2e8b57";
  if (rank === "TAN") return "#c0392b";
  return "#7f8c8d";
}

export function 等阶底色(rank: Rank): string {
  if (rank === "HIKARI") return "#32214f";
  if (rank === "TANE") return "#203b2e";
  if (rank === "TAN") return "#4a2622";
  return "#32373d";
}

export const 等阶基础说明 = [
  "等阶基础数值（卡牌原始值）",
  "光札：筹码 150，倍率 12（顶级）",
  "种札：筹码 50，倍率 6（中高）",
  "短册：筹码 15~20，倍率 2~3（功能）",
  "皮札：筹码 5，倍率 1（基础）",
];

export function 季节名(season: Season): string {
  if (season === "SPRING") return "春季";
  if (season === "SUMMER") return "夏季";
  if (season === "AUTUMN") return "秋季";
  if (season === "WINTER") return "冬季";
  return "终章";
}

export function 稀有度名(rarity: string): string {
  if (rarity === "COMMON") return "普通";
  if (rarity === "UNCOMMON") return "优秀";
  if (rarity === "RARE") return "稀有";
  if (rarity === "LEGENDARY") return "传说";
  return rarity;
}

export function 词条名(trait: Trait): string {
  if (trait === "GOLDEN") return "黄金";
  if (trait === "STEEL") return "钢化";
  if (trait === "GLASS") return "玻璃";
  if (trait === "HOLO") return "全息";
  if (trait === "LUCKY") return "幸运";
  return "彩色";
}

export function 花牌原名(card: CardDef): string {
  const mark = card.name.includes("A") ? "其一" : card.name.includes("B") ? "其二" : "";
  if (card.rank === "HIKARI") {
    const light: Record<number, string> = {
      1: "松上鹤",
      3: "樱幕",
      8: "芒上月",
      11: "雨柳",
      12: "桐上凤凰",
    };
    return `${light[card.month] ?? `${月份名[card.month]}光札`}${mark ? `（${mark}）` : ""}`;
  }
  if (card.rank === "TANE") {
    const tane: Record<number, string> = {
      2: "梅上莺",
      4: "藤上杜鹃",
      5: "八桥",
      6: "牡丹蝶",
      7: "萩上猪",
      8: "芒上雁",
      9: "菊上酒盅",
      10: "枫上鹿",
      11: "柳上燕",
    };
    return `${tane[card.month] ?? `${月份名[card.month]}种札`}${mark ? `（${mark}）` : ""}`;
  }
  if (card.rank === "TAN") {
    if (card.tags.includes("RED_RIBBON")) return `${月份名[card.month]}·赤短`;
    if (card.tags.includes("BLUE_RIBBON")) return `${月份名[card.month]}·青短`;
    return `${月份名[card.month]}·短册`;
  }
  return `${月份名[card.month]}·皮札${mark ? `（${mark}）` : ""}`;
}

export const 基础计分说明 = [
  "基础计分规则：",
  "总分 =（单卡筹码之和 + 符咒加分 + 牌型加分）",
  "      ×（牌型倍率 + 附加倍率）× 乘法词条连乘",
  "补充：",
  "1) 同一手牌可同时触发多个组合并叠加。",
  "2) 达标时可选择 Koi-Koi：继续冲分，失败会让本关金币减半。",
];

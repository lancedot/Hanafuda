import Phaser from "phaser";
import { cardPriceByRank, charmById, relicById, stages } from "../../content/data";
import {
  MAX_CHARM_SLOTS,
  MAX_RELIC_SLOTS,
  addCardToDeck,
  buyCharm,
  buyRelic,
  getCharmSlots,
  getRelicSlots,
  sellRelic,
  startNextStage,
} from "../../core/run";
import { clearShopOffer, ensureShopOffer, pushLog, session } from "../session";
import { saveRun } from "../../save/storage";
import { 季节名, 月份名, 等阶名, 稀有度名, 花牌原名 } from "../uiText";
import { 创建主题按钮, 墨金主题, 收束文本对象, 绘制场景底纹, 绘制描边面板, 绘制标题签, 限制多行 } from "../uiTheme";

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("shop");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    绘制场景底纹(this, w, h);
    绘制描边面板(this, 24, 20, w - 48, h - 40, { fill: 0x17120f, alpha: 0.94, radius: 28 });
    绘制描边面板(this, 34, 92, 1240, h - 126, { fill: 0x1d1713, alpha: 0.94, radius: 22 });
    绘制描边面板(this, 1290, 92, 276, h - 126, { fill: 0x201713, alpha: 0.95, radius: 22 });
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const offer = ensureShopOffer();

    this.add.text(40, 20, `阴阳屋 - 第${session.run.stageIndex + 1}关后整备`, {
      color: 墨金主题.金亮,
      fontSize: "28px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(40, 64, `当前金币：${session.run.gold}   季节：${季节名(stage.season)}   结算奖励：${session.run.stageRewardPending}金币`, {
      color: 墨金主题.文本次,
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
    });

    绘制标题签(this, 48, 104, "妖怪招募", 180);
    if (offer.cards.length === 0) {
      this.add.text(40, 145, "本轮没有新的妖怪招募。", {
        color: 墨金主题.文本淡,
        fontSize: "14px",
        fontFamily: "Microsoft YaHei",
      });
    }
    offer.cards.forEach((card, idx) => {
      const price = cardPriceByRank(card.rank);
      const x = 40 + idx * 420;
      const y = 145;
      绘制描边面板(this, x - 6, y - 6, 402, 148, {
        fill: idx % 2 === 0 ? 0x2d2019 : 0x261c17,
        alpha: 0.95,
        stroke: idx % 2 === 0 ? 墨金主题.金边 : 0xb88c59,
        radius: 16,
      });
      const block = this.add
        .text(x, y, 限制多行(`【${花牌原名(card)}】\n妖怪：${card.name}\n月份：${月份名[card.month]}  等阶：${等阶名(card.rank)}\n基础筹码：${card.baseChips}  基础倍率：${card.baseMult}\n定位：${card.note || "通用补强"}\n价格：${price}金币`, 6, 34), {
          color: 墨金主题.文本主,
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 8, right: 8, top: 8, bottom: 8 },
        })
        .setInteractive({ useHandCursor: true });
      收束文本对象(block, block.text, {
        width: 390,
        height: 132,
        maxLines: 6,
        maxCharsLastLine: 34,
        minFontSize: 11,
      });
      block.on("pointerup", () => {
        if (session.run.gold < price) return;
        addCardToDeck(session.run, card);
        session.run.gold -= price;
        pushLog(`购买妖怪 ${card.name} -${price}金币`);
        this.scene.restart();
      });
    });

    绘制标题签(this, 48, 294, "法宝陈列", 180);
    if (offer.relics.length === 0) {
      this.add.text(40, 335, "可购买法宝已被本局拿完。", {
        color: 墨金主题.文本淡,
        fontSize: "14px",
        fontFamily: "Microsoft YaHei",
      });
    }
    offer.relics.forEach((relic, idx) => {
      const x = 40 + idx * 620;
      const y = 335;
      const bought = session.run.relics.includes(relic.id);
      const slotsFull = session.run.relics.length >= MAX_RELIC_SLOTS;
      绘制描边面板(this, x - 6, y - 6, 612, 138, {
        fill: bought || slotsFull ? 0x2d2a28 : 0x341c1b,
        alpha: 0.95,
        stroke: bought || slotsFull ? 0x6e6254 : 墨金主题.金边,
        radius: 16,
      });
      const block = this.add
        .text(x, y, 限制多行(`${relic.name}（${稀有度名(relic.rarity)}）\n价格：${relic.price}金币\n${relic.effectScript}\n构筑提示：${relic.buildHint}\n${bought ? "已拥有" : slotsFull ? "法宝槽已满，先卖出再买" : "点击购买"}`, 5, 52), {
          color: 墨金主题.文本主,
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 10, right: 10, top: 10, bottom: 10 },
        })
        .setInteractive({ useHandCursor: !bought && !slotsFull });
      收束文本对象(block, block.text, {
        width: 590,
        height: 122,
        maxLines: 5,
        maxCharsLastLine: 52,
        minFontSize: 11,
      });
      block.on("pointerup", () => {
        if (bought || slotsFull) return;
        if (buyRelic(session.run, relic.id)) {
          pushLog(`购买法宝 ${relic.name}`);
          this.scene.restart();
        }
      });
    });

    绘制标题签(this, 48, 480, "符咒铺", 180);
    if (offer.charms.length === 0) {
      this.add.text(40, 522, "可购买符咒已被本局拿完。", {
        color: 墨金主题.文本淡,
        fontSize: "14px",
        fontFamily: "Microsoft YaHei",
      });
    }
    offer.charms.forEach((charm, idx) => {
      const x = 40 + idx * 620;
      const y = 522;
      const boughtBefore = session.run.purchasedCharms?.includes(charm.id) ?? false;
      const slotsFull = session.run.charms.length >= MAX_CHARM_SLOTS;
      绘制描边面板(this, x - 6, y - 6, 612, 118, {
        fill: boughtBefore || slotsFull ? 0x2d2a28 : 0x221a34,
        alpha: 0.95,
        stroke: boughtBefore || slotsFull ? 0x6e6254 : 0xb08ddb,
        radius: 16,
      });
      const block = this.add
        .text(x, y, 限制多行(`${charm.name}\n价格：${charm.price}金币\n${charm.effectScript}\n${boughtBefore ? "本局已购买过，不能重复购买" : slotsFull ? "符咒槽已满，先消耗后再买" : "点击购买"}`, 4, 52), {
          color: 墨金主题.文本主,
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 10, right: 10, top: 10, bottom: 10 },
        })
        .setInteractive({ useHandCursor: !boughtBefore && !slotsFull });
      收束文本对象(block, block.text, {
        width: 590,
        height: 102,
        maxLines: 4,
        maxCharsLastLine: 52,
        minFontSize: 11,
      });
      block.on("pointerup", () => {
        if (boughtBefore || slotsFull) return;
        if (buyCharm(session.run, charm.id, charm.price)) {
          pushLog(`购买符咒 ${charm.name}`);
          this.scene.restart();
        }
      });
    });

    const relicSlots = getRelicSlots(session.run);
    const charmSlots = getCharmSlots(session.run);
    const relicDump = relicSlots
      .map((id, i) => `法宝槽 ${i + 1}：${id ? relicById.get(id)?.name ?? id : "空"}`)
      .join("\n");
    const charmDump = charmSlots.map((id, i) => `符咒槽 ${i + 1}：${id ? charmById.get(id)?.name ?? id : "空"}`).join("\n");
    绘制标题签(this, 1304, 104, "当前持有", 180);
    const inventoryText = this.add.text(1310, 150, "", {
      color: 墨金主题.文本次,
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
    });
    收束文本对象(inventoryText, 限制多行(`法宝槽位（${session.run.relics.length}/${MAX_RELIC_SLOTS}）:\n${relicDump}\n\n符咒槽位（${session.run.charms.length}/${MAX_CHARM_SLOTS}）:\n${charmDump}`, 16, 18), {
      width: 220,
      height: 240,
      maxLines: 16,
      maxCharsLastLine: 18,
      minFontSize: 11,
    });

    绘制标题签(this, 1304, 420, "整备操作", 180);
    relicSlots.forEach((relicId, slotIndex) => {
      const label = relicId ? `卖出槽${slotIndex + 1}` : `槽${slotIndex + 1}为空`;
      创建主题按钮(
        this,
        1310,
        470 + slotIndex * 42,
        label,
        () => {
          if (!relicId) return;
          const gain = sellRelic(session.run, relicId, slotIndex);
          pushLog(`卖出法宝槽${slotIndex + 1} +${gain}金币`);
          this.scene.restart();
        },
        relicId ? "brown" : "green",
      ).setStyle({
        fontSize: "14px",
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      });
    });

    const sellDesc = this.add.text(1310, 646, "", {
      color: 墨金主题.文本淡,
      fontFamily: "Microsoft YaHei",
      fontSize: "13px",
    });
    收束文本对象(sellDesc, "法宝现在有独立槽位。整备阶段可以按槽位卖出，腾出位置再买新的法宝。", {
      width: 210,
      height: 78,
      maxLines: 4,
      maxCharsLastLine: 18,
      minFontSize: 11,
    });

    创建主题按钮(this, 1310, h - 92, "进入下一关", () => {
      clearShopOffer();
      startNextStage(session.run);
      saveRun(session.run);
      this.scene.start("battle");
    }, "green").setStyle({
      fontSize: "18px",
      padding: { left: 18, right: 18, top: 11, bottom: 11 },
    });
  }
}

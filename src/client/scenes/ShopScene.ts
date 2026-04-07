import Phaser from "phaser";
import { cardPriceByRank, charmById, relicById, stages } from "../../content/data";
import { addCardToDeck, buyCharm, buyRelic, sellRelic, startNextStage } from "../../core/run";
import { clearShopOffer, ensureShopOffer, pushLog, session } from "../session";
import { saveRun } from "../../save/storage";
import { 季节名, 月份名, 等阶名, 稀有度名, 花牌原名 } from "../uiText";

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("shop");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x1d1a15);
    this.add.rectangle(w / 2, h / 2, w - 30, h - 30, 0x2a241d, 0.94).setStrokeStyle(2, 0xc69b5b);
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const offer = ensureShopOffer();

    this.add.text(40, 20, `阴阳屋 - 第${session.run.stageIndex + 1}关后整备`, {
      color: "#fcefd2",
      fontSize: "28px",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
    });
    this.add.text(40, 64, `当前金币：${session.run.gold}   季节：${季节名(stage.season)}   结算奖励：${session.run.stageRewardPending}金币`, {
      color: "#e6d2ad",
      fontSize: "18px",
      fontFamily: "Microsoft YaHei",
    });

    this.add.text(40, 110, "妖怪招募", { color: "#fcefd2", fontSize: "20px", fontFamily: "Microsoft YaHei" });
    offer.cards.forEach((card, idx) => {
      const price = cardPriceByRank(card.rank);
      const x = 40 + idx * 420;
      const y = 145;
      const block = this.add
        .text(x, y, `【${花牌原名(card)}】\n妖怪：${card.name}\n月份：${月份名[card.month]}  等阶：${等阶名(card.rank)}\n基础筹码：${card.baseChips}  基础倍率：${card.baseMult}\n价格：${price}金币`, {
          color: "#fef0d7",
          backgroundColor: "#4a3521",
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 8, right: 8, top: 8, bottom: 8 },
          wordWrap: { width: 390 },
        })
        .setInteractive({ useHandCursor: true });
      block.on("pointerup", () => {
        if (session.run.gold < price) return;
        addCardToDeck(session.run, card);
        session.run.gold -= price;
        pushLog(`购买妖怪 ${card.name} -${price}金币`);
        this.scene.restart();
      });
    });

    this.add.text(40, 300, "法宝陈列", { color: "#fcefd2", fontSize: "20px", fontFamily: "Microsoft YaHei" });
    offer.relics.forEach((relic, idx) => {
      const x = 40 + idx * 620;
      const y = 335;
      const bought = session.run.relics.includes(relic.id);
      const block = this.add
        .text(x, y, `${relic.name}（${稀有度名(relic.rarity)}）\n价格：${relic.price}金币\n${relic.effectScript}\n${bought ? "已拥有" : "点击购买"}`, {
          color: "#fef0d7",
          backgroundColor: bought ? "#3f3f3f" : "#4f2b2b",
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 10, right: 10, top: 10, bottom: 10 },
          wordWrap: { width: 600 },
        })
        .setInteractive({ useHandCursor: !bought });
      block.on("pointerup", () => {
        if (bought) return;
        if (buyRelic(session.run, relic.id)) {
          pushLog(`购买法宝 ${relic.name}`);
          this.scene.restart();
        }
      });
    });

    this.add.text(40, 486, "符咒铺", { color: "#fcefd2", fontSize: "20px", fontFamily: "Microsoft YaHei" });
    offer.charms.forEach((charm, idx) => {
      const x = 40 + idx * 620;
      const y = 522;
      const boughtBefore = session.run.purchasedCharms?.includes(charm.id) ?? false;
      const block = this.add
        .text(x, y, `${charm.name}\n价格：${charm.price}金币\n${charm.effectScript}\n${boughtBefore ? "本局已购买过，不能重复购买" : "点击购买"}`, {
          color: "#fef0d7",
          backgroundColor: boughtBefore ? "#3f3f3f" : "#3a3354",
          fontSize: "14px",
          fontFamily: "Microsoft YaHei",
          padding: { left: 10, right: 10, top: 10, bottom: 10 },
          wordWrap: { width: 600 },
        })
        .setInteractive({ useHandCursor: !boughtBefore });
      block.on("pointerup", () => {
        if (boughtBefore) return;
        if (buyCharm(session.run, charm.id, charm.price)) {
          pushLog(`购买符咒 ${charm.name}`);
          this.scene.restart();
        }
      });
    });

    const relicDump = session.run.relics
      .map((id, i) => `${i + 1}. ${relicById.get(id)?.name ?? id}`)
      .join("\n");
    const charmDump = session.run.charms.map((id, i) => `${i + 1}. ${charmById.get(id)?.name ?? id}`).join("\n");
    this.add.text(w - 260, 100, `持有法宝:\n${relicDump || "无"}\n\n持有符咒:\n${charmDump || "无"}`, {
      color: "#e7d3b1",
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
      wordWrap: { width: 190 },
    });

    const sellHint = this.add.text(w - 260, 420, "点击卖出最后一个法宝（返还半价）", {
      color: "#f6e1bd",
      backgroundColor: "#6c4024",
      fontSize: "12px",
      fontFamily: "Microsoft YaHei",
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
    });
    sellHint.setInteractive({ useHandCursor: true });
    sellHint.on("pointerup", () => {
      const last = session.run.relics[session.run.relics.length - 1];
      if (!last) return;
      const gain = sellRelic(session.run, last);
      pushLog(`卖出法宝 +${gain}金币`);
      this.scene.restart();
    });

    const proceed = this.add
      .text(w - 240, h - 56, "进入下一关", {
        color: "#fef2d7",
        backgroundColor: "#335d30",
        fontSize: "18px",
        fontFamily: "Microsoft YaHei",
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setInteractive({ useHandCursor: true });
    proceed.on("pointerup", () => {
      clearShopOffer();
      startNextStage(session.run);
      saveRun(session.run);
      this.scene.start("battle");
    });
  }
}

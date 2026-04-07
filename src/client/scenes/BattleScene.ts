import Phaser from "phaser";
import { cardById, cardPriceByRank, charmById, combos, relicById, rules, stages } from "../../content/data";
import {
  applyCharm,
  discardCards,
  getCurrentStageTarget,
  getMaxPlayCards,
  handleKoiKoiChoice,
  playCards,
  previewPlayScore,
  settleStageAndPrepareShop,
} from "../../core/run";
import { pushLog, session } from "../session";
import { saveRun } from "../../save/storage";
import { 基础计分说明, 季节名, 月份名, 等阶名, 等阶基础说明, 等阶底色, 等阶颜色, 花牌原名, 词条名 } from "../uiText";

export class BattleScene extends Phaser.Scene {
  private selected = new Set<string>();
  private cardTexts: Phaser.GameObjects.Text[] = [];
  private focusedUid?: string;
  private topText?: Phaser.GameObjects.Text;
  private infoText?: Phaser.GameObjects.Text;
  private logText?: Phaser.GameObjects.Text;
  private ruleText?: Phaser.GameObjects.Text;
  private detailText?: Phaser.GameObjects.Text;
  private koiPanel?: Phaser.GameObjects.Container;
  private resultPanel?: Phaser.GameObjects.Container;
  private previewText?: Phaser.GameObjects.Text;

  constructor() {
    super("battle");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const rightPanelWidth = 620;
    const rightPanelLeft = w - rightPanelWidth - 30;

    this.cameras.main.setBackgroundColor(0xe9dcc0);
    this.add.rectangle(w / 2, h / 2, w - 30, h - 20, 0x231d16, 0.9).setStrokeStyle(2, 0xc39b60);
    this.add.rectangle(rightPanelLeft + rightPanelWidth / 2, h / 2, rightPanelWidth, h - 70, 0x15110d, 0.64).setStrokeStyle(1, 0x7e6444);
    this.add.rectangle(rightPanelLeft + rightPanelWidth / 2, 290, rightPanelWidth - 20, 460, 0x1b1611, 0.58).setStrokeStyle(1, 0x5a4933);
    this.add.rectangle(rightPanelLeft + rightPanelWidth / 2, 560, rightPanelWidth - 20, 120, 0x1a1510, 0.62).setStrokeStyle(1, 0x5a4933);
    this.add.rectangle(rightPanelLeft + rightPanelWidth / 2, 760, rightPanelWidth - 20, 220, 0x1a1510, 0.62).setStrokeStyle(1, 0x5a4933);
    this.topText = this.add.text(40, 18, "", {
      color: "#f5e9cf",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
      fontSize: "20px",
    });
    this.infoText = this.add.text(40, 690, "", {
      color: "#f5e9cf",
      fontFamily: "Noto Serif SC, Microsoft YaHei",
      fontSize: "15px",
      wordWrap: { width: 860 },
    });
    this.add.text(rightPanelLeft + 20, 505, "最近事件", {
      color: "#e8d9ba",
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
    });
    this.logText = this.add.text(rightPanelLeft + 20, 530, "", {
      color: "#d5c9b4",
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      lineSpacing: 4,
      wordWrap: { width: rightPanelWidth - 40 },
    });
    this.add.text(rightPanelLeft + 20, 655, "卡牌详情", {
      color: "#e8d9ba",
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
    });
    this.ruleText = this.add.text(rightPanelLeft + 20, 70, "", {
      color: "#ead9bd",
      fontFamily: "Microsoft YaHei",
      fontSize: "13px",
      lineSpacing: 3,
      wordWrap: { width: rightPanelWidth - 40 },
    });
    this.detailText = this.add.text(rightPanelLeft + 20, 680, "", {
      color: "#f3e7cf",
      fontFamily: "Microsoft YaHei",
      fontSize: "12px",
      lineSpacing: 3,
      wordWrap: { width: rightPanelWidth - 40 },
    });
    this.previewText = this.add.text(40, 620, "", {
      color: "#f3e7cf",
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
      lineSpacing: 3,
      wordWrap: { width: 860 },
    });

    this.addButton("出牌", rightPanelLeft + 20, 20, () => this.onPlay());
    this.addButton("弃牌", rightPanelLeft + 120, 20, () => this.onDiscard());
    this.addButton("施放符咒", rightPanelLeft + 225, 20, () => this.onCastCharm());
    this.addButton("立即存档", rightPanelLeft + 355, 20, () => {
      saveRun(session.run);
      pushLog("已写入本地存档");
      this.refresh();
    });

    this.refresh();
  }

  private addButton(label: string, x: number, y: number, onClick: () => void): void {
    const btn = this.add
      .text(x, y, label, {
        color: "#fef2da",
        backgroundColor: "#5e3f1d",
        fontSize: "14px",
        fontFamily: "Microsoft YaHei",
        padding: { left: 10, right: 10, top: 6, bottom: 6 },
      })
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", onClick);
  }

  private onPlay(): void {
    if (session.run.koiKoi.pendingChoice || this.resultPanel) return;
    if (session.run.frozenCardUid && this.selected.has(session.run.frozenCardUid)) {
      pushLog("冻结牌无法被选中打出");
      this.refresh();
      return;
    }
    const chosen = Array.from(this.selected);
    if (chosen.length === 0 || chosen.length > getMaxPlayCards(session.run)) {
      pushLog(`请选择 1~${getMaxPlayCards(session.run)} 张牌`);
      this.refresh();
      return;
    }
    const score = playCards(session.run, chosen);
    this.selected.clear();
    pushLog(`出牌得分 ${score.finalScore}，触发：${score.comboNames.join("、")}`);

    if (session.run.stageCleared) {
      const reward = settleStageAndPrepareShop(session.run);
      pushLog(`关卡结算 +${reward} 金币`);
      saveRun(session.run);
      this.showResultPanel(score.finalScore, reward);
      return;
    }
    this.refresh();
  }

  private onDiscard(): void {
    if (this.resultPanel) return;
    const chosen = Array.from(this.selected);
    if (chosen.length === 0 || chosen.length > 5) {
      pushLog("弃牌需选择 1~5 张");
      this.refresh();
      return;
    }
    discardCards(session.run, chosen);
    this.selected.clear();
    pushLog(`弃置 ${chosen.length} 张牌`);
    this.refresh();
  }

  private onCastCharm(): void {
    if (this.resultPanel) return;
    if (session.run.charms.length === 0) {
      pushLog("当前没有符咒");
      this.refresh();
      return;
    }
    const charmId = session.run.charms[0]!;
    const target = this.selected.values().next().value as string | undefined;
    const result = applyCharm(session.run, charmId, target);
    if (!result.startsWith("失败：")) session.run.charms.shift();
    pushLog(`[${charmById.get(charmId)?.name ?? charmId}] ${result}`);
    this.refresh();
  }

  private refresh(): void {
    if (this.focusedUid && !session.run.hand.includes(this.focusedUid)) this.focusedUid = undefined;
    this.renderTop();
    this.renderCards();
    this.renderInfo();
    this.renderLogs();
    this.renderPreview();
    this.renderKoiKoi();
  }

  private renderTop(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    this.topText?.setText(
      [
        `关卡 ${session.run.stageIndex + 1}/${stages.length} ${stage.chapter} ${stage.monthSet}`,
        `目标:${getCurrentStageTarget(session.run)}  当前:${session.run.scoreThisStage}  总分:${session.run.totalScore}`,
        `金币:${session.run.gold}  出牌:${session.run.playsLeft}  弃牌:${session.run.discardsLeft}  手牌:${session.run.hand.length}/${rules.maxHandSize}`,
        `牌库总数:${this.activeDeckCount()}  抽牌堆:${session.run.drawPile.length}  弃牌堆:${session.run.discardPile.length}${session.run.drawPile.length === 0 && session.run.discardPile.length > 0 ? "（下一抽会洗牌）" : ""}`,
      ].join("\n"),
    );
  }

  private renderCards(): void {
    for (const t of this.cardTexts) t.destroy();
    this.cardTexts = [];
    const max = getMaxPlayCards(session.run);
    const frozen = session.run.frozenCardUid;
    session.run.hand.forEach((uid, i) => {
      const card = session.run.cardsByUid[uid];
      const def = cardById.get(card.cardId);
      if (!def) return;
      const month = card.monthOverride ?? def.month;
      const rank = card.rankOverride ?? def.rank;
      const txt = this.add
        .text(40 + (i % 2) * 430, 140 + Math.floor(i / 2) * 108, "", {
          color: 等阶颜色(rank),
          backgroundColor: 等阶底色(rank),
          fontFamily: "Microsoft YaHei",
          fontSize: "13px",
          padding: { left: 8, right: 8, top: 8, bottom: 8 },
          wordWrap: { width: 408 },
        })
        .setInteractive({ useHandCursor: true });
      const selected = this.selected.has(uid);
      const blocked = uid === frozen;
      txt.setText(
        [
          `${selected ? "▶" : " "}【${花牌原名(def)}】${blocked ? "【冻结】" : ""}`,
          `妖怪：${def.name}`,
          `月份：${月份名[month]}  等阶：${等阶名(rank)}  价格：${cardPriceByRank(rank)}金币`,
          `词条：${card.traits.map((t) => 词条名(t)).join("、") || "无"}`,
        ].join("\n"),
      );
      txt.setStyle({
        backgroundColor: selected ? "#7b5b2c" : blocked ? "#34495d" : 等阶底色(rank),
      });
      txt.on("pointerup", () => {
        this.focusedUid = uid;
        if (blocked) {
          pushLog("该牌被冻结，下一手不可打");
          this.refresh();
          return;
        }
        if (this.selected.has(uid)) this.selected.delete(uid);
        else if (this.selected.size < max) this.selected.add(uid);
        else pushLog(`最多选 ${max} 张牌`);
        this.refresh();
      });
      this.cardTexts.push(txt);
    });
  }

  private renderInfo(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const relicNames = session.run.relics.map((id) => relicById.get(id)?.name ?? id);
    const charmNames = session.run.charms.map((id) => charmById.get(id)?.name ?? id);
    const combo速查 = combos.map((c) => `- ${c.name}（${c.baseMultText}）`);
    const parts = [
      `季节环境：${季节名(stage.season)}    关卡干扰：${stage.bossRuleText || "无"}`,
      `已拥有法宝：${relicNames.join("、") || "无"}`,
      `符咒库存：${charmNames.join("、") || "无"}`,
      `Koi-Koi：${session.run.koiKoi.continued ? "继续中" : "未继续"} ${session.run.koiKoi.success ? "成功" : session.run.koiKoi.failed ? "失败" : ""}`,
    ];
    this.infoText?.setText(parts.join("\n"));
    this.ruleText?.setText([
      "基础计分规则",
      基础计分说明[1],
      基础计分说明[2],
      "同手牌可触发多个组合并叠加。",
      "达标后可选 Koi-Koi，失败会导致金币减半。",
      "",
      ...等阶基础说明,
      "",
      "组合速查（基础倍率）",
      ...combo速查,
    ].join("\n"));
    this.detailText?.setText(this.focusedCardSummary());
  }

  private renderLogs(): void {
    const bounded = session.log.slice(0, 4).map((line) => trimLine(line, 46));
    this.logText?.setText(bounded.join("\n"));
  }

  private renderPreview(): void {
    if (!this.previewText) return;
    const selected = Array.from(this.selected);
    if (selected.length === 0) {
      this.previewText.setText("已选牌预估：未选择卡牌。");
      return;
    }
    const p = previewPlayScore(session.run, selected);
    this.previewText.setText(
      [
        `已选牌预估：${selected.length} 张`,
        `预计得分：${p.finalScore}（筹码${p.chipsFromCards + p.chipsFromCombos + p.chipsFromEffects} × 倍率${p.addedMult} × 乘区${p.multiplicative.toFixed(2)}）`,
        `预计触发组合：${p.comboNames.join("、")}`,
      ].join("\n"),
    );
  }

  private renderKoiKoi(): void {
    this.koiPanel?.destroy(true);
    this.koiPanel = undefined;
    if (!session.run.koiKoi.pendingChoice) return;

    const panel = this.add.container(640, 330);
    const bg = this.add.rectangle(0, 0, 520, 220, 0x180f09, 0.93).setStrokeStyle(2, 0xcba86a);
    const text = this.add
      .text(
        -230,
        -82,
        `已达关卡目标分数。\n要执行 Koi-Koi 吗？\n继续将获得永久成长机会，但失败会让本关金币收益减半。`,
        { color: "#fcefd6", fontFamily: "Microsoft YaHei", fontSize: "18px", wordWrap: { width: 460 } },
      );
    const endBtn = this.add
      .text(-160, 56, "结束并结算", {
        color: "#fef2d7",
        backgroundColor: "#5b4428",
        fontSize: "16px",
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      })
      .setInteractive({ useHandCursor: true });
    const contBtn = this.add
      .text(40, 56, "Koi-Koi 继续", {
        color: "#fef2d7",
        backgroundColor: "#824019",
        fontSize: "16px",
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      })
      .setInteractive({ useHandCursor: true });

    endBtn.on("pointerup", () => {
      handleKoiKoiChoice(session.run, "END");
      const reward = settleStageAndPrepareShop(session.run);
      pushLog(`选择结束，结算 +${reward} 金币`);
      saveRun(session.run);
      this.showResultPanel(0, reward);
    });
    contBtn.on("pointerup", () => {
      handleKoiKoiChoice(session.run, "CONTINUE");
      pushLog("选择继续：需在剩余回合再凑出一个组合");
      this.refresh();
    });

    panel.add([bg, text, endBtn, contBtn]);
    this.koiPanel = panel;
  }

  private showResultPanel(lastScore: number, reward: number): void {
    this.resultPanel?.destroy(true);
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const bg = this.add.rectangle(0, 0, 640, 320, 0x120d09, 0.94).setStrokeStyle(2, 0xd2ad73);
    const koiText = session.run.koiKoi.continued
      ? session.run.koiKoi.success
        ? "Koi-Koi 成功：获得成长奖励。"
        : session.run.koiKoi.failed
          ? "Koi-Koi 失败：本关金币收益减半。"
          : "Koi-Koi 进行中。"
      : "未执行 Koi-Koi。";
    const text = this.add.text(
      -280,
      -110,
      [
        "本关结算",
        `本手得分：${lastScore}`,
        `本关累计：${session.run.scoreThisStage}`,
        `金币奖励：+${reward}`,
        koiText,
      ].join("\n"),
      { color: "#f7e9cd", fontFamily: "Microsoft YaHei", fontSize: "24px", lineSpacing: 8, wordWrap: { width: 560 } },
    );
    const btn = this.add
      .text(0, 100, "前往阴阳屋", {
        color: "#fef2d8",
        backgroundColor: "#5f3f1d",
        fontFamily: "Microsoft YaHei",
        fontSize: "24px",
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", () => {
      panel.destroy(true);
      this.resultPanel = undefined;
      this.scene.start("shop");
    });
    panel.add([bg, text, btn]);
    this.resultPanel = panel;
  }

  private activeDeckCount(): number {
    return Object.values(session.run.cardsByUid).filter((card) => !session.run.removed.includes(card.uid)).length;
  }

  private focusedCardSummary(): string {
    if (!this.focusedUid) {
      return "卡牌详情：点击任意手牌可在此查看详细信息（基础值、强化值、词条、符咒记录）。";
    }
    const inst = session.run.cardsByUid[this.focusedUid];
    if (!inst) return "卡牌详情：当前选中牌已离开手牌。";
    const def = cardById.get(inst.cardId);
    if (!def) return "卡牌详情：缺少卡牌数据。";
    const month = inst.monthOverride ?? def.month;
    const rank = inst.rankOverride ?? def.rank;
    const chips = def.baseChips + inst.bonusChips;
    const mult = def.baseMult + inst.bonusMult;
    return [
      `卡牌详情`,
      `花牌原名：${花牌原名(def)}`,
      `妖怪名：${def.name}`,
      `月份：${月份名[month]}    等阶：${等阶名(rank)}`,
      `基础筹码：${def.baseChips}  强化后：${chips}`,
      `基础倍率：${def.baseMult}  强化后：${mult}`,
      `词条：${inst.traits.map((t) => 词条名(t)).join("、") || "无"}`,
      `已施加符咒：${inst.appliedCharmIds?.join("、") || "无"}`,
      `传闻：${def.lore}`,
    ].join("\n");
  }
}

function trimLine(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

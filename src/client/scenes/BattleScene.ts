import Phaser from "phaser";
import { cardById, cardPriceByRank, charmById, combos, relicById, rules, stages } from "../../content/data";
import {
  MAX_CHARM_SLOTS,
  applyCharm,
  discardCards,
  getCharmSlots,
  getCurrentStageTarget,
  getMaxPlayCards,
  getRelicSlots,
  handleKoiKoiChoice,
  playCards,
  previewPlayScore,
  removeCharmAt,
  settleStageAndPrepareShop,
} from "../../core/run";
import { pushLog, session } from "../session";
import { clearRunSave, saveRun } from "../../save/storage";
import {
  基础计分说明,
  关键牌提示,
  季节名,
  月份名,
  等阶名,
  等阶基础说明,
  等阶底色,
  等阶颜色,
  羁绊速查说明,
  花牌原名,
  词条名,
} from "../uiText";
import { 创建主题按钮, 墨金主题, 收束文本对象, 绘制场景底纹, 绘制描边面板, 限制多行 } from "../uiTheme";

type SidebarTab = "overview" | "combos" | "logs" | "detail";

export class BattleScene extends Phaser.Scene {
  private selected = new Set<string>();
  private cardTexts: Phaser.GameObjects.Text[] = [];
  private focusedUid?: string;
  private selectedCharmIndex = 0;
  private armedCharmIndex?: number;
  private activeSidebarTab: SidebarTab = "overview";
  private tabButtons: Phaser.GameObjects.Text[] = [];
  private charmSlotButtons: Phaser.GameObjects.Text[] = [];
  private topText?: Phaser.GameObjects.Text;
  private infoText?: Phaser.GameObjects.Text;
  private sidebarTitleText?: Phaser.GameObjects.Text;
  private sidebarBodyText?: Phaser.GameObjects.Text;
  private previewText?: Phaser.GameObjects.Text;
  private koiPanel?: Phaser.GameObjects.Container;
  private resultPanel?: Phaser.GameObjects.Container;

  constructor() {
    super("battle");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const rightPanelWidth = 620;
    const rightPanelLeft = w - rightPanelWidth - 30;

    绘制场景底纹(this, w, h);
    绘制描边面板(this, 24, 18, rightPanelLeft - 34, h - 36, { fill: 0x18120f, alpha: 0.94, radius: 26 });
    绘制描边面板(this, rightPanelLeft, 18, rightPanelWidth, h - 36, { fill: 0x15100d, alpha: 0.96, radius: 26 });
    绘制描边面板(this, rightPanelLeft + 10, 112, rightPanelWidth - 20, h - 174, { fill: 0x1b1511, alpha: 0.92, radius: 18 });

    this.topText = this.add.text(40, 18, "", {
      color: 墨金主题.文本主,
      fontFamily: "Noto Serif SC, Microsoft YaHei",
      fontSize: "20px",
    });
    this.infoText = this.add.text(40, 690, "", {
      color: 墨金主题.文本主,
      fontFamily: "Noto Serif SC, Microsoft YaHei",
      fontSize: "15px",
      wordWrap: { width: 860 },
    });
    this.sidebarTitleText = this.add.text(rightPanelLeft + 24, 178, "", {
      color: 墨金主题.金亮,
      fontFamily: "Noto Serif SC, Microsoft YaHei",
      fontSize: "24px",
    });
    this.sidebarBodyText = this.add.text(rightPanelLeft + 24, 222, "", {
      color: 墨金主题.文本主,
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
      lineSpacing: 5,
      wordWrap: { width: rightPanelWidth - 48 },
    });
    this.previewText = this.add.text(40, 620, "", {
      color: "#f3e7cf",
      fontFamily: "Microsoft YaHei",
      fontSize: "14px",
      lineSpacing: 3,
      wordWrap: { width: 860 },
    });

    this.addActionButton("出牌", rightPanelLeft + 20, 20, "red", () => this.onPlay());
    this.addActionButton("弃牌", rightPanelLeft + 114, 20, "brown", () => this.onDiscard());
    this.addActionButton("施放符咒", rightPanelLeft + 208, 20, "purple", () => this.onCastCharm());
    this.addActionButton("立即存档", rightPanelLeft + 338, 20, "green", () => {
      saveRun(session.run);
      pushLog("已写入本地存档");
      this.refresh();
    });

    this.refresh();
  }

  private addActionButton(
    label: string,
    x: number,
    y: number,
    variant: "brown" | "red" | "green" | "purple",
    onClick: () => void,
  ): void {
    创建主题按钮(this, x, y, label, onClick, variant);
  }

  private buildSidebarTabs(): void {
    for (const button of this.tabButtons) button.destroy();
    this.tabButtons = [];
    const rightPanelLeft = this.scale.width - 620 - 30;
    const tabs: Array<{ key: SidebarTab; label: string }> = [
      { key: "overview", label: "总览" },
      { key: "combos", label: "羁绊" },
      { key: "logs", label: "事件" },
      { key: "detail", label: "详情" },
    ];
    tabs.forEach((tab, index) => {
      const active = this.activeSidebarTab === tab.key;
      const button = 创建主题按钮(
        this,
        rightPanelLeft + 22 + index * 92,
        130,
        tab.label,
        () => {
          this.activeSidebarTab = tab.key;
          this.refresh();
        },
        active ? "red" : "brown",
      ).setStyle({
        fontSize: "14px",
        padding: { left: 14, right: 14, top: 7, bottom: 7 },
      });
      this.tabButtons.push(button);
    });
  }

  private buildCharmSlots(): void {
    for (const button of this.charmSlotButtons) button.destroy();
    this.charmSlotButtons = [];
    const rightPanelLeft = this.scale.width - 620 - 30;
    const slots = getCharmSlots(session.run);
    slots.forEach((charmId, index) => {
      const charm = charmId ? charmById.get(charmId) : undefined;
      const armed = this.armedCharmIndex === index;
      const button = 创建主题按钮(
        this,
        rightPanelLeft + 22 + (index % 2) * 286,
        76 + Math.floor(index / 2) * 34,
        charm ? `${armed ? "▶" : ""}符咒槽${index + 1}:${charm.name}` : `符咒槽${index + 1}: 空`,
        () => {
          if (!charmId) return;
          if (this.armedCharmIndex === index) {
            this.armedCharmIndex = undefined;
          } else {
            this.selectedCharmIndex = index;
            if (charmId === "C-12") {
              this.castCharmAt(index);
              return;
            }
            this.armedCharmIndex = index;
            this.activeSidebarTab = "overview";
            pushLog(`已选中符咒槽${index + 1}，请再点击目标牌`);
          }
          this.refresh();
        },
        charmId ? (armed ? "purple" : "brown") : "green",
      ).setStyle({
        fontSize: "13px",
        padding: { left: 10, right: 10, top: 7, bottom: 7 },
      });
      this.charmSlotButtons.push(button);
    });
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

    if (session.run.runLost) {
      clearRunSave();
      this.showTerminalPanel("败北", `第${session.run.stageIndex + 1}关挑战失败，本局结束。`);
      return;
    }

    if (session.run.stageCleared) {
      const reward = settleStageAndPrepareShop(session.run);
      pushLog(`关卡结算 +${reward} 金币`);
      saveRun(session.run);
      if (session.run.stageIndex >= stages.length - 1) {
        clearRunSave();
        this.showTerminalPanel("通关", `你已经通过终章，总金币结算 +${reward}。`);
        return;
      }
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
    const slotIndex =
      typeof this.armedCharmIndex === "number"
        ? this.armedCharmIndex
        : Phaser.Math.Clamp(this.selectedCharmIndex, 0, Math.max(0, session.run.charms.length - 1));
    this.castCharmAt(slotIndex, this.focusedUid ?? (this.selected.values().next().value as string | undefined));
  }

  private refresh(): void {
    if (this.focusedUid && !session.run.hand.includes(this.focusedUid)) this.focusedUid = undefined;
    if (session.run.charms.length === 0) {
      this.selectedCharmIndex = 0;
      this.armedCharmIndex = undefined;
    } else {
      this.selectedCharmIndex = Phaser.Math.Clamp(this.selectedCharmIndex, 0, session.run.charms.length - 1);
      if (typeof this.armedCharmIndex === "number" && this.armedCharmIndex >= session.run.charms.length) {
        this.armedCharmIndex = undefined;
      }
    }
    this.buildSidebarTabs();
    this.buildCharmSlots();
    this.renderTop();
    this.renderCards();
    this.renderInfo();
    this.renderSidebar();
    this.renderPreview();
    this.renderKoiKoi();
  }

  private renderTop(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    this.topText?.setText(
      限制多行(
        [
          `关卡 ${session.run.stageIndex + 1}/${stages.length} ${stage.chapter} ${stage.monthSet}`,
          `目标:${getCurrentStageTarget(session.run)}  当前:${session.run.scoreThisStage}  总分:${session.run.totalScore}`,
          `金币:${session.run.gold}  出牌:${session.run.playsLeft}  弃牌:${session.run.discardsLeft}  手牌:${session.run.hand.length}/${rules.maxHandSize}`,
          `牌库总数:${this.activeDeckCount()}  抽牌堆:${session.run.drawPile.length}  弃牌堆:${session.run.discardPile.length}${session.run.drawPile.length === 0 && session.run.discardPile.length > 0 ? "（下一抽会洗牌）" : ""}`,
        ].join("\n"),
        4,
        48,
      ),
    );
    this.topText?.setFixedSize(900, 90);
  }

  private renderCards(): void {
    for (const text of this.cardTexts) text.destroy();
    this.cardTexts = [];
    const max = getMaxPlayCards(session.run);
    const frozen = session.run.frozenCardUid;
    session.run.hand.forEach((uid, i) => {
      const card = session.run.cardsByUid[uid];
      const def = cardById.get(card.cardId);
      if (!def) return;
      const month = card.monthOverride ?? def.month;
      const rank = card.rankOverride ?? def.rank;
      const text = this.add
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
      text.setText(
        限制多行(
          [
            `${selected ? "▶" : " "}【${花牌原名(def)}】${blocked ? "【冻结】" : ""}`,
            `妖怪：${def.name}`,
            `月份：${月份名[month]}  等阶：${等阶名(rank)}  价格：${cardPriceByRank(rank)}金币`,
            `词条：${card.traits.map((t) => 词条名(t)).join("、") || "无"}`,
          ].join("\n"),
          4,
        ),
      );
      text.setFixedSize(408, 88);
      text.setStyle({ backgroundColor: selected ? "#8d6534" : blocked ? "#34495d" : 等阶底色(rank) });
      text.on("pointerup", () => {
        this.focusedUid = uid;
        if (typeof this.armedCharmIndex === "number") {
          this.castCharmAt(this.armedCharmIndex, uid);
          return;
        }
        this.activeSidebarTab = "detail";
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
      this.cardTexts.push(text);
    });
  }

  private renderInfo(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const relicNames = getRelicSlots(session.run).map((id, index) => `槽${index + 1}:${id ? relicById.get(id)?.name ?? id : "空"}`);
    const charmNames = getCharmSlots(session.run).map((id, index) =>
      `${this.armedCharmIndex === index ? "▶" : "  "}槽${index + 1}:${id ? charmById.get(id)?.name ?? id : "空"}`,
    );
    const parts = [
      `季节环境：${季节名(stage.season)}    关卡干扰：${stage.bossRuleText || "无"}`,
      `已拥有法宝：${relicNames.join("、") || "无"}`,
      `符咒库存：${charmNames.join("  ") || "无"}`,
      `${typeof this.armedCharmIndex === "number" ? `待施放符咒：槽${this.armedCharmIndex + 1}` : "待施放符咒：无"}`,
      `Koi-Koi：${session.run.koiKoi.continued ? "继续中" : "未继续"} ${session.run.koiKoi.success ? "成功" : session.run.koiKoi.failed ? "失败" : ""}`,
    ];
    收束文本对象(this.infoText!, 限制多行(parts.join("\n"), 5, 46), {
      width: 860,
      height: 118,
      maxLines: 5,
      maxCharsLastLine: 46,
      minFontSize: 12,
    });
  }

  private renderSidebar(): void {
    if (!this.sidebarTitleText || !this.sidebarBodyText) return;
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const relicSummary = getRelicSlots(session.run)
      .map((id, index) => {
        const relic = id ? relicById.get(id) : undefined;
        return `法宝槽${index + 1}\n${id ? `${relic?.name ?? id}\n${relic?.effectScript ?? ""}` : "空槽"}`;
      })
      .join("\n\n");
    const comboList = combos.map((c) => `- ${c.name}：${c.conditionText} / ${c.baseMultText}`);
    const charmSummary = getCharmSlots(session.run)
      .map((id, index) => {
        const charm = id ? charmById.get(id) : undefined;
        return `${this.armedCharmIndex === index ? "▶" : "  "}符咒槽${index + 1}\n${id ? `${charm?.name ?? id}\n${charm?.effectScript ?? ""}` : "空槽"}`;
      })
      .join("\n\n");

    let title = "";
    let body = "";
    let fontFamily = "Microsoft YaHei";
    const options = { width: 572, height: 640, maxLines: 28, maxCharsLastLine: 42, minFontSize: 11, lineSpacing: 5 };

    if (this.activeSidebarTab === "overview") {
      title = "符咒与总览";
      body = [
        `季节环境：${季节名(stage.season)}`,
        `关卡干扰：${stage.bossRuleText || "无"}`,
        "已拥有法宝",
        relicSummary,
        `当前金币：${session.run.gold}`,
        `当前总分：${session.run.totalScore}`,
        "",
        `符咒库存（${session.run.charms.length}/${MAX_CHARM_SLOTS}）`,
        charmSummary,
        typeof this.armedCharmIndex === "number" ? `\n当前待施放：符咒槽${this.armedCharmIndex + 1}` : "\n当前待施放：无",
      ].join("\n");
    } else if (this.activeSidebarTab === "combos") {
      title = "羁绊与路线";
      body = [
        "基础计分规则",
        基础计分说明[1],
        基础计分说明[2],
        "每次出牌只取一组最高收益组合。",
        "不在该组合内的牌不会参与本次计分。",
        "达标后可选 Koi-Koi，失败会导致金币减半。",
        "",
        ...等阶基础说明,
        "",
        ...羁绊速查说明,
        "",
        ...关键牌提示,
        "",
        "组合明细（条件 / 基础倍率）",
        ...comboList,
      ].join("\n");
    } else if (this.activeSidebarTab === "logs") {
      title = "最近事件";
      body = session.log.length > 0 ? session.log.slice(0, 18).join("\n") : "当前还没有事件。";
      fontFamily = "Consolas, Microsoft YaHei";
    } else {
      title = "卡牌详情";
      body = this.focusedCardSummary();
    }

    this.sidebarTitleText.setText(title);
    this.sidebarBodyText.setFontFamily(fontFamily);
    收束文本对象(this.sidebarBodyText, 限制多行(body, options.maxLines, options.maxCharsLastLine), options);
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
      限制多行(
        [
          `已选牌预估：${selected.length} 张`,
          `预计得分：${p.finalScore}（筹码${p.chipsFromCards + p.chipsFromCombos + p.chipsFromEffects} × 倍率${p.addedMult} × 乘区${p.multiplicative.toFixed(2)}）`,
          `预计取高组合：${p.comboNames.join("、")}；参与牌数：${p.usedCardUids.length}`,
        ].join("\n"),
        3,
        48,
      ),
    );
    this.previewText.setFixedSize(860, 70);
  }

  private renderKoiKoi(): void {
    this.koiPanel?.destroy(true);
    this.koiPanel = undefined;
    if (!session.run.koiKoi.pendingChoice) return;

    const panel = this.add.container(640, 330);
    const bg = this.add.rectangle(0, 0, 520, 220, 0x180f09, 0.93).setStrokeStyle(2, 0xcba86a);
    const text = this.add.text(
      -230,
      -82,
      "已达关卡目标分数。\n要执行 Koi-Koi 吗？\n继续将获得永久成长机会，但失败会让本关金币收益减半。",
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
      if (session.run.stageIndex >= stages.length - 1) {
        clearRunSave();
        this.showTerminalPanel("通关", `你已经通过终章，总金币结算 +${reward}。`);
      } else {
        saveRun(session.run);
        this.showResultPanel(0, reward);
      }
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
      ["本关结算", `本手得分：${lastScore}`, `本关累计：${session.run.scoreThisStage}`, `金币奖励：+${reward}`, koiText].join("\n"),
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

  private showTerminalPanel(title: string, body: string): void {
    this.resultPanel?.destroy(true);
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const bg = this.add.rectangle(0, 0, 700, 340, 0x120d09, 0.95).setStrokeStyle(2, 0xd2ad73);
    const text = this.add.text(
      -300,
      -115,
      [title, body, `到达关卡：第${session.run.stageIndex + 1}关`, `总分：${session.run.totalScore}`, `最终金币：${session.run.gold}`].join("\n"),
      { color: "#f7e9cd", fontFamily: "Microsoft YaHei", fontSize: "24px", lineSpacing: 8, wordWrap: { width: 600 } },
    );
    const btn = this.add
      .text(0, 105, "返回主界面", {
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
      this.scene.start("boot");
    });
    panel.add([bg, text, btn]);
    this.resultPanel = panel;
  }

  private activeDeckCount(): number {
    return Object.values(session.run.cardsByUid).filter((card) => !session.run.removed.includes(card.uid)).length;
  }

  private focusedCardSummary(): string {
    if (!this.focusedUid) {
      return "点击任意手牌后，这里会显示该牌的基础值、强化值、词条和符咒记录。";
    }
    const inst = session.run.cardsByUid[this.focusedUid];
    if (!inst) return "当前选中牌已离开手牌。";
    const def = cardById.get(inst.cardId);
    if (!def) return "缺少卡牌数据。";
    const month = inst.monthOverride ?? def.month;
    const rank = inst.rankOverride ?? def.rank;
    const chips = def.baseChips + inst.bonusChips;
    const mult = def.baseMult + inst.bonusMult;
    return [
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

  private castCharmAt(slotIndex: number, targetUid?: string): void {
    const charmId = session.run.charms[slotIndex];
    if (!charmId) {
      this.armedCharmIndex = undefined;
      this.refresh();
      return;
    }
    const result = applyCharm(session.run, charmId, targetUid);
    if (!result.startsWith("失败：")) {
      removeCharmAt(session.run, slotIndex);
      this.armedCharmIndex = undefined;
      this.selectedCharmIndex = Math.max(0, Math.min(slotIndex, session.run.charms.length - 1));
      this.activeSidebarTab = "overview";
    }
    pushLog(`[${charmById.get(charmId)?.name ?? charmId}] ${result}`);
    this.refresh();
  }
}

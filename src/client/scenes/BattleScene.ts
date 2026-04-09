import Phaser from "phaser";
import { cardById, charmById, combos, relicById, rules, stages } from "../../content/data";
import {
  MAX_CHARM_SLOTS,
  MAX_RELIC_SLOTS,
  applyCharm,
  getCharmSlots,
  getCurrentStageTarget,
  getRelicSlots,
  handleKoiKoiChoice,
  playOneCard,
  removeCharmAt,
  settleStageAndPrepareShop,
  sellRelic,
} from "../../core/run";
import { evaluatePlay } from "../../core/scoring";
import { stageRuleContext } from "../../core/rules";
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
  formatTrait,
} from "../uiText";
import {
  创建悬浮提示,
  创建主题按钮,
  墨金主题,
  收束文本对象,
  清晰正文字体,
  清晰标题字体,
  绘制场景底纹,
  绘制描边面板,
  限制多行,
} from "../uiTheme";

type SidebarTab = "overview" | "combos" | "logs" | "detail";

export class BattleScene extends Phaser.Scene {
  private handCards: Phaser.GameObjects.Container[] = [];
  private fieldCards: Phaser.GameObjects.Container[] = [];
  private capturedCards: Phaser.GameObjects.Container[] = [];
  private focusedUid?: string;
  private selectedCharmIndex = 0;
  private armedCharmIndex?: number;
  private activeSidebarTab: SidebarTab = "overview";
  private tabButtons: Phaser.GameObjects.Text[] = [];
  private charmSlotButtons: Phaser.GameObjects.Text[] = [];
  private tooltip?: ReturnType<typeof 创建悬浮提示>;
  private topText?: Phaser.GameObjects.Text;
  private topRelicIcons: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text> = [];
  private infoText?: Phaser.GameObjects.Text;
  private fieldLabel?: Phaser.GameObjects.Text;
  private capturedLabel?: Phaser.GameObjects.Text;
  private handLabel?: Phaser.GameObjects.Text;
  private sidebarTitleText?: Phaser.GameObjects.Text;
  private sidebarBodyText?: Phaser.GameObjects.Text;
  private koiPanel?: Phaser.GameObjects.Container;
  private resultPanel?: Phaser.GameObjects.Container;

  constructor() {
    super("battle");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const rightPanelWidth = 600;
    const rightPanelLeft = w - rightPanelWidth - 24;
    this.tooltip = 创建悬浮提示(this);

    绘制场景底纹(this, w, h);
    // Left play area
    绘制描边面板(this, 16, 14, rightPanelLeft - 26, h - 28, { fill: 0x18120f, alpha: 0.94, radius: 22 });
    // Right sidebar
    绘制描边面板(this, rightPanelLeft, 14, rightPanelWidth, h - 28, { fill: 0x15100d, alpha: 0.96, radius: 22 });
    绘制描边面板(this, rightPanelLeft + 8, 138, rightPanelWidth - 16, h - 196, { fill: 0x1b1511, alpha: 0.92, radius: 16 });

    this.topText = this.add.text(32, 14, "", {
      color: 墨金主题.文本主,
      fontFamily: 清晰标题字体,
      fontSize: "16px",
      lineSpacing: 4,
    });

    // Zone labels
    this.fieldLabel = this.add.text(32, 110, "场·公开牌（待配对）", {
      color: 墨金主题.金亮,
      fontFamily: 清晰标题字体,
      fontSize: "14px",
    });
    this.capturedLabel = this.add.text(32, 420, "捕获·收获区（成役牌库）", {
      color: "#9dcf88",
      fontFamily: 清晰标题字体,
      fontSize: "14px",
    });
    this.handLabel = this.add.text(32, 695, "手牌·点击直接配对", {
      color: 墨金主题.文本次,
      fontFamily: 清晰标题字体,
      fontSize: "14px",
    });

    this.infoText = this.add.text(32, 885, "", {
      color: 墨金主题.文本主,
      fontFamily: 清晰正文字体,
      fontSize: "14px",
      lineSpacing: 4,
      wordWrap: { width: rightPanelLeft - 50 },
    });

    this.sidebarTitleText = this.add.text(rightPanelLeft + 20, 196, "", {
      color: 墨金主题.金亮,
      fontFamily: 清晰标题字体,
      fontSize: "22px",
    });
    this.sidebarBodyText = this.add.text(rightPanelLeft + 20, 242, "", {
      color: 墨金主题.文本主,
      fontFamily: 清晰正文字体,
      fontSize: "14px",
      lineSpacing: 6,
      wordWrap: { width: rightPanelWidth - 40 },
    });

    this.addActionButton("立即存档", rightPanelLeft + 20, 20, "green", () => {
      saveRun(session.run);
      pushLog("已写入本地存档");
      this.refresh();
    });

    this.refresh();
  }

  private addActionButton(label: string, x: number, y: number, variant: "brown" | "red" | "green" | "purple", onClick: () => void): void {
    创建主题按钮(this, x, y, label, onClick, variant);
  }

  private buildSidebarTabs(): void {
    for (const button of this.tabButtons) button.destroy();
    this.tabButtons = [];
    const rightPanelLeft = this.scale.width - 600 - 24;
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
        rightPanelLeft + 20 + index * 88,
        108,
        tab.label,
        () => {
          this.activeSidebarTab = tab.key;
          this.refresh();
        },
        active ? "red" : "brown",
      ).setStyle({ fontSize: "14px", padding: { left: 14, right: 14, top: 6, bottom: 6 } });
      this.tabButtons.push(button);
    });
  }

  private buildCharmSlots(): void {
    for (const button of this.charmSlotButtons) button.destroy();
    this.charmSlotButtons = [];
    const rightPanelLeft = this.scale.width - 600 - 24;
    const slots = getCharmSlots(session.run);
    slots.forEach((charmId, index) => {
      const charm = charmId ? charmById.get(charmId) : undefined;
      const armed = this.armedCharmIndex === index;
      const button = 创建主题按钮(
        this,
        rightPanelLeft + 20 + index * 70,
        66,
        charm ? `咒${index + 1}` : "空",
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
      ).setStyle({ fontSize: "14px", padding: { left: 10, right: 10, top: 8, bottom: 8 } });
      this.tooltip?.attach(
        button,
        charmId
          ? [`符咒槽${index + 1}`, charm?.name ?? charmId, charm?.effectScript ?? "", armed ? "当前待施放" : "点击后再选目标"]
          : [`符咒槽${index + 1}`, "空槽"],
      );
      this.charmSlotButtons.push(button);
    });
  }

  private refresh(): void {
    if (this.focusedUid && !session.run.hand.includes(this.focusedUid)) this.focusedUid = undefined;
    if (session.run.charms.length === 0) {
      this.selectedCharmIndex = 0;
      this.armedCharmIndex = undefined;
    }
    this.buildSidebarTabs();
    this.buildCharmSlots();
    this.renderTop();
    this.renderTopRelics();
    this.renderFieldCards();
    this.renderCapturedCards();
    this.renderHandCards();
    this.renderInfo();
    this.renderSidebar();
    this.renderKoiKoi();
  }

  private renderTop(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const koiMul = session.run.koiKoiMultiplier > 1 ? `  【KoiKoi×${session.run.koiKoiMultiplier}】` : "";
    this.topText?.setText(
      限制多行(
        [
          `关卡 ${session.run.stageIndex + 1}/${stages.length}  ${stage.chapter}  ${stage.monthSet}${koiMul}`,
          `目标:${getCurrentStageTarget(session.run)}  金币:${session.run.gold}  剩余出牌:${session.run.playsLeft}/${8}  弃牌:[暂无用处]`,
          `牌库:${this.activeDeckCount()}  抽牌堆:${session.run.drawPile.length}  场上:${session.run.fieldCards.length}  已捕获:${session.run.capturedCards.length}`,
          stage.boss ? `Boss【${stage.boss}】${stage.bossRuleText}` : `关卡干扰：${stage.bossRuleText || "无"}`,
        ].join("\n"),
        4,
        60,
      ),
    );
  }

  private renderTopRelics(): void {
    for (const r of this.topRelicIcons) r.destroy();
    this.topRelicIcons = [];
    const rightPanelLeft = this.scale.width - 600 - 24;
    const startX = rightPanelLeft - 220; // Float right side of the top bar
    const slots = getRelicSlots(session.run);
    
    // Label
    const lbl = this.add.text(startX - 90, 20, "已装备法宝：", { color: 墨金主题.文本淡, fontSize: "12px", fontFamily: 清晰正文字体 });
    this.topRelicIcons.push(lbl);

    slots.forEach((relicId, index) => {
      const relic = relicId ? relicById.get(relicId) : undefined;
      const x = startX + index * 42;
      const bg = this.add.image(x, 30, "button_bg").setDisplaySize(38, 38).setInteractive({ useHandCursor: relicId !== undefined });
      const text = this.add.text(x, 30, relicId ? ` ${index + 1}` : "空", { fontSize: "14px", fontFamily: 清晰正文字体 }).setOrigin(0.5);
      
      this.tooltip?.attach(bg, relic ? [relic.name, relic.effectScript] : ["空法宝槽位"]);
      if (relicId) {
        bg.on("pointerup", () => {
          sellRelic(session.run, relicId, index);
          pushLog(`战斗中快速出售了法宝 ${relic?.name ?? relicId}`);
          this.refresh();
        });
      }
      this.topRelicIcons.push(bg, text);
    });
  }

  private createCardContainer(x: number, y: number, uid: string | undefined, def: any, inst: any, interactable: boolean = false): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const month = inst?.monthOverride ?? def?.month ?? 1;
    const rank = inst?.rankOverride ?? def?.rank ?? "KASU";
    
    // Render the new card_front image background
    const bg = this.add.image(0, 0, "card_front").setDisplaySize(90, 135).setOrigin(0);
    // Tint it based on rank
    const colorStr = 等阶底色(rank);
    let tintColor = 0xffffff;
    if (colorStr.startsWith('#')) tintColor = parseInt(colorStr.replace('#', '0x'));
    bg.setTint(tintColor);

    const txtColor = colorStr === "#3f201d" || colorStr === "#3f251c" ? 墨金主题.金亮 : 等阶颜色(rank);
    let textContent = def ? `【${month}月】\n${def.name}` : `Boss\n夺走`;
    
    const textBg = this.add.rectangle(45, 20, 90, 40, 0x000000, 0.7);
    const text = this.add.text(45, 20, textContent, {
      color: txtColor,
      fontFamily: 清晰正文字体,
      fontSize: "13px",
      align: "center",
      lineSpacing: 2
    }).setOrigin(0.5);

    container.add([bg, textBg, text]);

    if (inst && inst.traits.length > 0) {
      const traitText = `[${inst.traits.map((t: any) => formatTrait(t)).join(",")}]`;
      const tb = this.add.rectangle(45, 120, 90, 20, 0x000000, 0.6);
      const tt = this.add.text(45, 120, traitText, { color: "#eebb77", fontSize: "11px", fontFamily: 清晰正文字体 }).setOrigin(0.5);
      container.add([tb, tt]);
    }

    if (interactable) {
      container.setSize(90, 135);
      const hitArea = new Phaser.Geom.Rectangle(45, 67.5, 90, 135);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    }

    return container;
  }

  private renderFieldCards(): void {
    for (const t of this.fieldCards) t.destroy();
    this.fieldCards = [];
    session.run.fieldCards.forEach((uid, i) => {
      const card = session.run.cardsByUid[uid];
      const def = card ? cardById.get(card.cardId) : undefined;
      const col = i % 8;
      const row = Math.floor(i / 8);
      const c = this.createCardContainer(64 + col * 100, 142 + row * 145, uid, def, card, false);
      this.fieldCards.push(c);
    });

    if (session.run.bossCollected.length > 0) {
      const msg = `⚠️ Boss 夺走了 ${session.run.bossCollected.length} 张牌`;
      const text = this.add.text(32, 142 + 2 * 145, msg, { color: "#e07070", fontFamily: 清晰标题字体, fontSize: "14px" });
      const c = this.add.container(0, 0, [text]);
      this.fieldCards.push(c);
    }
  }

  private updateCapturedLabel(simulatedUids?: string[]): void {
    if (!this.capturedLabel) return;
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const score = evaluatePlay({
      run: session.run,
      selectedUids: simulatedUids ?? session.run.capturedCards,
      stageRuleCtx: stageRuleContext(stage),
    });
    const currentCombosStr = score.comboNames.filter(n => n !== "乱舞 (散牌)").join("、");

    if (simulatedUids) {
      const oldScore = session.run.scoreThisStage || 0;
      const diff = score.finalScore - oldScore;
      const comboStr = currentCombosStr.length > 0 ? `（预计役：${currentCombosStr}）` : "";
      const diffStr = diff > 0 ? ` [预测: +${diff}文]` : " [预测未得分]";
      this.capturedLabel.setText(`★战利品区${comboStr}${diffStr}`);
      if (diff > 0) this.capturedLabel.setColor("#eebb77");
    } else {
      const capturedTitle = currentCombosStr.length > 0
         ? `★战利品区（已构筑：${currentCombosStr}）`
         : "捕获·收获区（成役牌库）";
      this.capturedLabel.setText(capturedTitle);
      this.capturedLabel.setColor(currentCombosStr.length > 0 ? "#eeb255" : "#9dcf88");
    }
  }

  private renderCapturedCards(): void {
    for (const t of this.capturedCards) t.destroy();
    this.capturedCards = [];

    this.updateCapturedLabel();

    session.run.capturedCards.forEach((uid, i) => {
      const card = session.run.cardsByUid[uid];
      const def = card ? cardById.get(card.cardId) : undefined;
      const col = i % 14;
      const row = Math.floor(i / 14);
      const c = this.createCardContainer(64 + col * 55, 460 + row * 38, uid, def, card, false);
      c.setScale(0.65);
      c.setDepth(i);
      const checkBg = this.add.rectangle(75, 15, 18, 18, 0x1a3020).setOrigin(0.5);
      const checkMark = this.add.text(75, 15, "✓", { color: "#95df88", fontSize: "12px" }).setOrigin(0.5);
      c.add([checkBg, checkMark]);
      this.capturedCards.push(c);
    });
  }

  private renderHandCards(): void {
    for (const t of this.handCards) t.destroy();
    this.handCards = [];
    const frozen = session.run.frozenCardUid;

    session.run.hand.forEach((uid, i) => {
      const card = session.run.cardsByUid[uid];
      const def = card ? cardById.get(card.cardId) : undefined;
      const col = i % 6;
      const row = Math.floor(i / 6);
      const blocked = uid === frozen || session.run.koiKoi.pendingChoice;

      const c = this.createCardContainer(64 + i * 85, 740, uid, def, card, !blocked);
      c.setDepth(i);
      const bg = c.getAt(0) as Phaser.GameObjects.Image;
      if (blocked) {
        bg.setTint(0x444444);
        c.add(this.add.text(75, 15, "🔒", { fontSize: "12px" }).setOrigin(0.5));
      }

      const hasMatch = session.run.fieldCards.some(fUid => {
        const fi = session.run.cardsByUid[fUid];
        const fd = fi ? cardById.get(fi.cardId) : undefined;
        return (fi?.monthOverride ?? fd?.month) === (card?.monthOverride ?? def?.month);
      });
      if (hasMatch) {
        const starBg = this.add.rectangle(75, 15, 18, 18, 0xa87d29).setOrigin(0.5);
        const star = this.add.text(75, 15, "✦", { color: "#fff", fontSize: "12px" }).setOrigin(0.5);
        c.add([starBg, star]);
      }

      const colorStr = 等阶底色(card?.rankOverride ?? def?.rank ?? "KASU");
      let tintColor = 0xffffff;
      if (colorStr.startsWith('#')) tintColor = parseInt(colorStr.replace('#', '0x'));

      if (!blocked) {
        c.on("pointerover", () => {
          c.y -= 15;
          bg.setTint(0x5a3a18);
          let previewMatchUid: string | undefined;

          // Hover Preview matching fields
          session.run.fieldCards.forEach((fUid, idx) => {
            const fi = session.run.cardsByUid[fUid];
            const fd = fi ? cardById.get(fi.cardId) : undefined;
            if ((fi?.monthOverride ?? fd?.month) === (card?.monthOverride ?? def?.month)) {
                const fCardContainer = this.fieldCards[idx];
                if (fCardContainer) {
                   const fBg = fCardContainer.getAt(0) as Phaser.GameObjects.Image;
                   fBg.setTint(0x356e42); // Highlight green/emerald
                }
                if (!previewMatchUid) previewMatchUid = fUid;
            }
          });

          if (previewMatchUid) {
            this.updateCapturedLabel([...session.run.capturedCards, uid, previewMatchUid]);
          }
        });

        c.on("pointerout", () => {
          c.y += 15;
          bg.setTint(tintColor);
          // Remove Preview
          session.run.fieldCards.forEach((fUid, idx) => {
            const fCardContainer = this.fieldCards[idx];
            if (fCardContainer) {
                const fi = session.run.cardsByUid[fUid];
                const fd = fi ? cardById.get(fi.cardId) : undefined;
                const r = fi?.rankOverride ?? fd?.rank ?? "KASU";
                const cStr = 等阶底色(r);
                (fCardContainer.getAt(0) as Phaser.GameObjects.Image).setTint(parseInt(cStr.replace('#', '0x')));
            }
          });
          this.updateCapturedLabel();
        });

        c.on("pointerup", () => {
          if (session.run.koiKoi.pendingChoice || this.resultPanel) return;
          this.focusedUid = uid;
          if (typeof this.armedCharmIndex === "number") {
            this.castCharmAt(this.armedCharmIndex, uid);
            return;
          }
          this.onPlayCard(uid);
        });
      }

      this.handCards.push(c);
    });
  }

  private onPlayCard(handUid: string): void {
    if (session.run.playsLeft <= 0) return;
    const result = playOneCard(session.run, handUid);
    const inst = session.run.cardsByUid[handUid];
    const def = inst ? cardById.get(inst.cardId) : undefined;
    const cardDisplayName = def ? `${花牌原名(def)}` : handUid;

    if (result.handMatchUid) {
      const fi = session.run.cardsByUid[result.handMatchUid];
      const fd = fi ? cardById.get(fi.cardId) : undefined;
      pushLog(`✓ 【${cardDisplayName}】配对了场上的【${fd ? 花牌原名(fd) : result.handMatchUid}】`);
    } else {
      pushLog(`打出【${cardDisplayName}】落场`);
    }

    if (result.newComboNames.length > 0) pushLog(`★ 新役：${result.newComboNames.join("、")}`);
    
    if (result.stageCleared) {
      const reward = settleStageAndPrepareShop(session.run);
      saveRun(session.run);
      this.showResultPanel(result.scoreBreakdown?.finalScore ?? 0, reward);
      return;
    }
    if (result.runLost) {
      clearRunSave();
      this.showTerminalPanel("败北", `挑战失败，本局结束。`);
      return;
    }
    this.refresh();
  }

  private renderInfo(): void {
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    const relicNames = getRelicSlots(session.run).map((id, i) => `槽${i + 1}:${id ? relicById.get(id)?.name : "空"}`);
    const charmNames = getCharmSlots(session.run).map((id, i) => `${this.armedCharmIndex === i ? "▶" : ""}槽${i + 1}:${id ? charmById.get(id)?.name : "空"}`);
    const parts = [
      `季节：${季节名(stage.season)}    持有法宝：${relicNames.join("、")}（可点顶部图标出售）`,
      `符咒：${charmNames.join("  ")}${typeof this.armedCharmIndex === "number" ? `  【待施放:槽${this.armedCharmIndex + 1}】` : ""}`,
      `点击手牌即可出牌。相同月份将自动配对并进入收获区。成役时可触发Koi-Koi加倍评分！`,
    ];
    this.infoText?.setText(限制多行(parts.join("\n"), 4, 60));
  }

  private renderSidebar(): void {
    if (!this.sidebarTitleText || !this.sidebarBodyText) return;
    const stage = stages[Math.min(session.run.stageIndex, stages.length - 1)];
    
    if (this.activeSidebarTab === "overview") {
      this.sidebarTitleText.setText("战场总览");

      let koiKoiStatus = `金币：${session.run.gold}   倍率：×${session.run.koiKoiMultiplier}`;
      if (session.run.koiKoiMultiplier > 1) {
         koiKoiStatus += `\n★因已开始 Koi-Koi，须达成新役才能加算！\n已锁定役：${session.run.koiKoi.baselineCombos.join("、") || "无"}\n(若最终无新役结算将受惩罚)`;
      }

      this.sidebarBodyText.setText([
        `季节环境：${季节名(stage.season)}`,
        `关卡干扰：${stage.bossRuleText || "无"}`,
        koiKoiStatus,
        `已捕获：${session.run.capturedCards.length}张  场上剩余：${session.run.fieldCards.length}张`,
        `Boss抢走：${session.run.bossCollected.length}张`,
        `\n法宝插槽顶部直接展示并支持出售`
      ].join("\n"));
      this.sidebarBodyText.setFontFamily(清晰正文字体);
    } else if (this.activeSidebarTab === "combos") {
      this.sidebarTitleText.setText("流派与役");
      const comboList = combos.map(c => `- ${c.name}：${c.conditionText} / ${c.baseMultText}`).join("\n");
      this.sidebarBodyText.setText("【计分逻辑】\n" + 基础计分说明[2] + "\n\n【常见役】\n" + comboList);
      this.sidebarBodyText.setFontFamily(清晰正文字体);
    } else if (this.activeSidebarTab === "logs") {
      this.sidebarTitleText.setText("最近事件");
      this.sidebarBodyText.setText(session.log.length > 0 ? session.log.slice(0, 22).join("\n") : "暂无事件");
      this.sidebarBodyText.setFontFamily(`Consolas, ${清晰正文字体}`);
    } else {
      this.sidebarTitleText.setText("选中牌详情");
      this.sidebarBodyText.setText(this.focusedCardSummary());
      this.sidebarBodyText.setFontFamily(清晰正文字体);
    }
  }

  private renderKoiKoi(): void {
    this.koiPanel?.destroy(true);
    this.koiPanel = undefined;
    if (!session.run.koiKoi.pendingChoice) return;

    const panel = this.add.container(this.scale.width / 2, 360);
    const bg = this.add.image(0, 0, "card_back").setDisplaySize(600, 300).setAlpha(0.95);
    const border = this.add.rectangle(0, 0, 600, 300).setStrokeStyle(4, 0xcba86a);
    
    const mulNext = session.run.koiKoiMultiplier * 2;
    const text = this.add.text(-260, -110, [
      `★ 触发新役：「${session.run.koiKoi.triggerComboName}」！`,
      `当前 Koi-Koi 倍率：×${session.run.koiKoiMultiplier}`,
      ``,
      `选择「结束结算」 → 锁定当前奖励并通关`,
      `选择「继续 Koi-Koi」 → 倍率预升至 ×${mulNext}，贪心凑新役`,
      `（警告：若翻车未凑成任何新役，将面临惩罚）`
    ].join("\n"), { color: "#fcefd6", fontFamily: "Microsoft YaHei", fontSize: "17px", wordWrap: { width: 520 }, lineSpacing: 8 });

    const endBtn = this.add.text(-150, 80, "结束结算", { color: "#fef2d7", backgroundColor: "#5b4428", fontSize: "20px", padding: { left: 24, right: 24, top: 12, bottom: 12 } }).setInteractive();
    const contBtn = this.add.text(50, 80, `继续 Koi-Koi ×${mulNext}`, { color: "#fef2d7", backgroundColor: "#824019", fontSize: "20px", padding: { left: 24, right: 24, top: 12, bottom: 12 } }).setInteractive();

    endBtn.on("pointerup", () => {
      const score = handleKoiKoiChoice(session.run, "END");
      const reward = settleStageAndPrepareShop(session.run);
      saveRun(session.run);
      this.showResultPanel(score.finalScore, reward);
    });
    contBtn.on("pointerup", () => {
      handleKoiKoiChoice(session.run, "CONTINUE");
      this.refresh();
    });

    panel.add([bg, border, text, endBtn, contBtn]);
    this.koiPanel = panel;
  }

  private showResultPanel(lastScore: number, reward: number): void {
    this.resultPanel?.destroy(true);
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const bg = this.add.rectangle(0, 0, 640, 340, 0x120d09, 0.94).setStrokeStyle(2, 0xd2ad73);
    const koiText = session.run.koiKoi.continued
      ? session.run.koiKoi.success ? `Koi-Koi 成功！最终倍率 ×${session.run.koiKoiMultiplier}` : "Koi-Koi 失败：金币惩罚。"
      : "安全着陆。";
    
    panel.add([bg,
      this.add.text(-290, -120, `打分：${lastScore}\n收益：+${reward}\n${koiText}`, { color: "#f7e9cd", fontSize: "28px", lineSpacing: 14 }),
      创建主题按钮(this, 180, 100, "前往阴阳屋", () => { panel.destroy(true); this.resultPanel = undefined; this.scene.start("shop"); }, "red")
    ]);
    this.resultPanel = panel;
  }

  private showTerminalPanel(title: string, body: string): void {
    this.resultPanel?.destroy(true);
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const bg = this.add.rectangle(0, 0, 700, 340, 0x120d09, 0.95).setStrokeStyle(2, 0xd2ad73);
    panel.add([bg,
      this.add.text(-300, -115, `${title}\n${body}\n最终金币：${session.run.gold}`, { color: "#f7e9cd", fontSize: "24px", lineSpacing: 8 }),
      创建主题按钮(this, 200, 100, "返回主界面", () => { panel.destroy(true); this.scene.start("boot"); }, "red")
    ]);
    this.resultPanel = panel;
  }

  private activeDeckCount(): number {
    return Object.values(session.run.cardsByUid).filter((card) => !session.run.removed.includes(card.uid)).length;
  }

  private focusedCardSummary(): string {
    if (!this.focusedUid) return "选牌可查看详情。法宝可在顶部直接点击出售。";
    const inst = session.run.cardsByUid[this.focusedUid];
    const def = inst ? cardById.get(inst.cardId) : undefined;
    return def ? `${花牌原名(def)}\n月份:${月份名[inst.monthOverride ?? def.month]}\n等级:${等阶名(inst.rankOverride ?? def.rank)}\n传闻:${def.lore}` : "未知";
  }

  private castCharmAt(slotIndex: number, targetUid?: string): void {
    const charmId = session.run.charms[slotIndex];
    if (!charmId) { this.armedCharmIndex = undefined; this.refresh(); return; }
    const result = applyCharm(session.run, charmId, targetUid);
    if (!result.startsWith("失败：")) {
      removeCharmAt(session.run, slotIndex);
      this.armedCharmIndex = undefined;
      this.activeSidebarTab = "overview";
    }
    pushLog(`[咒] ${result}`);
    this.refresh();
  }
}

Original prompt: 我在这个文件夹里放了一个策划案，请帮我看一下如何实现成游戏。 （注意，这个excel里有多个tab）

2026-04-02
- Initialized implementation in Web + Phaser + TypeScript.
- Plan scope: data-driven core, battle loop, shop, stage progression, save.
- TODO: scaffold project files, parse Excel tabs to JSON content, implement core engine and UI scenes, run tests and build.

2026-04-02 (implementation complete)
- Created full web game scaffold with Phaser + TypeScript + Vite.
- Added Excel exporter script: scripts/export_content.py to transform multi-tab design doc into JSON content.
- Added generated data: cards/combos/relics/charms/stages/rules/flow in src/content/generated.
- Implemented core modules: RNG, combo evaluation, stage/boss rule modifiers, scoring engine, run state machine, shop generation.
- Implemented battle scene with card selection, play/discard, Koi-Koi modal, charm casting, logs, save action.
- Implemented shop scene with recruit/relic/charm purchase, relic sell, proceed-next-stage.
- Implemented save/load (localStorage) and boot menu.
- Exposed window.render_game_to_text and window.advanceTime for automation loops.
- Added tests for combo scoring, disorder boss override, and Koi-Koi flow.
- Verification:
  - Build passed: corepack pnpm build
  - Tests passed: corepack pnpm test:run
  - Playwright state capture passed over http (state-0.json shows active battle state and score changes).
- Known issue:
  - Headless screenshot appears black in this environment (likely WebGL capture artifact), while state dump confirms scene progression and interaction.
- Next TODO suggestions:
  - Add explicit non-WebGL fallback renderer for automation captures.
  - Add richer target selection UI for charms C-11/C-12/C-13.
  - Balance pass for relic/charm numeric tuning and stage difficulty curve.
- UI polish pass (Chinese-only):
  - Added unified Chinese label helpers for month/rank/season/rarity/traits and original hanafuda names.
  - Battle UI now includes always-visible scoring formula + combo list panel.
  - Card tiles now show both original hanafuda name and yokai name.
  - Shop UI localized to Chinese and shows original hanafuda labels for recruit cards.
  - Removed stale compiled JS artifacts from src/ to keep source clean.

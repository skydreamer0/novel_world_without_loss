# 《無漏》AI 圖像生成與一致性測試 Harness (Visual Harness)

本子專案為長篇小說《無漏》(World Without Loss) 提供結構化的 **AI 圖像生成 Prompt 構建**、**視覺聖經 (Visual Bible) 管理**、與**前後一致性測試 Harness (Consistency Test Harness)**。

> 產品與技術演進規劃請見 [`ROADMAP.md`](ROADMAP.md)。

## 🎯 核心功能

1. **角色資產目錄 Module (`catalog/`)**：
   - 自動列舉並驗證 Character Identity 與不可變 Reference Set。
   - 檢查穩定 ID、別名碰撞、核准狀態、資產路徑與 SHA-256。
   - 核准主版本必須包含四面總覽、正面、四分之三、側面與背面五個不同檔案。
   - 產生 Dashboard 與 Reader 共用的 Catalog Projection。
2. **視覺聖經數據庫 (`visual_bible/`)**：
   - 角色特徵 (qin_woulou, residual_core, qin_zhao 等)
   - 角色圖片版本 (`reference_sets/`)
   - 法寶/物品特徵 (empty_womb 等)
   - 界域/場景特徵 (qingya_city 等)
3. **提示詞構建引擎 (`prompt_engine/`)**：
   - 自動將小說情境 + 視覺聖經 + 全書風格鎖定檔 (Style Preset) 組合為結構化 Prompt。
   - 支援 Flux, Midjourney, Stable Diffusion, DALL-E 3 等格式輸出。
   - 內建 Negative Prompt & Forbidden Tokens 檢查（避免歐式鎧甲、日系大眼等違和風格）。
4. **一致性測試 Harness (`harness/`)**：
   - Prompt 鎖定完整性校驗 (Prompt Lock Checker)
   - 色彩與修仙暗調基調校驗 (Color Palette & Xianxia Tone Evaluator)
   - 迴歸測試執行器 (`test_runner.js`)
5. **視覺預覽 Dashboard (`dashboard/`)**：
   - 由 Catalog Projection 驅動的角色檢視器、提示詞對比與畫布預覽。
6. **Import Batch Module (`catalog/import_batch.js`)**：
   - 預設 dry run；整批驗證成功後才發布。
   - 支援碰撞檢查、SHA-256、冪等重跑與失敗回滾。

目前九名角色都已有核准標準四面組；總覽與獨立視角位於 `storage/generated/turnarounds/`。舊單張立繪保留作歷史資產，但不再是主 Reference Set。

## 🚀 快速開始

### 執行提示詞構建與鎖定測試
```bash
npm test
```

### 重建瀏覽器角色目錄投影
```bash
npm run catalog:build
```

直接新增或更新 Character Identity／Reference Set 後，要重新產生 Projection；Import Batch 在 `--commit` 成功後會自動重建，`npm test` 也會驗證正式 Catalog。

### 批次匯入角色（預設不寫入）
```bash
npm run characters:import -- /path/to/batch/manifest.json
npm run characters:import -- /path/to/batch/manifest.json --commit
```

Import Batch 的 `manifest.json` 格式：

```json
{
  "schema_version": 1,
  "batch_id": "vol3-new-characters-001",
  "collision_policy": "skip-identical",
  "characters": [{ "source": "characters/new_character.json" }],
  "reference_sets": [{ "source": "reference_sets/new_character-core-v1.json" }],
  "assets": [
    {
      "source": "assets/new_character.png",
      "destination": "storage/generated/new_character.png",
      "sha256": "<64 lowercase hex characters>"
    }
  ]
}
```

### 開啟視覺預覽 Dashboard
先執行 `npm run catalog:build`，再在瀏覽器開啟 `dashboard/index.html`，即可檢視角色視覺聖經與提示詞生成效果。正式 Reader 的「角色」分頁也讀取同一份 Projection。

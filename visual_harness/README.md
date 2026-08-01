# 《無漏》AI 圖像生成與一致性測試 Harness (Visual Harness)

本子專案為長篇小說《無漏》(World Without Loss) 提供結構化的 **AI 圖像生成 Prompt 構建**、**視覺聖經 (Visual Bible) 管理**、與**前後一致性測試 Harness (Consistency Test Harness)**。

> 產品與技術演進規劃請見 [`ROADMAP.md`](ROADMAP.md)。

## 🎯 核心功能

1. **視覺聖經數據庫 (`visual_bible/`)**：
   - 角色特徵 (qin_woulou, residual_core, qin_zhao 等)
   - 法寶/物品特徵 (empty_womb 等)
   - 界域/場景特徵 (qingya_city 等)
2. **提示詞構建引擎 (`prompt_engine/`)**：
   - 自動將小說情境 + 視覺聖經 + 全書風格鎖定檔 (Style Preset) 組合為結構化 Prompt。
   - 支援 Flux, Midjourney, Stable Diffusion, DALL-E 3 等格式輸出。
   - 內建 Negative Prompt & Forbidden Tokens 檢查（避免歐式鎧甲、日系大眼等違和風格）。
3. **一致性測試 Harness (`harness/`)**：
   - Prompt 鎖定完整性校驗 (Prompt Lock Checker)
   - 色彩與修仙暗調基調校驗 (Color Palette & Xianxia Tone Evaluator)
   - 迴歸測試執行器 (`test_runner.js`)
4. **視覺預覽 Dashboard (`dashboard/`)**：
   - 視覺聖經檢視器與提示詞對比 Web UI。

## 🚀 快速開始

### 執行提示詞構建與鎖定測試
```bash
node harness/test_runner.js
```

### 開啟視覺預覽 Dashboard
在瀏覽器開啟 `dashboard/index.html` 即可檢視角色視覺聖經與提示詞生成效果。

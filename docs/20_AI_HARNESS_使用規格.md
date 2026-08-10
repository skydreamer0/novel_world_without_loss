# AI Harness 使用規格

## 目標

AI_HARNESS 是《無漏》的機器可讀寫作介面。一般單章輸入控制在約3,000至7,000 tokens，不需要重讀全部正文與作品聖經。

## 目錄

```text
AI_HARNESS/
  README.md
  manifest.json
  core.json
  current_state.json
  retrieval_index.json
  arc_051_060.json
  chapter_request.schema.json
  chapter_result.schema.json
  example_request.json
  runner_prompt.md
  validator_prompt.md
  build_context.py
  validate_harness.py
```

## 檔案職責

| 檔案 | 用途 | 讀取時機 |
|---|---|---|
| manifest.json | 版本、進度、現行章群、預算 | 每次 |
| core.json | 核心命題、硬規則、主要角色、長期方向 | 每次 |
| current_state.json | 第50章後的世界快照 | 每次 |
| arc_051_060.json | 現行章群任務與每章節點 | 處理51至60章時 |
| retrieval_index.json | 索引可選模組與真相層級 | 組裝上下文時 |
| runner_prompt.md | 規定規劃、撰寫與審核模式 | 每次 |
| validator_prompt.md | 審查清單 | REVIEW 模式 |
| chapter_request.schema.json | 單章任務輸入格式 | 建立任務時 |
| chapter_result.schema.json | 正文完成後的差量格式 | 撰寫完成時 |
| build_context.py | 依請求組裝低 Token 上下文 | 呼叫 AI 前 |
| validate_harness.py | 驗證 JSON、ID、路徑與進度一致性 | 更新後 |

## 真相層級

| 層級 | 可讀範圍 |
|---:|---|
| 0 | 公開世界事實，可直接寫入正文 |
| 1 | 主要角色當前已知 |
| 2 | 伏筆層，只能暗示 |
| 3 | 卷級真相，只在指定節點揭露 |
| 4 | 跨紀元真相，一般單章禁止載入 |
| 5 | 作者密層，只用於總綱與紀元規劃 |

章節請求用 `max_truth_level` 限制可讀模組。生成上下文時，超過層級的模組必須略過，不以替代文字透露其存在。

## 狀態管理

1. `current_state.json` 是最後已確認章節的完整快照。
2. 每章輸出 `state_delta`，不直接改寫快照。
3. 人類確認正文後，才把差量合併進新快照。
4. 角色位置、傷勢、關係、資源、時間、伏筆、科技狀態與真相揭露都必須輸出差量。
5. 未確認草稿不得成為 canon。

## 去重與壓縮

1. 同一事實只在一個權威檔案保存完整版。
2. 章群檔只存該章群需要的局部狀態，用 ID 指向核心規則。
3. 一般章節只攜帶上三章各約150至250字的摘要。
4. 人物背景只攜帶本章會影響選擇的部分。
5. 需深度查證時才讀取 Markdown 完整設定或正文。

## Token 排序

超出預算時依下列順序保留：

1. 當章必達事件與禁止事項。
2. 世界硬規則與當前狀態。
3. 本章視角角色、直接關係與傷勢。
4. 現行章群的結束狀態。
5. 將於本章生效的伏筆。
6. 場景感官與可選背景。

不允許為壓縮預算刪除成本、限制、時間或傷勢。

## 新設定登記

新規則、技術、艦船、勢力與異文明必須：

1. 取得唯一 ID。
2. 標明前置條件、功能、代價、限制、反制方式。
3. 標明真相層級與首次登場章節。
4. 指定權威檔案。
5. 通過驗證後才寫入 canon。

## 科技生命週期

`anomaly` → `observed` → `hypothesis` → `prototype` → `repeatable` → `standardized` → `mass_produced` → `obsolete` 或 `forbidden`

每次進階必須有實驗、失敗、資源或組織成本。第60章的界膜只能將 T001 推進至 `observed`。

## 艦隊任務必填欄位

1. 任務 ID、艦隊 ID、指揮權與公民授權層級。
2. 航路、錨點、航時、通訊延遲。
3. 目標主權與掠界分類。
4. 參戰艦種、功能上限與已有故障。
5. 糧食、能量、錨材、法則完整度與可承受界債。
6. 任務目標、中止條件、平民處置與求償方案。
7. 勝利後的政治、生態與 AI 權限差量。

## 每章交付

AI 正文後必須另交一個符合 `chapter_result.schema.json` 的 JSON，包含：

1. 章節摘要。
2. 已達成與未達成任務。
3. 狀態差量。
4. 新事實、新 ID 與建議權威檔案。
5. 伏筆觸發、新增與回收。
6. 連續性風險。
7. 下章建議讀取模組。

## 驗收標準

1. 所有 JSON 可解析。
2. manifest 的當前章節、章群與 current_state 一致。
3. 所有引用 ID 皆有定義或明確標為待建立。
4. 檢索模組的真相層級可被過濾。
5. 範例請求可建立不超過預算的上下文。
6. 未授權的高層真相不會出現在輸出。
7. 新科技不得跳過必要生命週期。

v0.8 隨附驗證基準為 17 個檢索模組全數通過。第 51 章範例上下文依實際 tokenizer 或內建保守估算器約為 3.3k–3.6k tokens，符合 3,000 至 7,000 tokens 的單章預算。

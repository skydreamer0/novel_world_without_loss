# 《無漏》AI Harness

這個目錄可直接作為 AI 章節規劃、撰寫與審核的上下文介面。完整規格見 [`docs/20_AI_HARNESS_使用規格.md`](../docs/20_AI_HARNESS_使用規格.md)。

## 快速使用

```bash
python3 validate_harness.py
python3 build_context.py example_request.json > context_CH051.md
```

將第二個命令產生的內容送給 AI。AI 完成正文後，另回傳符合 `chapter_result.schema.json` 的 JSON。

目前 v0.8 基準測試：17 個檢索模組全部通過；第 51 章範例上下文依 tokenizer／保守估算器約為 3.3k–3.6k tokens，落在規格預算內。

## 工作原則

1. 先備份 `example_request.json`，再改為當章請求。
2. `required_modules` 只列當章真正會用到的設定。
3. 一般正文的 `max_truth_level` 使用 2，禁止使用 4 或 5。
4. 正文確認後才合併 `state_delta`。
5. 修改進度、規則或模組後，再執行一次驗證。

## ID 簡表

| 類型 | 格式 | 範例 |
|---|---|---|
| 章節 | CH + 至少三位數 | CH051、CH1200 |
| 章群 | ARC + 至少三位數 | ARC006 |
| 角色 | C + 至少三位數 | C001 |
| 規則 | RULE-名稱 | RULE-界歸 |
| 科技 | T + 至少三位數 | T001 |
| 伏筆 | F + 至少三位數 | F036 |
| 艦船 | SHIP-代碼 | SHIP-M01 |
| 艦隊 | FLT-代碼 | FLT-EX01 |
| 任務 | MSN-代碼 | MSN-R001 |

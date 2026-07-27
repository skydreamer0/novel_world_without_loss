# 《無漏》長篇知識庫與 GraphRAG 檢索架構

本文件記錄《無漏》長篇小說（預定 500 章）知識庫維護與 AI RAG 檢索架構策略。

---

## 一、背景與核心痛點

在長篇小說 AI 寫作中，傳統向量 RAG 與全量 GraphRAG 各有優缺點：

- **傳統向量 RAG（Basic Vector Search）**：
  - 適合：明確局部查詢（如「第幾章獲得殘核？」、「某人物說過什麼？」）。
  - 局限：無法回答跨越幾十章的全局性問題（如「全書勢力消長」、「伏筆連鎖反應與矛盾稽核」）。

- **全量 GraphRAG（Standard GraphRAG）**：
  - 適合：抽取人物、地點、組織、實體關係與社群摘要，能處理全局探索（Global Search / DRIFT Search）。
  - 局限：**前置索引成本高昂**（LLM 實體與關係抽取占總索引成本 75% 以上），在開篇數十章內 ROI 極低。

---

## 二、三層知識檢索架構 (Three-Tier RAG Strategy)

為兼顧**零設定漂移**與**控管 API 成本**，《無漏》採用三層漸進式知識檢索架構：

```text
┌───────────────────────────────────────────────────────────┐
│ 第一層：明確設定資料庫 (Single Source of Truth / 100% 精準) │
│ - docs/02_世界鐵律.md, 03_角色與勢力.md, 07_伏筆與揭密台帳.md  │
└──────────────────────────────┬────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────┐
│ 第二層：一般向量與正文檢索 (Vector RAG / Manuscript Search) │
│ - manuscript/ 正文、docs/11_進度台帳.md 摘要                │
└──────────────────────────────┬────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────┐
│ 第三層：輕量三元組圖譜 (Lightweight Relation Graph)          │
│ - 章節定稿時由 AI 自動抽取增量 JSON Triplets                 │
└───────────────────────────────────────────────────────────┘
```

### 第一層：明確設定資料庫 (Structured Bible DB)
- **維護方式**：由作者與 AI 共同手動/增量維護。
- **涵蓋檔案**：
  - [02_世界鐵律.md](file:///c:/Users/User/Documents/Project/novel_world_without_loss/docs/02_%E4%B8%96%E7%95%8C%E9%90%B5%E5%BE%8B.md)（規則、代價）
  - [03_角色與勢力.md](file:///c:/Users/User/Documents/Project/novel_world_without_loss/docs/03_%E8%A7%92%E8%89%B2%E8%88%87%E5%8B%A2%E5%8A%9B.md)（人物、關係、弧線）
  - [04_空間與力量系統.md](file:///c:/Users/User/Documents/Project/novel_world_without_loss/docs/04_%E7%A9%BA%E9%96%93%E8%88%87%E5%8A%9B%E9%87%8F%E7%B3%BB%E7%B5%B1.md)（殘核、無漏界）
  - [07_伏筆與揭密台帳.md](file:///c:/Users/User/Documents/Project/novel_world_without_loss/docs/07_%E4%BC%8F%E7%AD%86%E8%88%87%E6%8F%AD%E5%AF%86%E5%8F%B0%E5%B8%B3.md)（埋設與回收）
- **優勢**：可信度最高，作為正文生成與審稿的唯一真理來源。

### 第二層：一般向量 RAG (Vector Search)
- **涵蓋檔案**：`manuscript/` 各章正文與 `docs/11_進度台帳.md` 之章節摘要。
- **用途**：尋找特定原文對話、場景細節、首次出現章節。

### 第三層：輕量三元組圖譜 (Lightweight Triplets Graph)
- **維護方式**：正文定稿時，在五步寫作流程的「第五步：更新台帳」中，讓 AI 同步輸出結構化 JSON 關係。
- **關係類型範例**：
  ```text
  人物 ──[隸屬/敵對/師承]──> 勢力
  人物 ──[持有/修煉]──────> 殘核/力量
  事件 ──[影響/觸發]──────> 世界虛無化
  伏筆 ──[回收於]────────> 章節
  規則 ──[例外條件]──────> 特殊狀況
  ```

---

## 三、擴充與 Scale-up 策略

1. **0 - 50 章（目前階段）**
   - 保持「第一層設定庫 + 第二層正文台帳 + 第三層定稿 AI 增量 JSON」。
   - **完全不跑昂貴的全量 GraphRAG 索引**。

2. **50 - 100 章（中規模階段）**
   - 角色與勢力密集交織時，導入 **FastGraphRAG**（NLP 名詞/共現抽取）與 CLI 的 `fast-update` 增量更新。
   - 使用輕量/平價模型（如 Gemini Flash / LiteLLM 本地 Embedding）進行圖譜建置。

3. **100 章以上 / 卷末稽核（大規模階段）**
   - 僅在需要進行跨卷全書級設定稽核（如伏筆回收率統計、全書勢力興衰分析）時，針對 key chapters 或社群報告執行 **Standard GraphRAG**。

---

## 四、定稿 JSON 關係抽取 Schema 規範

每章定稿時，AI 於台帳末尾輸出的 JSON 格式規範如下：

```json
{
  "chapter": 51,
  "triplets": [
    {
      "source": "秦無漏",
      "target": "顧寒生",
      "relation": "營救行動",
      "context": "在開界宗殘脈中嘗試解救顧寒生"
    },
    {
      "source": "遲影",
      "target": "居民資格",
      "relation": "獲得申請",
      "context": "成功註冊為無漏界獨立居民"
    },
    {
      "source": "甲字令殘序",
      "target": "顧寒生",
      "relation": "保管",
      "context": "成功保住副本不被開界宗奪走"
    }
  ]
}
```

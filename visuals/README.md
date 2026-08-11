# 《無漏》視覺資產庫

這裡只保存小說的角色、場景與世界視覺資料，不是另一套 AI Harness。

## 資料夾

```text
visuals/
  characters/       每名角色一個資料夾：設定、版本、圖片
  scenes/           每個已建立的章節場景
  world/            共用風格、地點與物件
  contact_sheets/   角色總覽圖
  generated/        Reader 使用的自動產生目錄
  tools/            內部建置與驗證工具
  tests/            核心資料檢查
```

一般整理圖片時，只需要進入 `characters/` 或 `scenes/`。

## 角色資料

每名角色的結構相同：

```text
characters/qin_woulou/
  profile.json      不隨服裝改變的角色設定
  versions/         已核准或草稿中的外觀版本
  images/           該角色的所有參考圖片
```

正式版本仍保留四面總覽、正面、四分之三、側面與背面，避免後續生圖時角色漂移。歷史圖片不會因改版而覆蓋。

## 使用

```bash
npm test             # 檢查角色設定、版本、圖片與雜湊
npm run build        # 更新 Reader 使用的視覺目錄
```

Reader 只載入 `generated/visual_catalog.browser.js`。`tools/` 是內部 Implementation，平常不需要操作。

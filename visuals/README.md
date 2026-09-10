# 《無漏》視覺資產庫

這裡只保存小說的角色、場景與世界視覺資料，不是另一套 AI Harness。

目前資產盤點：35 名角色、8 組正式章節場景、1 張萬界城世界錨點、3 張科幻擴張概念草圖，以及秦罡的 3 格角色分鏡。下一批製作方向與優先序見 [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md)。

## 資料夾

```text
visuals/
  characters/       每名角色一個資料夾：設定、版本、圖片
  scenes/           每個已建立的章節場景
  world/            共用風格、地點與物件
  concepts/         尚未進入正式場景規格的氣氛／時代概念草圖
  contact_sheets/   角色總覽圖
  generated/        Reader 使用的自動產生目錄
  tools/            內部建置與驗證工具
  tests/            核心資料檢查
```

一般整理圖片時，只需要進入 `characters/` 或 `scenes/`。

## 資產層級

1. `world/`：固定世界的材質、建築、光線與界律視覺語言。
2. `characters/`：固定角色身份與版本，供場景生圖引用。
3. `scenes/`：可正式放入章節或 Reader 的敘事成品。
4. `concepts/`：探索未來紀元或氣氛方向，不視為當前章節的正史畫面。

現有 `concepts/scifi-expansion/` 三張圖屬於低解析氣氛草圖，適合保留作遠期文明方向參考；若要放入正文，應先依當章時代、角色版本與場景內容重製為正式 `scenes/` 資產。

## 角色資料

每名角色的結構相同：

```text
characters/qin_woulou/
  profile.json      不隨服裝改變的角色設定
  versions/         已核准或草稿中的外觀版本
  images/           該角色的所有參考圖片
```

正式版本仍保留四面總覽、正面、四分之三、側面與背面，避免後續生圖時角色漂移。歷史圖片不會因改版而覆蓋。

目前角色基礎已足夠，不建議繼續大量增加配角轉面圖。接下來只需為高頻主角補近臉錨點，再把產能轉向世界錨點與章節名場面。

## 新場景命名

```text
scenes/chapter_NNN_short_slug/
  chapter_NNN_short_slug_v1.png
  scene.json
```

- 章號固定三位數，名稱使用小寫 snake_case。
- 已被引用的圖不原地覆蓋；改稿新增 `v2`、`v3`。
- 正式場景需記錄角色版本、地點／物件、鏡頭、行動、情緒與成品雜湊。
- 正文橫幅以無字、無浮水印的寬幅構圖為主，重要角色必須引用核准版本。

## 使用

```bash
npm test             # 檢查角色設定、版本、圖片與雜湊
npm run build        # 更新 Reader 使用的視覺目錄
```

Reader 只載入 `generated/visual_catalog.browser.js`。`tools/` 是內部 Implementation，平常不需要操作。

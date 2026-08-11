# Domain context

## Visual Library（視覺資產庫）

`visuals/` 是《無漏》角色、場景與世界視覺資料的唯一入口。它不是寫作 Harness；一般使用者只需要理解角色、場景與圖片，建置和驗證細節集中在內部 `tools/` Module。

## Character Identity（角色身份）

小說人物的穩定識別資料。`character_id` 一經建立，不因翻譯、服裝、年齡階段或圖片變更而改動。每名角色的設定、版本與圖片集中在 `visuals/characters/<character_id>/`，以維持 Locality。

## Character Version（角色版本）

角色在特定外觀狀態下的一組不可變視覺參考資產。資料內沿用穩定的 `reference_set_id` 供舊場景追溯，但文件與 Reader 一律稱為「角色版本」。已被引用的版本不得原地覆蓋；新造型必須建立新版本。

## Standard Four-view Set（標準四面組）

正式角色版本必須包含四面總覽、正面、四分之三、完整側面與背面。缺少任一視角時，Visual Catalog 必須拒絕發布。

## Visual Catalog（視覺目錄）

Visual Catalog 是一個 Deep Module：它從 Visual Library 讀取所有角色，集中驗證 ID、名稱、目前版本、圖片路徑、檔案雜湊與資產歸屬，再產生 Reader 唯一使用的 `visual_catalog.browser.js`。Reader 不得自行維護第二份角色名單。

## Scene（場景）

`visuals/scenes/` 保存已建立的章節場景、登場角色版本與成品圖。場景資料是視覺資產的一部分，不再建立獨立 Dashboard、Prompt Package 或 Quality Gate 管線。

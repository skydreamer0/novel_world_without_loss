# Domain context

## Character Identity（角色身份）

小說人物的穩定識別資料。`character_id` 一經建立不得因翻譯、服裝、年齡階段或圖片變更而改動；小說文本名稱與別名必須能對應到同一個 Character Identity。

## Reference Set（角色參考集）

某個 Character Identity 在特定外觀狀態下的一組不可變視覺參考資產，例如核心造型、戰鬥服、受傷狀態或年齡階段。每個 Reference Set 有獨立 ID、版本、核准狀態、用途、檔案雜湊與引擎設定；已被任務引用的版本不得原地覆蓋。

## Standard Four-view Set（標準四面組）

角色後續的表情、服裝、傷勢、姿勢與章節場景發想，必須建立在已核准的標準四面組之上。核准主 Reference Set 必須同時具有不可裁切的四面總覽，以及各自獨立、不同檔案的正面、四分之三、完整側面與背面；缺少任一視角時 Catalog 必須拒絕發布。

## Character Catalog（角色資產目錄）

所有 Character Identity 與 Reference Set 的唯一事實來源。Character Catalog 負責列舉、驗證、穩定排序、ID／名稱查找、資產路徑解析與對外投影；Prompt、Harness、Dashboard、Reader 與匯入流程不得自行維護角色名單。

## Catalog Projection（目錄投影）

由 Character Catalog 產生、供瀏覽器唯讀使用的資料快照。Dashboard 與 Reader 可以有不同呈現方式，但不得各自複製角色名稱、圖片路徑或 Reference Set 規則。

## Import Batch（匯入批次）

一組準備加入 Character Catalog 的 Character Identity、Reference Set 與資產檔。Import Batch 必須先在暫存區完成 dry run、結構與語意驗證、碰撞檢查及檔案雜湊；全部通過才可發布，避免部分成功。

## Scene Spec（場景規格）

描述章節場景中的角色、物品、地點、鏡位、動作與情緒。角色只能以 `character_id` 與明確的 `reference_set_id` 被引用；是否出現在某場景由 Scene Spec 決定，不由 Character Catalog 推測。

## Prompt Package（提示詞包）

由已驗證 Scene Spec、Reference Set 與全書風格組合出的可追溯生成資料。Prompt Package 必須保留角色 ID、Reference Set 版本與來源，不得在缺少必要角色時以警告後繼續產生看似完整的結果。

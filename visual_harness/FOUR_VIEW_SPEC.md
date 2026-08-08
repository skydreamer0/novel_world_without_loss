# 《無漏》角色標準四面圖規格

版本：1.0  
建立日期：2026-08-07  
生成方式：Codex built-in ImageGen（`stylized-concept`）

## 發布閘門

角色只有在以下五個資產都有獨立檔案、SHA-256 與明確角色版本時，才能把主 Reference Set 標為 `approved`：

1. `turnaround`：不可裁切的四面總覽。
2. `full_body_front`：正面。
3. `full_body_three_quarter`：四分之三。
4. `full_body_profile`：完整側面。
5. `full_body_back`：背面。

四面組核准以前，不製作表情、服裝、傷勢、姿勢與章節場景變體。舊圖不覆蓋；建立新版本後，舊主版本改為 `retired`。

## 共用生成提示詞

```text
Use case: stylized-concept
Asset type: production character turnaround master sheet for a Chinese xianxia novel
Primary request: Create one clean four-view turnaround sheet of exactly the same subject in four equal vertical panels.
Composition/framing: wide landscape contact sheet; exactly four full-body views at identical scale and floor line, ordered left to right: direct front, three-quarter view, exact right profile, exact back. Neutral anatomical standing pose; hands and feet fully visible; clear empty gutters.
Scene/backdrop: seamless warm light-gray studio background with a faint floor line; no scenery.
Style/medium: grounded cinematic photorealistic character design; restrained eastern xianxia; real skin and material texture; consistent identity, proportions and construction across all views.
Lighting/mood: soft neutral studio lighting; even exposure.
Constraints: no text, labels, title, watermark, border, action pose, cropped feet, extra subject, view duplication or design changes between panels. The back view must genuinely show the rear construction.
```

## 九名角色鎖定差異

| Character ID | 核心提示 | 禁止方向 | 核准版本 |
|---|---|---|---|
| `qin_woulou` | 深藏青實用武袍、暗銀髮帶、左掌淡薄虛界痕 | 劍、玉珮、重甲、大型光環 | `qin_woulou-core-v2` |
| `qin_zhao` | 白色與舊金秦氏正式袍、窄肩護、眉宇受壓 | 金色法陣、發光金瞳、巨型龍肩甲 | `qin_zhao-core-v2` |
| `ruan_qinghe` | 鼠尾草綠工作醫袍、固定袖口、銀針卷與藥袋 | 手杖、大藥箱、絲繡、美妝 | `ruan_qinghe-core-v2` |
| `lu_qinghe` | 手織靛藍麻袍、皮腕纏、背負實用乾麥束 | 佩劍、絲質宮裝、把麥束畫成翅膀 | `lu_qinghe-core-v2` |
| `jiluo` | 活木角藤、樹皮布、蘆纖維、根革與葉纖披片 | 西式金屬甲、蠻族尖刺、獸骨、綠煙 | `jiluo-core-v2` |
| `chiying` | 霧灰半實體影身、炭灰旅裝、獨立小影、左掌殘序 | 女鬼華服、發光袍文、紅潤人皮、成人化 | `chiying-core-v2` |
| `zhiyuan` | 二十九歲旅人、界符拼縫斗篷、門片、船牌、錯位殘影 | 戴起兜帽、魅惑刺客、星空披風、拔刀 | `zhiyuan-core-v1` |
| `su_wanzhao` | 灰青細裁長袍、克制半束髮、空婚珮位、照影玉 | 白紫公主裝、大冠、發光玉、戀愛姿勢 | `su_wanzhao-core-v1` |
| `residual_core` | 青色切面八面晶核、交錯舊金星盤環架、不可讀青色符紋環 | 人形、有機軀體、青銅演算薄片、中空核心、改色晶體、現代科幻機械 | `residual_core-core-v2` |

## 正式輸出

所有總覽與獨立視角均位於 `storage/generated/turnarounds/`。各 Reference Set JSON 保存檔案角色、相對路徑、SHA-256、媒體型別、來源、版本與引擎引用順序；`catalog/generated/character_catalog.json` 是瀏覽器與 Reader 使用的唯讀投影。

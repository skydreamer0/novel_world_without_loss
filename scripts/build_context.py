import json
import glob
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
OUTLINES_DIR = os.path.join(BASE_DIR, "outlines")
TRIPLETS_DIR = os.path.join(DOCS_DIR, "data")
PROGRESS_FILE = os.path.join(DOCS_DIR, "11_進度台帳.md")
HOOKS_FILE = os.path.join(DOCS_DIR, "07_伏筆與揭密台帳.md")
CHARACTERS_FILE = os.path.join(DOCS_DIR, "03_角色與勢力.md")

# Ensure UTF-8 stdout
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_chapter_outline(chap_num):
    """Find and extract outline for specific chapter from outlines/"""
    cn_num = num_to_cn(chap_num)
    for file_name in sorted(os.listdir(OUTLINES_DIR)):
        if file_name.endswith(".md") and "細綱" in file_name:
            file_path = os.path.join(OUTLINES_DIR, file_name)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            blocks = content.split("\n## 第")
            for block in blocks[1:]:
                block_full = "## 第" + block
                header_line = block_full.split("\n")[0]
                if f"第{chap_num}章" in header_line or f"第{cn_num}章" in header_line or f"第{chap_num:03d}章" in header_line:
                    return block_full.strip()
    return f"未能在 outlines/ 找到第 {chap_num} 章細綱。"

def num_to_cn(n):
    units = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    if n <= 0: return str(n)
    if n < 10: return units[n]
    if n == 10: return '十'
    if n < 20: return '十' + units[n % 10]
    if n < 100:
        return units[n // 10] + '十' + (units[n % 10] if n % 10 != 0 else '')
    if n < 1000:
        hundreds = units[n // 100] + '百'
        rem = n % 100
        if rem == 0:
            return hundreds
        elif rem < 10:
            return hundreds + '零' + units[rem]
        elif rem == 10:
            return hundreds + '一十'
        else:
            return hundreds + num_to_cn(rem)
    return str(n)

def get_last_chapters_summary(chap_num, count=3):
    """Extract summaries for previous N chapters from 11_進度台帳.md"""
    if not os.path.exists(PROGRESS_FILE):
        return "無進度台帳紀錄"

    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    summaries = []
    start_chap = max(1, chap_num - count)
    end_chap = chap_num - 1

    # Split progress file by '### ' section headers
    blocks = content.split("\n### ")
    for b in blocks[1:]:
        header_line = b.split("\n")[0]
        for c in range(start_chap, end_chap + 1):
            cn_num = num_to_cn(c)
            # Match headers like "第四十八章：第二座自治城" or "48章" or "048"
            if f"第{cn_num}章" in header_line or f"第{c}章" in header_line or f"第{c:03d}章" in header_line:
                # Remove extra metadata notes at end of block if any
                clean_block = b.strip()
                # Strip out trailing instructions or unrelated subheadings
                if "\n後續摘要需保留" in clean_block:
                    clean_block = clean_block.split("\n後續摘要需保留")[0].strip()
                if "\n## " in clean_block:
                    clean_block = clean_block.split("\n## ")[0].strip()
                summaries.append("### " + clean_block)
                break

    return "\n\n".join(summaries[-count:]) if summaries else "未找到前三章摘要。"

def get_triplet_history(entities, before_chapter=None):
    """Query triplets graph for entity connections"""
    graph_files = sorted(glob.glob(os.path.join(TRIPLETS_DIR, "triplets_*.json")))
    if not graph_files or not entities:
        return "無輕量圖譜資料。"

    history = []
    for ent in entities:
        ent_matches = []
        for graph_file in graph_files:
            with open(graph_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data.get("chapters", []):
                chap = item.get("chapter")
                if before_chapter is not None and chap is not None and chap >= before_chapter:
                    continue
                for t in item.get("triplets", []):
                    if (ent.lower() in t["source"].lower() or
                        ent.lower() in t["target"].lower() or
                        ent.lower() in t["relation"].lower() or
                        ent.lower() in t["context"].lower()):
                        ent_matches.append(f"  • [第{chap}章] ({t['source']}) ──[{t['relation']}]──> ({t['target']}): {t['context']}")
        
        if ent_matches:
            history.append(f"### 實體 [{ent}] 歷史脈絡鏈:\n" + "\n".join(ent_matches[-5:])) # last 5 key events

    return "\n\n".join(history) if history else "圖譜中無相關實體脈絡。"

def build_writing_pack(chap_num, entities):
    print(f"[Build] 正在為第 {chap_num} 章生成 AI 寫作開寫包...")
    
    outline = get_chapter_outline(chap_num)
    prev_summaries = get_last_chapters_summary(chap_num, count=3)
    triplets = get_triplet_history(entities, before_chapter=chap_num)
    
    output_filename = f"15_第{chap_num}章開寫包.md" if chap_num >= 52 else f"14_第{chap_num}章開寫包.md"
    output_filepath = os.path.join(DOCS_DIR, output_filename)
    
    content = f"""# 《無漏》第 {chap_num} 章 AI 開寫包

生成時間：2026-07-28
目標章節：第 {chap_num} 章
關聯實體：{', '.join(entities) if entities else '無指定'}

---

## 一、當章執行細綱

{outline}

---

## 二、前三章情節銜接點 (Context)

{prev_summaries}

---

## 三、第三層圖譜實體脈絡 (Triplets Knowledge Graph)

{triplets}

---

## 四、寫作指令與提示詞

請依據上述細綱、銜接上下文與實體歷史脈絡，生成《無漏》第 {chap_num} 章正文。

**寫作規範**：
1. 視角：第三人稱限知（跟隨秦無漏）。
2. 字數：2,800 - 3,800 字。
3. 嚴格遵守世界鐵律與既有因果，不得自行發明修煉境界或世界真相。
4. 正文定稿後，請隨附：100-200字摘要、狀態變更、伏筆變更、下章承接點，以及第三層 JSON 三元組。
"""

    with open(output_filepath, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"成功生成開寫包檔案: {output_filepath}")
    return output_filepath

if __name__ == "__main__":
    chap = 51
    ents = ["顧寒生", "晏平章", "遲影", "甲字令"]
    
    if len(sys.argv) > 1:
        try:
            chap = int(sys.argv[1])
        except ValueError:
            pass
    if len(sys.argv) > 2:
        ents = [e for e in re.split(r"[,\s]+", sys.argv[2].strip()) if e]

    build_writing_pack(chap, ents)

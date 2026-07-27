import json
import os
import sys

# Ensure UTF-8 stdout encoding for Windows terminals
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "data", "triplets_000_050.json")

def search_triplets(keyword):
    if not os.path.exists(DATA_PATH):
        print(f"Error: Data file not found at {DATA_PATH}")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    results = []
    keyword_lower = keyword.lower()

    for item in data.get("chapters", []):
        chap_num = item.get("chapter")
        chap_title = item.get("title")
        matched = []
        for triplet in item.get("triplets", []):
            src = triplet.get("source", "")
            tgt = triplet.get("target", "")
            rel = triplet.get("relation", "")
            ctx = triplet.get("context", "")
            
            if (keyword_lower in src.lower() or 
                keyword_lower in tgt.lower() or 
                keyword_lower in rel.lower() or 
                keyword_lower in ctx.lower()):
                matched.append(triplet)

        if matched:
            results.append({
                "chapter": chap_num,
                "title": chap_title,
                "matches": matched
            })

    print(f"\n[Search] 關鍵字 [{keyword}] 的檢索結果 (共找到 {len(results)} 個相關章節):\n" + "="*50)
    if not results:
        print("未找到相關三元組紀錄。")
        return

    for res in results:
        print(f"\n第 {res['chapter']} 章：{res['title']}")
        for m in res["matches"]:
            print(f"  • ({m['source']}) ──[{m['relation']}]──> ({m['target']})")
            print(f"    上下文: {m['context']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python scripts/query_triplets.py <關鍵字>")
        print("範例: python scripts/query_triplets.py 秦昭")
        sys.exit(1)

    search_keyword = sys.argv[1]
    search_triplets(search_keyword)

"""Archive this batch, create display derivatives and insert verified illustrations."""
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[2]
VISUALS = ROOT / 'visuals'
JOBS = json.loads((BATCH / 'prompts.json').read_text(encoding='utf-8'))
SOURCES = json.loads((BATCH / 'outputs.json').read_text(encoding='utf-8'))
DETAILS = {
    85: ('vol_02', '三人受傷，一柄鐮刀報廢，得到的銀穀只夠二十人一餐。效率低得殘核連續標出紅字。', '陸青禾與包紮手掌的農婦查看少量銀穀，報廢鐮刀留在收過的田邊', '半畝首割，只夠二十人一餐', [('lu_qinghe', 'lu_qinghe-core-v2')]),
    70: ('vol_01', '三槐台與九顆殘心逐一跟上。', '秦無漏右臂垂下，左手按住城牆，身影逐漸淡去，棚屋與生活座標一同跟隨', '棚屋、傷者與生活一起帶走', [('qin_woulou', 'qin_woulou-core-v2')]),
    97: ('vol_02', '空間裡第一次多出一口真正的淡水井，井上方卻沒有歡呼。', '遷入者靜候新井旁，水桶與殘存屋基圍著暫封出水口，井水尚未接入田渠', '淡井到了，井邊卻沒有歡呼', []),
    110: ('vol_02', '女兒沒有接話，只替他把鞋帶繫緊。', '杜衡坐在隔離繩外，女兒替他繫緊厚底鞋，石片分隔的小池泛著青銀水紋', '女兒繫緊鞋帶，泉邊仍留一道繩', []),
    89: ('vol_02', '峰腰第一株銀芽完全展開。', '秦無漏以左手靠近指寬石溝，右臂包紮垂下，微小銀芽與水痕在洗劍峰石縫展開', '一滴水與一粒穀，留下灌溉痕', [('qin_woulou', 'qin_woulou-core-v2')]),
}

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def write_json(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

records = []
for job in JOBS:
    n, slug, version = job['n'], job['slug'], job['v']
    volume, anchor, alt, caption, refs = DETAILS[n]
    chapter = next((ROOT / 'manuscript' / volume).glob(f'{n:03}_*.md'))
    source_hash = digest(chapter)
    content = chapter.read_text(encoding='utf-8')
    folder = VISUALS / 'scenes' / slug
    folder.mkdir(parents=True, exist_ok=True)
    master = folder / f'{slug}_v{version}.png'
    display = folder / f'{slug}_v{version}_reader.webp'
    assert not master.exists() and not display.exists(), 'Do not overwrite a previous deliverable'
    source = Path(SOURCES[str(n)])
    shutil.copy2(source, master)
    with Image.open(master) as img:
        img.load()
        original_size = img.size
        rendered = img.convert('RGB')
        rendered.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        rendered.save(display, 'WEBP', quality=87, method=6)
        width, height = rendered.size
    metadata_path = folder / 'scene.json'
    if metadata_path.exists():
        shutil.copy2(metadata_path, BATCH / f'{slug}_previous_scene.json')
    metadata = {
        'schema_version': 1, 'scene_id': slug, 'chapter_number': n,
        'chapter_label': chapter.read_text(encoding='utf-8').splitlines()[0].removeprefix('# '),
        'title': job['title'],
        'character_refs': [{'character_id': c, 'reference_set_id': r} for c, r in refs],
        'item_ids': ['empty_womb'] if n == 70 else [],
        'location_id': 'wanjie_city' if n == 70 else None,
        'camera': '16:9 wide scene from city wall' if n == 70 else '3:2 narrative medium or detail scene',
        'action_description': alt, 'mood': '克制、疲憊，生活中的微小成果與代價並存',
        'display_asset': {'path': display.relative_to(VISUALS).as_posix(), 'sha256': digest(display), 'media_type': 'image/webp'},
    }
    write_json(metadata_path, metadata)
    if n in (70, 85):
        content, count = re.subn(r'<figure class="chapter-illustration">\s*<img[^>]*' + re.escape(slug) + r'[^>]*>.*?</figure>\s*', '', content, flags=re.S)
        assert count == 1, f'Expected previous illustration in chapter {n}'
    assert content.count(anchor) == 1
    relative = '../../' + display.relative_to(ROOT).as_posix()
    figure = f'<figure class="chapter-illustration">\n  <img src="{relative}" alt="{alt}" width="{width}" height="{height}" loading="lazy" decoding="async">\n  <figcaption><span>第{n}章</span> {caption}</figcaption>\n</figure>'
    content = content.replace(anchor, anchor + '\n\n' + figure)
    chapter.write_text(content, encoding='utf-8')
    record = {
        'chapter': n, 'manuscript': chapter.relative_to(ROOT).as_posix(),
        'source_manuscript_sha256': source_hash,
        'inserted_after': anchor, 'alt': alt, 'caption': caption,
        'master': master.relative_to(ROOT).as_posix(), 'master_sha256': digest(master),
        'master_size': original_size, 'display': display.relative_to(ROOT).as_posix(),
        'display_sha256': digest(display), 'display_size': [width, height],
        'display_bytes': display.stat().st_size,
        'generated_source': str(source), 'character_refs': metadata['character_refs'],
        'reference_files': [{'path': str(Path(p).relative_to(ROOT)), 'sha256': digest(Path(p))} for p in job['refs']],
        'generation_mode': 'built-in image_gen',
    }
    records.append(record)
write_json(BATCH / 'delivery.json', records)
print(json.dumps([{'chapter': r['chapter'], 'display_size': r['display_size'], 'display_bytes': r['display_bytes']} for r in records], ensure_ascii=False, indent=2))

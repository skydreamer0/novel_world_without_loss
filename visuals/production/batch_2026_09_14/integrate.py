"""Integrate only this five-image batch after visual review."""
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[2]
VISUALS = ROOT/'visuals'
jobs = json.loads((BATCH/'prompts.json').read_text(encoding='utf-8'))
sources = {s['chapter']: s for s in json.loads((BATCH/'source_manuscripts.json').read_text(encoding='utf-8'))}
outputs = json.loads((BATCH/'outputs.json').read_text(encoding='utf-8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save_json(path, data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Validate the complete batch before modifying any chapter.
for job in jobs:
    source = sources[job['n']]
    chapter = ROOT/source['manuscript']
    assert sha(chapter) == source['sha256'], f'Chapter changed since scene card: {chapter}'
    assert source['text'].count(job['anchor']) == 1
    assert '<figure' not in source['text']
    assert not (VISUALS/'scenes'/job['slug']).exists(), 'Never overwrite an existing scene'
    assert Path(outputs[str(job['n'])]).is_file()

records=[]
for job in jobs:
    n,slug=job['n'],job['slug']
    source=sources[n]
    chapter=ROOT/source['manuscript']
    folder=VISUALS/'scenes'/slug
    folder.mkdir()
    master=folder/f'{slug}_v1.png'
    display=folder/f'{slug}_v1_reader.webp'
    shutil.copy2(outputs[str(n)],master)
    with Image.open(master) as image:
        image.load()
        master_size=list(image.size)
        web=image.convert('RGB')
        web.thumbnail((1600,1600),Image.Resampling.LANCZOS)
        web.save(display,'WEBP',quality=87,method=6)
        w,h=web.size
    refs=[{'character_id':c,'reference_set_id':s} for c,s in job['characters']]
    relative=display.relative_to(ROOT).as_posix()
    figure=f'<figure class="chapter-illustration">\n  <img src="../../{relative}" alt="{job["alt"]}" width="{w}" height="{h}" loading="lazy" decoding="async">\n  <figcaption><span>第{n}章</span> {job["caption"]}</figcaption>\n</figure>'
    text=source['text'].replace(job['anchor'],job['anchor']+'\n\n'+figure)
    chapter.write_text(text,encoding='utf-8')
    save_json(folder/'scene.json',{
        'schema_version':1,'scene_id':slug,'chapter_number':n,
        'chapter_label':source['text'].splitlines()[0].removeprefix('# '),
        'title':job['title'],'character_refs':refs,'item_ids':[],
        'location_id':'qingya_city' if n==73 else None,
        'camera':job['ratio']+' narrative composition',
        'action_description':job['alt'],'mood':'克制，保留生活尺度與行動代價',
        'display_asset':{'path':display.relative_to(VISUALS).as_posix(),'sha256':sha(display),'media_type':'image/webp'},
    })
    records.append({
        'chapter':n,'manuscript':source['manuscript'],'source_manuscript_sha256':source['sha256'],
        'inserted_after':job['anchor'],'alt':job['alt'],'caption':job['caption'],
        'master':master.relative_to(ROOT).as_posix(),'master_sha256':sha(master),'master_size':master_size,
        'display':relative,'display_sha256':sha(display),'display_size':[w,h],'display_bytes':display.stat().st_size,
        'generated_source':outputs[str(n)],'character_refs':refs,
        'reference_files':[{'path':Path(p).relative_to(ROOT).as_posix(),'sha256':sha(Path(p))} for p in job['refs']],
        'generation_mode':'built-in image_gen',
    })
save_json(BATCH/'delivery.json',records)
print(json.dumps([{'chapter':r['chapter'],'size':r['display_size'],'bytes':r['display_bytes']} for r in records],indent=2))

import hashlib, json, re
from pathlib import Path
from PIL import Image

BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[2]
records=json.loads((BATCH/'delivery.json').read_text(encoding='utf-8'))
sources={s['chapter']:s for s in json.loads((BATCH/'source_manuscripts.json').read_text(encoding='utf-8'))}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def without_figures(text): return re.sub(r'\s+','',re.sub(r'<figure\b.*?</figure>','',text,flags=re.S))

for record in records:
    chapter=ROOT/record['manuscript']
    current=chapter.read_text(encoding='utf-8')
    original=sources[record['chapter']]['text']
    assert without_figures(current)==without_figures(original), chapter
    figures=re.findall(r'<figure\b.*?</figure>',current,flags=re.S)
    assert len(figures)==1
    figure=figures[0]
    assert current.index(record['inserted_after']) < current.index(figure)
    assert record['display'] in figure and 'loading="lazy"' in figure and 'decoding="async"' in figure
    for key in ('master','display'):
        path=ROOT/record[key]
        assert path.is_file() and sha(path)==record[key+'_sha256']
        with Image.open(path) as image: assert list(image.size)==record[key+'_size']
    assert f'width="{record["display_size"][0]}"' in figure
    assert f'height="{record["display_size"][1]}"' in figure
    print(f'chapter {record["chapter"]}: PASS')

for chapter in (ROOT/'manuscript').rglob('*.md'):
    for source in re.findall(r'<img[^>]*src="([^"]+)"',chapter.read_text(encoding='utf-8')):
        if not source.startswith(('http:','https:','data:')):
            assert (chapter.parent/source).resolve().is_file(), (chapter,source)
print('All manuscript image paths exist.')

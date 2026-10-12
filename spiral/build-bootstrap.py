"""Manual startup-sample builder. Requires ffmpeg/ffprobe only for rebuilding.
Normal playback needs neither Python nor ffmpeg. Run from the repository root.
"""
import concurrent.futures
import hashlib
import json
import random
import string
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'bootstrap-clips'
OUT.mkdir(exist_ok=True)

def get(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.load(response)

def build(identifier):
    temporary = None
    try:
        data = get('https://archive.org/metadata/' + urllib.parse.quote(identifier))
        meta = data.get('metadata', {})
        if data.get('is_dark') or meta.get('access-restricted-item') == 'true': return
        files = sorted((f for f in data.get('files', []) if f.get('name','').endswith('.mp4') and not f.get('private') and 65000 < int(f.get('size') or 0) <= 3*1024*1024), key=lambda f:int(f['size']))
        if not files: return
        f = files[0]
        # Don't deliberately bundle adult-themed material in the startup sample.
        if any(word in (meta.get('title','')+' '+f['name']).lower() for word in ('porn', 'masturbation', 'courseboat')): return
        name = hashlib.sha256(identifier.encode()).hexdigest()[:20] + '.mp4'
        temporary = OUT / ('source-' + name)
        url = 'https://' + data['d1'] + data['dir'] + '/' + urllib.parse.quote(f['name'])
        with urllib.request.urlopen(url, timeout=18) as response:
            temporary.write_bytes(response.read(3*1024*1024+1))
        duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(temporary)], timeout=8))
        if not 4 <= duration <= 60: return
        target = OUT / name
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(temporary),'-t','20','-map','0:v:0','-map','0:a:0?','-vf','scale=320:320:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=15','-c:v','libx264','-preset','veryfast','-crf','32','-maxrate','200k','-bufsize','400k','-pix_fmt','yuv420p','-c:a','aac','-b:a','24k','-ac','1','-movflags','+faststart',str(target)],check=True,timeout=30)
        return dict(id=identifier,title=meta.get('title',identifier),filename=f['name'],bytes=target.stat().st_size,duration=min(duration,20),source='https://archive.org/details/'+identifier,license=meta.get('licenseurl') or meta.get('rights'),urls=['./bootstrap-clips/'+name])
    except Exception: return None
    finally:
        if temporary: temporary.unlink(missing_ok=True)

if __name__ == '__main__':
    ids = set()
    for prefix in random.sample(string.ascii_lowercase+string.digits, 8):
        try:
            query=urllib.parse.urlencode({'q':f'mediatype:movies AND NOT access-restricted-item:true AND identifier:{prefix}*','output':'json','rows':40,'fl[]':'identifier','sort[]':'identifier asc','page':random.randint(1,15)})
            ids.update(d['identifier'] for d in get('https://archive.org/advancedsearch.php?'+query)['response']['docs'])
        except Exception: pass
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        items = [item for item in pool.map(build, ids) if item]
    items.sort(key=lambda item:item['bytes'])
    if len(items) >= 10:
        (ROOT/'bootstrap-videos.json').write_text(json.dumps(items[:24],ensure_ascii=False,separators=(',',':')))
        print(f'{min(len(items),24)} verified startup clips saved; copy the catalog and bootstrap-clips to dreamachine too.')
    else:
        print('Not enough verified files: existing catalog preserved.')

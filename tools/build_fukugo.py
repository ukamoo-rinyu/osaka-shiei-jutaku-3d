"""3Dマップ（index.html）に、市営住宅と同じ建物に入っているとみられる市有施設（複合）を埋め込む。

    python3 tools/build_fukugo.py data/shiei_fukugo_kokyo.csv

CSV は tools/fukugo_match.py で作る（住棟と施設の組ごとの行）。
index.html の <script id="fukugo"> を作り直す（なければ契約議案データの後ろに足す）。
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    src = Path(sys.argv[1])
    e = {}
    with open(src, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            # e["区|住棟"]=[[施設名, 施設の種類, 確度(a/b/c), 施設の所在地, 建物までの距離m], …]
            e.setdefault(r['区'] + '|' + r['住棟'], []).append(
                [r['施設名'], r['施設の種類'], r['確度'], r['施設の所在地'], int(r['建物までの距離m'])])
    for l in e.values():
        l.sort(key=lambda x: (x[2], x[0]))
    data = json.dumps({'src': src.name, 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="fukugo" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="fukugo"' in s:
        s = re.sub(r'<script id="fukugo" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="keiyaku"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 住棟 {len(e)} に複合施設 {sum(map(len, e.values()))} 件を埋め込み')


if __name__ == '__main__':
    main()

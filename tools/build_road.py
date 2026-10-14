"""3Dマップ（index.html）に、住宅（団地）のまわりの道路の幅を埋め込む。

    python3 tools/build_road.py data/shiei_road_width.csv

CSV は tools/road_match.py で作る（住宅ごとの行）。
index.html の <script id="road"> を作り直す（なければ複合施設データの後ろに足す）。
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    src = Path(sys.argv[1])
    e = {}
    with open(src, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if not r['最も広い道路m']:
                continue
            # e["区|住宅"]=[最も広い道路m, 最も狭い道路m, まわりの道路の幅（広い順、実測でないものは「（区分…）」つき）]
            e[r['区'] + '|' + r['住宅（団地）']] = [float(r['最も広い道路m']), float(r['最も狭い道路m']), r['まわりの道路の幅m'].split(' ')]
    data = json.dumps({'src': src.name, 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="road" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="road"' in s:
        s = re.sub(r'<script id="road" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="fukugo"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 住宅 {len(e)} のまわりの道路の幅を埋め込み')


if __name__ == '__main__':
    main()

"""3Dマップ（index.html）に、市営住宅一覧（各区別）の「交通機関」欄（最寄り駅・バス停と徒歩分）を埋め込む。

    python3 tools/build_kotsu.py data/shiei_jutaku_kotsu_R080701.csv 令和8年7月1日現在

CSV は住宅（団地）ごとの行（tools/kotsu_r080701_transcribed.py で作る）。「住宅（団地）」が空の行は使わない。
index.html の <script id="kotsu"> を作り直す（なければ募集データの後ろに足す）。
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    src, date = Path(sys.argv[1]), sys.argv[2]
    e = {}
    with open(src, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if not r['住宅（団地）']:
                continue
            # [[駅・停留所（バス停は「バス 」で始まる）, 徒歩分], …]（一覧に書かれた順）
            l = []
            for s in filter(None, r['交通機関（一覧の記載）'].split('／')):
                m = re.fullmatch(r'(.+) 徒歩約(\d+)分', s)
                l.append([m.group(1), int(m.group(2))])
            e[r['区'] + '|' + r['住宅（団地）']] = l
    data = json.dumps({'d': date, 'src': src.name, 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="kotsu" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="kotsu"' in s:
        s = re.sub(r'<script id="kotsu" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="boshu"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 住宅 {len(e)} の交通機関を埋め込み（{date}）')


if __name__ == '__main__':
    main()

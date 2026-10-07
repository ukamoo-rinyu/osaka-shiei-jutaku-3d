"""3Dマップ（index.html）に、市営住宅一覧（各区別）の入居募集対象空家の数を埋め込む。

    python3 tools/build_boshu.py data/shiei_jutaku_boshu_R080701.csv 令和8年7月1日現在

CSV は住宅（団地）ごとの行。「住宅（団地）」が空の行（対応不明）は使わない。
index.html の <script id="boshu"> を作り直す（なければ区界データの後ろに足す）。
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
            n = lambda k: int(r[k] or 0)
            # [管理戸数, 入居手続中等, 募集中, 募集準備中]
            e[r['区'] + '|' + r['住宅（団地）']] = [n('管理戸数'), n('入居手続中等'), n('募集中'), n('募集準備中')]
    data = json.dumps({'d': date, 'src': src.name, 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="boshu" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="boshu"' in s:
        s = re.sub(r'<script id="boshu" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="wards"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 住宅 {len(e)} の入居募集対象空家を埋め込み（{date}）')


if __name__ == '__main__':
    main()

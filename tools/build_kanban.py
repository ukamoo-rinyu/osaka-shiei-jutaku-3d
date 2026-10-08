"""3Dマップ（index.html）に、建築計画のお知らせ看板（市営住宅の建替とみられるもの）を埋め込む。

    python3 tools/build_kanban.py data/kanban_shiei_kdb.csv

CSV の「対応する住宅（マップ）」が空の行は使わない。住宅（団地）ごとに看板をまとめ、
index.html の <script id="kanban"> を作り直す（なければ入居募集のデータの後ろに足す）。
看板が「進行中」かどうか（届出から3年以内、または完成予定がまだ先）は、地図を開いた日で判定する。
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    src = Path(sys.argv[1])
    e = {}
    with open(src, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            g = r['対応する住宅（マップ）']
            if not g:
                continue
            ku = re.search(r'大阪市(.+?区)', r['建築場所']).group(1)
            # [届出日, 件名, 地上階数, 着工予定, 完成予定]
            e.setdefault(ku + '|' + g, []).append([r['届出日'], r['件名（看板）'], int(r['地上階数'] or 0), r['着工予定'], r['完成予定']])
    data = json.dumps({'src': '建築計画のお知らせ看板情報（kdb.tokyo 大阪）', 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="kanban" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="kanban"' in s:
        s = re.sub(r'<script id="kanban" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="boshu"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 看板 {sum(len(v) for v in e.values())} 件（住宅 {len(e)}）を埋め込み')


if __name__ == '__main__':
    main()

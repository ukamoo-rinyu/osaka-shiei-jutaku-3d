"""3Dマップ（index.html）に、大阪市会に出された市営住宅の建設工事請負契約の議案を埋め込む。

    python3 tools/build_keiyaku.py data/shiei_keiyaku_gikai.csv

CSV は契約ごとの行（議案のPDFから写したもの）。「対応する住宅（マップ）」が空の行は使わない。
index.html の <script id="keiyaku"> を作り直す（なければ看板のデータの後ろに足す）。
地図では、建築計画の看板より新しい情報として優先する（しゅん工期限がまだ先なら「建替工事中・予定」）。
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
            ku = re.search(r'大阪市(.+?区)', r['工事場所']).group(1)
            name = r['工事名'] + (f"（{r['契約の区分']}）" if r['契約の区分'] else '')
            # [提出日, 市会, 議案, 工事名, 工事概要, 契約の相手方, 契約金額, しゅん工期限, 種別]
            e.setdefault(ku + '|' + g, []).append([r['提出日'], r['市会'], r['議案'], name, r['工事概要'], r['契約の相手方'],
                                                  int(r['契約金額（円）']), r['しゅん工期限'], r['種別']])
    for v in e.values():
        v.sort(key=lambda x: x[0], reverse=True)
    data = json.dumps({'src': '大阪市会 議案（建設工事請負契約締結・一部変更）', 'e': e}, ensure_ascii=False, separators=(',', ':'))
    tag = f'<script id="keiyaku" type="application/json">{data}</script>'
    p = ROOT / 'index.html'
    s = p.read_text(encoding='utf-8')
    if '<script id="keiyaku"' in s:
        s = re.sub(r'<script id="keiyaku" type="application/json">.*?</script>', lambda m: tag, s, count=1, flags=re.S)
    else:
        i = s.index('</script>', s.index('<script id="kanban"')) + len('</script>')
        s = s[:i] + '\n' + tag + s[i:]
    p.write_text(s, encoding='utf-8')
    print(f'index.html: 契約 {sum(len(v) for v in e.values())} 件（住宅 {len(e)}）を埋め込み')


if __name__ == '__main__':
    main()

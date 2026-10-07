"""確認・報告ページ（check.html）を作り直す。

住棟マスタ（data/shiei_jutaku_master.csv）を更新したあとに実行すると、
号館と建物の対応が最新の内容になる。

    python3 tools/build_check_page.py [GoogleフォームのURL]

- 号館・建物の対応：data/shiei_jutaku_master.csv
- 住宅の敷地の点線：index.html に埋め込まれた住宅（団地）の形
- 周りのPLATEAU建物：check.html（なければ tools/danchi_check.html）に埋め込まれたもの
- GoogleフォームのURL：引数で指定する。省略したときは今の check.html の設定を引き継ぐ
"""
import csv, datetime, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RE = re.compile(r'<script id="data" type="application/json">(.*?)</script>', re.S)


def embedded(path):
    return json.loads(DATA_RE.search(path.read_text(encoding='utf-8')).group(1))


def main():
    out = ROOT / 'check.html'
    src = out if out.exists() else ROOT / 'tools' / 'danchi_check.html'
    old = embedded(src)
    buildings = old['b']
    bix = {b[0]: i for i, b in enumerate(buildings)}
    old_no = {m['n']: m.get('no') for e in old['e'] for m in e['mem']}

    form_url = sys.argv[1] if len(sys.argv) > 1 else ''
    if not form_url and out.exists():
        m = re.search(r"const FORM_URL='([^']*)'", out.read_text(encoding='utf-8'))
        form_url = m.group(1) if m else ''

    sites = {(f['properties']['k'], f['properties']['g']): f['geometry']
             for f in embedded(ROOT / 'index.html')['e']['features']}

    estates = {}
    with open(ROOT / 'data' / 'shiei_jutaku_master.csv', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            ids = r['PLATEAU建物ID'].split()
            missing = [i for i in ids if i not in bix]
            if missing:
                sys.exit(f'{r["住宅名"]}: 建物 {missing} が建物データにありません')
            name = r['住宅名']
            no = old_no.get(name)
            if not no:
                rest = unicodedata.normalize('NFKC', name[len(r['団地']):] if name.startswith(r['団地']) else name)
                no = re.sub(r'号館$|号棟$|棟$', '', rest) or '?'
            num = lambda v: int(float(v)) if v else None
            pt = None if ids else [round(float(r['経度']), 6), round(float(r['緯度']), 6)]
            # 3Dマップに表示している内容（疑問の報告で、いまの値として見せる）
            fmt = lambda v, unit='': (f'{float(v):g}{unit}' if v else '')
            at = [['戸数', fmt(r['戸数'], '戸')], ['建設年度', fmt(r['建設年度'], '年度')], ['耐震性', r['耐震性']],
                  ['活用手法', r['活用手法'] or 'R8計画に記載なし'], ['所在地', r['所在地']], ['高さ', fmt(r['高さm（最大）'], ' m')],
                  ['地上階数', fmt(r['地上階数（PLATEAU）'], '階')], ['構造', r['構造']], ['浸水深（最大）', fmt(r['浸水深_最大m'], ' m')]]
            estates.setdefault((r['区'], r['団地']), []).append(
                {'n': name, 'no': no, 'u': num(r['戸数']), 'y': num(r['建設年度']), 'b': [bix[i] for i in ids], 'pt': pt,
                 'at': [x for x in at if x[1]]})

    E = []
    for (k, g), mem in estates.items():
        mem.sort(key=lambda m: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', unicodedata.normalize('NFKC', m['n']))])
        xs, ys = [], []
        for m in mem:
            for i in m['b']:
                f = buildings[i][3]
                x, y = f[0], f[1]
                xs.append(x); ys.append(y)
                for j in range(2, len(f), 2):
                    x += f[j]; y += f[j + 1]
                    xs.append(x); ys.append(y)
            if m['pt']:
                xs.append(m['pt'][0] * 1e6); ys.append(m['pt'][1] * 1e6)
        site = sites.get((k, g))
        if site:
            rings = site['coordinates'] if site['type'] == 'Polygon' else [r for p in site['coordinates'] for r in p]
            xs += [p[0] * 1e6 for r in rings for p in r]; ys += [p[1] * 1e6 for r in rings for p in r]
        pad = 300  # 1e-6度単位（約30m）の余白
        bb = [round((min(xs) - pad) / 1e6, 6), round((min(ys) - pad) / 1e6, 6), round((max(xs) + pad) / 1e6, 6), round((max(ys) + pad) / 1e6, 6)]
        E.append({'k': k, 'g': g, 'bb': bb, 'site': site, 'mem': mem})

    data = {'v': datetime.date.today().isoformat(), 'e': E, 'b': buildings}
    html = (ROOT / 'tools' / 'check_page_template.html').read_text(encoding='utf-8')
    html = html.replace('__FORM_URL__', form_url.replace("'", '%27'))
    html = html.replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
    out.write_text(html, encoding='utf-8')
    print(f'{out.name}: 住宅 {len(E)}・号館 {sum(len(e["mem"]) for e in E)}・建物 {len(buildings)}・フォーム {"設定あり" if form_url else "未設定"}')


if __name__ == '__main__':
    main()

"""住宅（団地）の敷地のまわりの道路の幅を、osaka-road-width の道路データから拾って CSV に書き出す。

    python3 tools/road_match.py ../osaka-road-width/docs/layers.js data/shiei_road_width.csv

道路データは国土数値情報 N13（大阪市の道路中心線）に、基盤地図情報の道路縁から実測した幅
（w_measured：歩道を含む全幅の中央値）を足したもの。実測できなかった道路は N13 の幅員区分を使う。

敷地は 3Dマップの点線（同じ住宅名の住棟を囲んだ目安）なので、実際の敷地境界より内側にあることが多い。
そこで「点線から 12m＋道路の幅の半分」以内を通る道路を、敷地に接する道路とみなす（中心線なので幅の半分を足す）。
同じ道路が細切れになっているので、幅を 0.5m 単位に丸めて重複をまとめる。
"""
import csv, json, math, re, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAP = 12.0  # 点線から道路の端までの許容距離（m）
# N13 の幅員区分（N13_006）→ 代表の幅（m）と表示
N13W = {'1': (2.5, '3m未満'), '2': (4.0, '3〜5.5m'), '3': (8.0, '5.5〜13m'), '4': (15.0, '13〜19.5m'), '5': (25.0, '19.5m以上')}
LAT0 = 34.67
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110540


def xy(c):
    return (c[0] * KX, c[1] * KY)


def seg_d(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ((dx * dx + dy * dy) or 1)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def cross(a, b, c, d):
    o = lambda p, q, r: (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return o(a, b, c) * o(a, b, d) < 0 and o(c, d, a) * o(c, d, b) < 0


def inside(p, ring):
    c = False
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i], ring[i - 1]
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1:
            c = not c
    return c


def dist(a, b, rings):
    """道路の線分 a-b と敷地（外周の配列）の距離。重なれば 0"""
    if any(inside(a, r) or inside(b, r) for r in rings):
        return 0.0
    best = 1e9
    for r in rings:
        for i in range(len(r)):
            c, d = r[i - 1], r[i]
            if cross(a, b, c, d):
                return 0.0
            best = min(best, seg_d(a, c, d), seg_d(b, c, d), seg_d(c, a, b), seg_d(d, a, b))
    return best


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    s = src.read_text(encoding='utf-8')
    roads = json.JSONDecoder().raw_decode(s[s.index('{'):])[0]['layer_0']['features']
    # 道路の線分を 100m のマスに入れておく
    CELL = 100.0
    grid = defaultdict(list)
    segs = []
    for f in roads:
        p = f['properties']
        if p.get('w_measured'):
            w, how = round(p['w_measured'] * 2) / 2, '実測'
        elif p.get('N13_006') in N13W:
            w, how = N13W[p['N13_006']][0], '区分' + N13W[p['N13_006']][1]
        else:
            continue
        g = f['geometry']
        lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for ln in lines:
            pts = [xy(c) for c in ln]
            for a, b in zip(pts, pts[1:]):
                k = len(segs)
                segs.append((a, b, w, how))
                for cx in range(int(min(a[0], b[0]) // CELL), int(max(a[0], b[0]) // CELL) + 1):
                    for cy in range(int(min(a[1], b[1]) // CELL), int(max(a[1], b[1]) // CELL) + 1):
                        grid[cx, cy].append(k)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    D = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S).group(1))
    rows = []
    for e in D['e']['features']:
        p, g = e['properties'], e['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        rings = [[xy(c) for c in poly[0]] for poly in polys]
        xs = [q[0] for r in rings for q in r]
        ys = [q[1] for r in rings for q in r]
        m = GAP + 15  # 広い道路の幅の半分ぶんも見る
        cand = set()
        for cx in range(int((min(xs) - m) // CELL), int((max(xs) + m) // CELL) + 1):
            for cy in range(int((min(ys) - m) // CELL), int((max(ys) + m) // CELL) + 1):
                cand.update(grid.get((cx, cy), ()))
        hit = {}
        for k in cand:
            a, b, w, how = segs[k]
            if dist(a, b, rings) <= GAP + w / 2:
                # 幅ごとに1件（実測を優先）
                if w not in hit or hit[w] != '実測':
                    hit[w] = how
        ws = sorted(hit, reverse=True)
        rows.append({'区': p['k'], '住宅（団地）': p['g'],
                     '最も広い道路m': ws[0] if ws else '', '最も狭い道路m': ws[-1] if ws else '',
                     'まわりの道路の幅m': ' '.join(f'{w:g}' + ('' if hit[w] == '実測' else '（' + hit[w] + '）') for w in ws)})
    rows.sort(key=lambda r: (r['区'], r['住宅（団地）']))
    with open(out, 'w', encoding='utf-8-sig', newline='') as fo:
        w = csv.DictWriter(fo, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f'{out}: 住宅 {len(rows)}（道路が見つからない {sum(1 for r in rows if not r["最も広い道路m"])}）')


if __name__ == '__main__':
    main()

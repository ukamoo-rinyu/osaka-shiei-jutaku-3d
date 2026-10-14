"""市営住宅の住棟と、公共施設マップ（osaka-facilities-v2）の市有施設を突き合わせ、
同じ建物に入っているとみられる施設（複合）を CSV に書き出す。

    python3 tools/fukugo_match.py ../osaka-facilities-v2/facilities.json data/shiei_fukugo_kokyo.csv

施設の位置（緯度経度）は住所から「番」の単位で置かれていることが多く、距離だけでは決められない。
そこで住所と距離を組み合わせて確度を3段階にする：
  a：住所が「号」まで住棟と一致
  b：住所が「番」まで一致し、施設の位置が住棟の建物から30m以内
  c：住所が「番」まで一致し、80m以内（同じ街区の別の建物の可能性もある。要確認）
公園・霊園・渡船場など屋外の施設や、駅の自転車駐車場の管理事務所は除く。
施設1つにつき、いちばん確からしい住棟1つ（号まで一致なら一致した住棟すべて）に結びつける。
"""
import csv, json, math, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {'公園付帯施設', '霊園施設', '測定局・観測局', '渡船施設', '自転車管理事務所'}


def norm(a):
    """「大阪市大正区千島3-9-4」「大正区千島３丁目９番４号」→「大正区千島3-9-4」"""
    a = unicodedata.normalize('NFKC', a or '').replace(' ', '').replace('大阪府', '').replace('大阪市', '')
    a = re.sub(r'[−ー―‐－]', '-', a)
    a = re.sub(r'(\d+)丁目', r'\1-', a)
    a = re.sub(r'(\d+)番地?', r'\1-', a)
    a = re.sub(r'(\d+)号', r'\1', a)
    return re.sub(r'-+', '-', a).rstrip('-')


def gou(a):
    """号まで（部屋番号「-101」などは落とす）"""
    m = re.match(r'(.*?\D)(\d+)-(\d+)-(\d+)', a)
    return m and m.group(0)


def ban(a):
    m = re.match(r'(.*?\D)(\d+)-(\d+)', a)
    return m and m.group(0)


def dist(x, y, ring):
    """点から建物の外周までの距離（m）。中なら0"""
    inside = False
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i], ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    if inside:
        return 0.0
    kx, ky, best = 111320 * math.cos(math.radians(y)), 110540, 1e9
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i - 1], ring[i]
        ax, ay, bx, by = (x1 - x) * kx, (y1 - y) * ky, (x2 - x) * kx, (y2 - y) * ky
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, -(ax * dx + ay * dy) / ((dx * dx + dy * dy) or 1)))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def ring_of(f):
    g = f['geometry']
    if g['type'] == 'Polygon':
        return g['coordinates'][0]
    lon, lat = g['coordinates']  # 推定位置の住棟：位置を中心に14m角（地図と同じ）
    dx, dy = 7 / (111320 * math.cos(math.radians(lat))), 7 / 110574
    return [[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]]


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    s = (ROOT / 'index.html').read_text(encoding='utf-8')
    D = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', s, re.S).group(1))
    H = [(f['properties'], ring_of(f), norm(f['properties'].get('a'))) for f in D['b']['features'] + D['p']['features']]
    F = json.loads(src.read_text(encoding='utf-8-sig'))
    rows = []
    for f in F:
        if f['useDetail'] in SKIP or not f.get('lat') or f.get('ward') == '市外':
            continue
        fa = norm(f['addr'])
        exact, near = [], []
        for p, ring, ha in H:
            if p['k'] != f['ward'] or not ha:
                continue
            d = dist(f['lng'], f['lat'], ring)
            if gou(fa) and gou(fa) == gou(ha):
                exact.append((d, p))
            elif ban(fa) and ban(fa) == ban(ha) and d <= 80:
                near.append((d, p))
        if exact:
            # 建物がいくつかに分かれている号館は、いちばん近い部分の距離で1件にする
            best = {}
            for d, p in exact:
                if p['n'] not in best or d < best[p['n']][0]:
                    best[p['n']] = (d, p)
            hits = [('a', d, p) for d, p in best.values()]
        elif near:
            d, p = min(near, key=lambda x: x[0])
            hits = [('b' if d <= 30 else 'c', d, p)]
        else:
            continue
        for lv, d, p in hits:
            rows.append({'区': p['k'], '住宅（団地）': p['g'], '住棟': p['n'], '住棟の所在地': p.get('a') or '',
                         '確度': lv, '施設名': f['name'], '施設の種類': f['useDetail'], '施設の分類': f['use'],
                         '施設の所在地': f['addr'], '延床面積㎡': f.get('area') or '', '施設の建築年': f.get('year') or '',
                         '所管': (f.get('manager') or '').replace('　', ' '), '建物までの距離m': round(d),
                         '公共施設マップのid': f['id']})
    rows.sort(key=lambda r: (r['区'], r['住宅（団地）'], r['住棟'], r['確度'], r['施設名']))
    with open(out, 'w', encoding='utf-8-sig', newline='') as fo:
        w = csv.DictWriter(fo, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    c = {k: sum(r['確度'] == k for r in rows) for k in 'abc'}
    print(f'{out}: {len(rows)} 件（a {c["a"]}・b {c["b"]}・c {c["c"]}）／住棟 {len({(r["区"], r["住棟"]) for r in rows})}')


if __name__ == '__main__':
    main()

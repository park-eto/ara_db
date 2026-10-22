"""Sync Google Sheets data into data/*.json and data/underdark_all.js
Preserves all existing .webp image paths and formatting.

Sheet ID: 1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))

from stats import extract_stats

DATA_DIR = ROOT / 'data'
IMG_DIR = ROOT / 'assets'
SHEET_ID = '1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi'

CAT_MAP = {
    '주 무기': 'weapon', '주무기': 'weapon',
    '보조 무기': 'sub', '보조무기': 'sub',
    '투구': 'helmet', '반지': 'ring', '기타': 'etc'
}
USAGE_MAP = {'추천': 'O', '상황별': '△', '비추천': 'X', '최악': 'XX'}
GRADE_ORDER = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-',
               'D+', 'D', 'D-', 'E+', 'E', 'E-', 'F+', 'F', 'F-']
STAT_TO_TAG = {
    'execute': '처형', 'execute_slowed': '처형', 'execute_air': '처형', 'execute_hp': '처형',
    'stun_chance': '스턴', 'slow': '이감', 'slow_chance': '이감', 'air_slow': '이감',
    'splash': '스플', 'hero_hp': '영체', 'hero_hp_flat': '영체', 'hero_atk': '영공',
    'all_atk': '영공', 'hero_crit_dmg': '영치피', 'hero_crit_rate': '영치확',
    'tower_atk_mult': '타공', 'tower_atk': '타공', 'tower_aura': '타공',
    'tower_crit_dmg': '타치피', 'tower_crit_rate': '타치확', 'pickaxe': '곡',
    'immune_bonus': '면역', 'hero_atk_speed': '영공속', 'double_attack': '타수',
    'triple_attack': '타수', 'status_bonus': '상추피', 'projectile': '투사체',
    'hero_tower_mult': '배수', 'revive_cd': '부활',
}

CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'


def chosung(s: str) -> str:
    out = []
    for ch in s:
        code = ord(ch) - 0xAC00
        if 0 <= code < 11172:
            out.append(CHO[code // 588])
        elif ch.strip():
            out.append(ch.lower())
    return ''.join(out)


def clean(s: str) -> str:
    return re.sub(r'\s+', ' ', (s or '').replace('\n', ' ')).strip()


def norm_key(s: str) -> str:
    return re.sub(r'[\s/·,.\-()★☆\[\]]+', '', s).lower()


def fetch_sheet_csv(sheet_name: str) -> list[list[str]]:
    encoded = urllib.parse.quote(sheet_name)
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={encoded}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    raw = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
    reader = csv.reader(io.StringIO(raw))
    return list(reader)


def sync_heroes(existing_heroes_map: dict[str, dict]) -> list[dict]:
    rows = fetch_sheet_csv('영웅')
    if not rows or len(rows) < 2:
        print("⚠️ Sheet '영웅' is empty or invalid.")
        return []

    headers = [clean(h) for h in rows[0]]
    col_map = {h: i for i, h in enumerate(headers)}

    heroes = []
    for r in rows[1:]:
        if not r or not any(r):
            continue
        def get(col_name):
            idx = col_map.get(col_name)
            return r[idx].strip() if idx is not None and idx < len(r) else ''

        name_raw = get('영웅명')
        if not name_raw:
            continue

        aliases_raw = get('별칭')
        aliases = [a.strip() for a in re.split(r'[,/]', aliases_raw) if a.strip()]

        no_raw = get('No')
        no_val = int(no_raw) if no_raw.isdigit() else None

        grade = get('등급') or '전설'
        tier = get('티어') or None
        ability = get('기본 고유 능력')
        comment = get('평가 및 코멘트')

        levels = {}
        for lv in ('3', '6', '9', '12', '15'):
            col_abil_name = f"{lv}Lv 능력" if lv != '15' else "15Lv+ 능력"
            col_star_name = f"{lv}Lv 추천도" if lv != '15' else "15Lv+ 추천도"
            lv_abil = get(col_abil_name)
            lv_star = get(col_star_name)
            if lv_abil:
                levels[lv] = {
                    'level': int(lv),
                    'ability': lv_abil,
                    'stars': lv_star
                }

        clean_name = norm_key(name_raw)
        img_path = None
        if clean_name in existing_heroes_map:
            img_path = existing_heroes_map[clean_name].get('img')
        if not img_path:
            potential = IMG_DIR / 'heroes' / f"hero_{clean_name}.webp"
            if potential.exists():
                img_path = potential.relative_to(ROOT).as_posix()

        all_text = f"{name_raw} {' '.join(aliases)} {ability} " + ' '.join(l['ability'] for l in levels.values())

        heroes.append({
            'id': f"hero-{no_val if no_val is not None else len(heroes) + 1}",
            'no': no_val,
            'name': name_raw,
            'aliases': aliases,
            'grade': grade,
            'tier': tier,
            'ability': ability,
            'levels': levels,
            'comment': comment or None,
            'img': img_path,
            'search': {
                'name': clean_name,
                'cho': chosung(clean_name),
                'alias': [norm_key(a) for a in aliases],
                'text': norm_key(all_text),
                'comment': norm_key(comment or ''),
            }
        })

    heroes.sort(key=lambda x: x['no'] if x['no'] is not None else 999)
    print(f"Synced {len(heroes)} heroes from Google Sheet.")
    return heroes


def sync_mercenaries(existing_mercs_map: dict[str, dict]) -> list[dict]:
    rows = fetch_sheet_csv('지원용병')
    if not rows or len(rows) < 2:
        return []

    headers = [clean(h) for h in rows[0]]
    col_map = {h: i for i, h in enumerate(headers)}

    mercs = []
    for r in rows[1:]:
        if not r or not any(r):
            continue
        def get(col_name):
            idx = col_map.get(col_name)
            return r[idx].strip() if idx is not None and idx < len(r) else ''

        name = get('용병명')
        if not name:
            continue

        no_raw = get('No')
        grade = get('기본 등급') or '일반'
        rec = get('추천 등급') or None
        ability = get('고유 능력')
        ability = ability.replace('영웅이 공격할 때 공격할 때', '영웅이 공격할 때')
        ability = ability.replace('1%의 확률로 세 번', 'N%의 확률로 세 번')
        ability = ability.replace('공격할 때 1%의 확률로', '공격할 때 N%의 확률로')

        tier_values = {}
        for t in ('B', 'A', 'S', 'SS', 'SSS'):
            val = get(f"{t}티어 효과")
            if val:
                tier_values[t] = val

        clean_name = norm_key(name)
        img_path = None
        if clean_name in existing_mercs_map:
            img_path = existing_mercs_map[clean_name].get('img')
        if not img_path:
            potential = IMG_DIR / 'mercenaries' / f"merc_{clean_name}.webp"
            if potential.exists():
                img_path = potential.relative_to(ROOT).as_posix()

        all_text = f"{name} {ability} " + ' '.join(f"{k}:{v}" for k, v in tier_values.items())

        mercs.append({
            'id': f"merc-{len(mercs) + 1}",
            'name': name,
            'grade': grade,
            'recommend': rec,
            'ability': ability,
            'tierValues': tier_values,
            'img': img_path,
            'search': {
                'name': clean_name,
                'cho': chosung(clean_name),
                'text': norm_key(all_text),
            }
        })

    print(f"Synced {len(mercs)} mercenaries from Google Sheet.")
    return mercs


def sync_mounts(existing_mounts_map: dict[int, dict]) -> tuple[list[dict], dict]:
    rows = fetch_sheet_csv('탈것')
    if not rows or len(rows) < 2:
        return [], {}

    headers = [clean(h) for h in rows[0]]
    col_map = {h: i for i, h in enumerate(headers)}

    mounts = []
    for r in rows[1:]:
        if not r or not any(r):
            continue
        def get(col_name):
            idx = col_map.get(col_name)
            return r[idx].strip() if idx is not None and idx < len(r) else ''

        name = get('탈것 이름')
        if not name:
            continue

        no_raw = get('No')
        no = int(no_raw) if no_raw.isdigit() else len(mounts) + 1
        ability = get('고유 능력')
        comment = get('평가 및 코멘트')

        clean_name = norm_key(name)
        img_path = None
        if no in existing_mounts_map:
            img_path = existing_mounts_map[no].get('img')
        if not img_path:
            potential = IMG_DIR / 'mounts' / f"mount_{no:02d}_{clean_name}.webp"
            if potential.exists():
                img_path = potential.relative_to(ROOT).as_posix()

        all_text = f"{name} {ability} {comment}"

        mounts.append({
            'id': f"mount-{no}",
            'no': no,
            'name': name,
            'ability': ability,
            'comment': comment or None,
            'img': img_path,
            'search': {
                'name': clean_name,
                'cho': chosung(clean_name),
                'text': norm_key(all_text),
                'comment': norm_key(comment or ''),
            }
        })

    mounts.sort(key=lambda x: x['no'])

    sub_rows = fetch_sheet_csv('탈것 부옵션')
    sub_options = {'tower': [], 'hero': [], 'common': []}
    if sub_rows and len(sub_rows) > 1:
        s_headers = [clean(h) for h in sub_rows[0]]
        s_col = {h: i for i, h in enumerate(s_headers)}
        for sr in sub_rows[1:]:
            if not sr or not any(sr):
                continue
            def sget(name):
                idx = s_col.get(name)
                return sr[idx].strip() if idx is not None and idx < len(sr) else ''
            cat = sget('분류')
            no_s = int(sget('순번')) if sget('순번').isdigit() else 1
            opt_name = sget('옵션명')
            rng = sget('수치 범위')
            item = {'no': no_s, 'name': opt_name, 'range': rng}
            if '타워 관련' in cat:
                sub_options['tower'].append(item)
            elif '영웅 관련' in cat:
                sub_options['hero'].append(item)
            else:
                sub_options['common'].append(item)

    print(f"Synced {len(mounts)} mounts and sub-options from Google Sheet.")
    return mounts, sub_options


def sync_pets(existing_pets_map: dict[int, dict], existing_guide: dict) -> tuple[list[dict], dict]:
    rows = fetch_sheet_csv('펫')
    if not rows or len(rows) < 2:
        return [], existing_guide

    headers = [clean(h) for h in rows[0]]
    col_map = {h: i for i, h in enumerate(headers)}

    pets = []
    for r in rows[1:]:
        if not r or not any(r):
            continue
        def get(col_name):
            idx = col_map.get(col_name)
            return r[idx].strip() if idx is not None and idx < len(r) else ''

        name = get('펫 이름')
        if not name:
            continue

        no_raw = get('도감 No')
        no = int(no_raw) if no_raw.isdigit() else len(pets) + 1
        tier = get('티어')
        ability = get('기본 고유 능력')
        drops_raw = get('드랍 및 획득처')
        drops = [d.strip() for d in re.split(r'[,/]', drops_raw) if d.strip()]

        clean_name = norm_key(name)
        img_path = None
        if no in existing_pets_map:
            img_path = existing_pets_map[no].get('img')
        if not img_path:
            potential = IMG_DIR / 'pets' / f"pet_{no:02d}_{clean_name}.webp"
            if potential.exists():
                img_path = potential.relative_to(ROOT).as_posix()

        pets.append({
            'id': f"pet-{no}",
            'no': no,
            'name': name,
            'tier': tier,
            'ability': ability,
            'drops': drops,
            'dropRaw': drops_raw,
            'img': img_path,
            'search': {
                'name': clean_name,
                'cho': chosung(clean_name),
                'text': norm_key(f"{name}{ability}{drops_raw}{tier}"),
                'tier': tier.lower() if tier else '',
                'drops': [norm_key(d) for d in drops],
            }
        })

    pets.sort(key=lambda x: x['no'])
    print(f"Synced {len(pets)} pets from Google Sheet.")
    return pets, existing_guide


def sync_items(existing_items_map: dict[str, dict]) -> list[dict]:
    rows = fetch_sheet_csv('아이템')
    if not rows or len(rows) < 2:
        print("⚠️ Sheet '아이템' is empty or invalid.")
        return []

    headers = [clean(h) for h in rows[0]]
    col_map = {h: i for i, h in enumerate(headers)}

    items = []
    for r in rows[1:]:
        if not r or not any(c.strip() for c in r):
            continue
        def get(col_name):
            idx = col_map.get(col_name)
            return r[idx].strip() if idx is not None and idx < len(r) else ''

        name = get('아이템명')
        if not name:
            continue

        clean_name = norm_key(name)
        existing = existing_items_map.get(clean_name, {})

        cat_raw = clean(get('분류'))
        cat = CAT_MAP.get(cat_raw, existing.get('cat', 'etc'))

        no_raw = get('No')
        no = int(no_raw) if no_raw.isdigit() else existing.get('no', len(items) + 1)

        range_val = get('공격 거리') or existing.get('range') or None
        grade = get('등급') or existing.get('grade') or 'F-'
        tier = get('티어') or existing.get('tier') or None

        usage_label = get('추천') or existing.get('usageLabel') or '비추천'
        usage = USAGE_MAP.get(usage_label, existing.get('usage', 'X'))

        abil_raw = get('기본 고유 능력')
        if abil_raw:
            abilities = [s.strip() for s in abil_raw.splitlines() if s.strip()]
        else:
            abilities = existing.get('abilities', [])

        awakening = {}
        for lv in ('1', '2', '3', '4', '5'):
            a_raw = get(f'{lv}각성 능력')
            if a_raw:
                lines = [s.strip() for s in a_raw.splitlines() if s.strip()]
                if lines:
                    awakening[lv] = lines
        if not awakening and existing.get('awakening'):
            awakening = existing['awakening']

        # Extract stats across base + awakening levels 1..5
        base_stats = extract_stats(abil_raw or ' '.join(abilities))
        per_level = [base_stats]
        known_levels = [0]
        for lv_int in range(1, 6):
            lv_str = str(lv_int)
            txt = ' '.join(awakening.get(lv_str, []))
            if txt:
                cur = dict(per_level[-1] or base_stats)
                for prev in reversed(per_level):
                    if prev is not None:
                        cur = dict(prev)
                        break
                cur.update(extract_stats(txt))
                per_level.append(cur)
                known_levels.append(lv_int)
            elif existing.get('awakeningNote') == '각성 시 주옵션만 성장합니다.':
                per_level.append(dict(base_stats))
                known_levels.append(lv_int)
            else:
                per_level.append(None)

        keys = sorted({k for lvl in per_level if lvl for k in lvl})
        stats = {k: [(lvl.get(k) if lvl is not None else None) for lvl in per_level] for k in keys}
        if not stats and existing.get('stats'):
            stats = existing['stats']
            known_levels = existing.get('knownLevels', [0])

        drops_raw = get('드랍처')
        if drops_raw:
            drops = [s.strip() for s in re.split(r'[,/]', drops_raw) if s.strip()]
        else:
            drops = existing.get('drops', [])

        comment = get('평가 및 코멘트') or existing.get('comment', '')

        tags = dict(existing.get('tags', {}))
        for k in stats:
            tag = STAT_TO_TAG.get(k)
            if tag:
                tags[tag] = True

        img = existing.get('img') or f"assets/items/{cat}_{no:03d}.webp"
        aliases = existing.get('aliases', [])

        text_all = f"{name} {' '.join(aliases)} {' '.join(abilities)} {' '.join(l for ls in awakening.values() for l in ls)} {comment}"

        item_obj = {
            'id': existing.get('id', f"{cat}-{no}"),
            'cat': cat,
            'no': no,
            'name': name,
            'aliases': aliases,
            'range': range_val,
            'abilities': abilities,
            'tags': tags,
            'grade': grade,
            'gradeRank': existing.get('gradeRank', GRADE_ORDER.index(grade) if grade in GRADE_ORDER else 99),
            'tier': tier,
            'usage': usage,
            'usageLabel': usage_label,
            'comment': comment,
            'drops': drops,
            'img': img,
            'stats': stats,
            'knownLevels': known_levels,
            'awakening': awakening,
            'search': {
                'name': clean_name,
                'cho': chosung(clean_name),
                'alias': [norm_key(a) for a in aliases],
                'aliasCho': [chosung(norm_key(a)) for a in aliases],
                'text': norm_key(text_all),
                'comment': norm_key(comment or ''),
                'drops': norm_key(' '.join(drops)),
            }
        }
        if existing.get('awakeningNote'):
            item_obj['awakeningNote'] = existing['awakeningNote']

        items.append(item_obj)

    print(f"Synced {len(items)} items from Google Sheet.")
    return items


def main():
    h_file = DATA_DIR / 'heroes.json'
    existing_heroes = json.loads(h_file.read_text(encoding='utf-8')) if h_file.exists() else []
    h_map = {norm_key(h['name']): h for h in existing_heroes}

    m_file = DATA_DIR / 'mercenaries.json'
    existing_mercs = json.loads(m_file.read_text(encoding='utf-8')) if m_file.exists() else []
    m_map = {norm_key(m['name']): m for m in existing_mercs}

    mt_file = DATA_DIR / 'mounts.json'
    existing_mounts_data = json.loads(mt_file.read_text(encoding='utf-8')) if mt_file.exists() else {}
    mt_map = {m['no']: m for m in existing_mounts_data.get('mounts', [])}

    p_file = DATA_DIR / 'pets.json'
    existing_pet_data = json.loads(p_file.read_text(encoding='utf-8')) if p_file.exists() else {}
    p_map = {p['no']: p for p in existing_pet_data.get('pets', [])}
    p_guide = existing_pet_data.get('guide', {})

    i_file = DATA_DIR / 'items.json'
    existing_items_data = json.loads(i_file.read_text(encoding='utf-8')) if i_file.exists() else {}
    existing_items = existing_items_data.get('items', [])
    i_map = {norm_key(it['name']): it for it in existing_items}

    print(f"Connecting to Google Sheet ({SHEET_ID})...")
    heroes = sync_heroes(h_map)
    mercs = sync_mercenaries(m_map)
    mounts, sub_options = sync_mounts(mt_map)
    pets, guide = sync_pets(p_map, p_guide)
    items = sync_items(i_map)

    # Save to disk
    if heroes:
        (DATA_DIR / 'heroes.json').write_text(json.dumps(heroes, ensure_ascii=False, indent=2), encoding='utf-8')
    if mercs:
        (DATA_DIR / 'mercenaries.json').write_text(json.dumps(mercs, ensure_ascii=False, indent=2), encoding='utf-8')
    if mounts:
        (DATA_DIR / 'mounts.json').write_text(json.dumps({
            'mounts': mounts,
            'subOptions': sub_options
        }, ensure_ascii=False, indent=2), encoding='utf-8')
    if pets:
        (DATA_DIR / 'pets.json').write_text(json.dumps({
            'pets': pets,
            'guide': guide
        }, ensure_ascii=False, indent=2), encoding='utf-8')
    if items:
        existing_items_data['items'] = items
        existing_items_data['generatedAt'] = dt.datetime.now().isoformat(timespec='seconds')
        i_file.write_text(json.dumps(existing_items_data, ensure_ascii=False, indent=2), encoding='utf-8')
        (DATA_DIR / 'items.js').write_text(
            'window.UNDERDARK_DATA=' + json.dumps(existing_items_data, ensure_ascii=False, separators=(',', ':')) + ';',
            encoding='utf-8'
        )

    bundle = {
        'heroes': heroes or existing_heroes,
        'mercenaries': mercs or existing_mercs,
        'mounts': mounts or existing_mounts_data.get('mounts', []),
        'mountSubOptions': sub_options or existing_mounts_data.get('subOptions', {}),
        'pets': pets or existing_pet_data.get('pets', []),
        'petGuide': guide or p_guide,
        'items': items or existing_items,
    }
    (DATA_DIR / 'underdark_all.js').write_text(
        'window.UNDERDARK_EXPANSION=' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';',
        encoding='utf-8'
    )

    print("\n🎉 Google Sheet data successfully synced and saved to items.json, items.js and underdark_all.js!")


if __name__ == '__main__':
    main()

"""Sync Google Sheets data into data/*.json and data/underdark_all.js
Preserves all existing .webp image paths and formatting.

Sheet ID: 1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi
"""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
IMG_DIR = ROOT / 'assets'
SHEET_ID = '1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi'

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

    print(f"Connecting to Google Sheet ({SHEET_ID})...")
    heroes = sync_heroes(h_map)
    mercs = sync_mercenaries(m_map)
    mounts, sub_options = sync_mounts(mt_map)
    pets, guide = sync_pets(p_map, p_guide)

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

    bundle = {
        'heroes': heroes or existing_heroes,
        'mercenaries': mercs or existing_mercs,
        'mounts': mounts or existing_mounts_data.get('mounts', []),
        'mountSubOptions': sub_options or existing_mounts_data.get('subOptions', {}),
        'pets': pets or existing_pet_data.get('pets', []),
        'petGuide': guide or p_guide,
    }
    (DATA_DIR / 'underdark_all.js').write_text(
        'window.UNDERDARK_EXPANSION=' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';',
        encoding='utf-8'
    )

    print("\n🎉 Google Sheet data successfully synced and saved to underdark_all.js!")


if __name__ == '__main__':
    main()

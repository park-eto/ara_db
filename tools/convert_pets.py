"""Extractor for Pets from '언닥-인벤토리-펫.xlsx'

Generates:
  - data/pets.json & assets/pets/*.webp
  - updates data/underdark_all.js (bundled data for static client)
"""
from __future__ import annotations

import collections
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from xlsx_reader import Workbook, idx_to_col  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT / '언닥-인벤토리-펫.xlsx'
DATA_DIR = ROOT / 'data'
IMG_PETS = ROOT / 'assets' / 'pets'

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


def save_image(wb: Workbook, media_path: str, out_path: Path) -> str:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = wb.read_bytes(media_path)
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    im.thumbnail((160, 160), Image.LANCZOS)
    im.save(out_path, 'WEBP', quality=88, method=6)
    rel = out_path.relative_to(ROOT).as_posix()
    return rel


def parse_pets(wb: Workbook):
    sh = wb.sheet('펫')

    # Pictures in col D (4)
    pet_pics = [p for p in sh.pictures if p.col == 4]

    def find_pic_for_row(r):
        candidates = [p for p in pet_pics if p.row == r or (p.row <= r <= p.to_row)]
        if not candidates:
            candidates = [p for p in pet_pics if abs(p.row - r) <= 1]
        if candidates:
            candidates.sort(key=lambda p: p.idx, reverse=True)
            return candidates[0]
        return None

    # 1. Parse 26 Pets (Cols B ~ G)
    pets = []
    for r in range(6, 32):
        no_raw = clean(sh.get(r, 'B'))
        name_raw = clean(sh.get(r, 'C'))
        abil_raw = clean(sh.get(r, 'E'))
        drop_raw = clean(sh.get(r, 'F'))
        tier_raw = clean(sh.get(r, 'G'))

        if not no_raw.isdigit() or not name_raw:
            continue

        no = int(no_raw)
        img = None
        pic = find_pic_for_row(r)
        if pic:
            img_name = f"pet_{no:02d}_{norm_key(name_raw)}.webp"
            img = save_image(wb, pic.media_path, IMG_PETS / img_name)

        # Parse drop locations into clean array
        drops = [d.strip() for d in re.split(r'[,/·]+', drop_raw) if d.strip()]

        all_text = f"{name_raw} {abil_raw} {drop_raw} {tier_raw}"

        pets.append({
            'id': f"pet-{no}",
            'no': no,
            'name': name_raw,
            'tier': tier_raw or 'F',
            'ability': abil_raw,
            'drops': drops,
            'dropRaw': drop_raw,
            'img': img,
            'search': {
                'name': norm_key(name_raw),
                'cho': chosung(norm_key(name_raw)),
                'text': norm_key(all_text),
                'tier': norm_key(tier_raw),
                'drops': [norm_key(d) for d in drops],
            }
        })

    # 2. Parse Pet System Guide (Cols H ~ M)
    # The columns I (grades), K (sub-options), and L (random options) are independent lists.
    grades = []
    for r in range(6, 14):
        g = clean(sh.get(r, 'I'))
        if g:
            grades.append(g)

    # All 5 Sub-options (부옵 5종 - Col K)
    sub_options = []
    for r in range(6, 11):
        opt = clean(sh.get(r, 'K'))
        if opt:
            cat = '타워' if '타워' in opt else '영웅'
            sub_options.append({
                'no': len(sub_options) + 1,
                'name': opt,
                'category': cat
            })

    # All 12 Random Options (랜덤옵 12종 - Col L)
    random_options = []
    for r in range(6, 18):
        opt = clean(sh.get(r, 'L'))
        if opt:
            cat = '타워' if '타워' in opt else '영웅'
            random_options.append({
                'no': len(random_options) + 1,
                'name': opt,
                'category': cat
            })

    # Recommended Builds (추천조합)
    build_tower = {
        'title': '타워 추천 세팅',
        'subOption': '타워의 공격 속도가 n% 상승합니다.',
        'randomOptions': [
            '타워의 공격력이 n 증가합니다.',
            '타워의 공격력이 1+n배로 증가합니다.',
            '타워의 치명타 피해가 n% 증가합니다.',
            '타워의 치명타 확률이 n% 증가합니다.'
        ]
    }

    build_hero = {
        'title': '영덱 추천 세팅',
        'subOption': '영웅의 공격 속도가 n% 증가합니다.',
        'randomOptions': [
            '영웅의 공격력이 n 증가합니다.',
            '영웅의 치명타 피해가 n% 증가합니다.',
            '영웅의 치명타 확률이 n% 증가합니다.',
            '영웅의 공격 속도가 n% 증가합니다.'
        ]
    }

    notes = [
        '협동 던전 1·2, 일일 던전(일반/협동), 길드 던전 1·2(일반/협동) 펫 획득 정보는 시트에 미표기되어 있습니다.'
    ]

    guide = {
        'grades': grades,
        'subOptions': sub_options,
        'randomOptions': random_options,
        'buildTower': build_tower,
        'buildHero': build_hero,
        'notes': notes
    }

    print(f"Extracted {len(pets)} pets and full pet guide.")
    return pets, guide


def main():
    wb = Workbook(str(XLSX_PATH))
    pets, pet_guide = parse_pets(wb)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Save data/pets.json
    (DATA_DIR / 'pets.json').write_text(json.dumps({
        'pets': pets,
        'guide': pet_guide
    }, ensure_ascii=False, indent=2), encoding='utf-8')

    # Update underdark_all.js bundle
    bundle_path = DATA_DIR / 'underdark_all.js'
    bundle_data = {}
    if bundle_path.exists():
        raw = bundle_path.read_text(encoding='utf-8')
        m = re.search(r'window\.UNDERDARK_EXPANSION\s*=\s*(\{.*\});?', raw, re.DOTALL)
        if m:
            try:
                bundle_data = json.loads(m.group(1))
            except Exception as e:
                print("Warning parsing bundle:", e)

    bundle_data['pets'] = pets
    bundle_data['petGuide'] = pet_guide

    bundle_path.write_text(
        'window.UNDERDARK_EXPANSION=' + json.dumps(bundle_data, ensure_ascii=False, separators=(',', ':')) + ';',
        encoding='utf-8'
    )

    print("\n✅ Pet data converted successfully!")


if __name__ == '__main__':
    main()

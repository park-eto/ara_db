"""Extractor for Heroes, Mercenaries, and Mounts from '언닥-영웅, 지원용병, 탈것.xlsx'

Generates:
  - data/heroes.json & assets/heroes/*.webp
  - data/mercenaries.json & assets/mercenaries/*.webp
  - data/mounts.json & assets/mounts/*.webp
  - data/underdark_all.js (bundled data for static client)
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
from xlsx_reader import Workbook, Sheet, idx_to_col  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT / '언닥-영웅, 지원용병, 탈것.xlsx'
DATA_DIR = ROOT / 'data'
IMG_HEROES = ROOT / 'assets' / 'heroes'
IMG_MERC = ROOT / 'assets' / 'mercenaries'
IMG_MOUNTS = ROOT / 'assets' / 'mounts'

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


# ----------------------------------------------------------------------
# 1. PARSE HEROES ('영웅(N)' sheet)
# ----------------------------------------------------------------------
def parse_heroes(wb: Workbook):
    sh = wb.sheet('영웅(N)')

    # Left heroes image col: D (4)
    # Right heroes image col: M (13) or N (14)
    pics_left = [p for p in sh.pictures if p.col == 4]
    pics_right = [p for p in sh.pictures if p.col in (13, 14)]

    def find_hero_pic(r_hero, pics):
        # Anchor row is typically r_hero - 2 (e.g. hero row 14 -> pic anchor row 12)
        candidates = [p for p in pics if (r_hero - 3) <= p.row <= (r_hero + 1)]
        if not candidates:
            return None
        # Sort by idx descending to pick top/latest added anchor
        candidates.sort(key=lambda p: p.idx, reverse=True)
        return candidates[0]

    heroes = []

    def extract_column(col_no_letter, col_grade, col_tier, col_name, col_abil, col_lv, col_add, col_star, col_comment, pics_list):
        r = 12
        while r <= sh.max_row:
            lv_val = clean(sh.get(r, col_lv))
            if lv_val == '3':
                tier_raw = clean(sh.get(r, col_tier))
                grade_raw = clean(sh.get(r, col_grade))
                abil_raw = clean(sh.get(r, col_abil))
                comment = clean(sh.get(r, col_comment))

                name_raw = ''
                for rr in range(r, min(r + 4, sh.max_row + 1)):
                    n = sh.get(rr, col_name)
                    if n and clean(n) not in ('영웅', '이름', '티어'):
                        name_raw = clean(n)
                        break

                if not name_raw:
                    r += 1
                    continue

                name = clean(name_raw)
                aliases = re.findall(r'\(([^)]+)\)', name_raw)
                clean_name = clean(re.sub(r'\([^)]*\)', '', name_raw))
                if not clean_name:
                    clean_name = name

                if not comment:
                    for rr in range(r, min(r + 4, sh.max_row + 1)):
                        c = clean(sh.get(rr, col_comment))
                        if c and c not in ('코멘트',):
                            comment = c
                            break

                levels = {}
                for rr in range(r, min(r + 6, sh.max_row + 1)):
                    lv_str = clean(sh.get(rr, col_lv))
                    add_str = clean(sh.get(rr, col_add))
                    star_str = clean(sh.get(rr, col_star))
                    if lv_str and lv_str.isdigit() and add_str:
                        levels[lv_str] = {
                            'level': int(lv_str),
                            'ability': add_str,
                            'stars': star_str
                        }

                # Hero image
                img = None
                pic = find_hero_pic(r, pics_list)
                if pic:
                    img_name = f"hero_{norm_key(clean_name)}.webp"
                    img = save_image(wb, pic.media_path, IMG_HEROES / img_name)

                all_text = f"{clean_name} {' '.join(aliases)} {abil_raw} " + ' '.join(l['ability'] for l in levels.values())

                heroes.append({
                    'id': f"hero-{len(heroes) + 1}",
                    'name': clean_name,
                    'aliases': [a.strip() for a in aliases if a.strip()],
                    'grade': grade_raw or '전설',
                    'tier': tier_raw or None,
                    'ability': clean(abil_raw),
                    'levels': levels,
                    'comment': comment or None,
                    'img': img,
                    'search': {
                        'name': norm_key(clean_name),
                        'cho': chosung(norm_key(clean_name)),
                        'alias': [norm_key(a) for a in aliases],
                        'text': norm_key(all_text),
                        'comment': norm_key(comment or ''),
                    }
                })
                r += 4
            else:
                r += 1

    # Left side (B~I)
    extract_column('B', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', pics_left)
    # Right side (K~R)
    extract_column('K', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', pics_right)

    print(f"Extracted {len(heroes)} heroes.")
    return heroes


# ----------------------------------------------------------------------
# 2. PARSE MERCENARIES ('지원용병' sheet)
# ----------------------------------------------------------------------
def parse_mercenaries(wb: Workbook):
    sh = wb.sheet('지원용병')

    pics_left = [p for p in sh.pictures if p.col in (4, 5)]
    pics_right = [p for p in sh.pictures if p.col in (15, 16)]

    def find_merc_pic(r_merc, pics):
        candidates = [p for p in pics if (r_merc - 2) <= p.row <= (r_merc + 2)]
        if not candidates:
            return None
        candidates.sort(key=lambda p: p.idx, reverse=True)
        return candidates[0]

    mercs = []

    def extract_side(col_grade, col_rec, col_name, col_pic, col_abil, val_cols, pics_list):
        for r in range(5, sh.max_row + 1):
            name_raw = sh.get(r, col_name)
            grade_raw = sh.get(r, col_grade)
            rec_raw = sh.get(r, col_rec)
            abil_raw = sh.get(r, col_abil)

            if not clean(name_raw) or clean(name_raw) in ('영웅', '이름', '추천', '등급', '추천 설명'):
                continue
            # Skip legend descriptions that might appear in name column
            if any(term in name_raw for term in ('그럭저럭 좋음', '자주 사용함', '최고!')):
                continue

            name = clean(name_raw)
            # Grade stats from subsequent row (r+2 or r+1)
            tier_values = {}
            tiers = ['B', 'A', 'S', 'SS', 'SSS']
            val_row = r + 2
            for i, t in enumerate(tiers):
                col_idx = val_cols[i]
                v = clean(sh.get(val_row, col_idx))
                if v:
                    tier_values[t] = v

            # Picture
            img = None
            pic = find_merc_pic(r, pics_list)
            if pic:
                img_name = f"merc_{norm_key(name)}.webp"
                img = save_image(wb, pic.media_path, IMG_MERC / img_name)

            all_text = f"{name} {abil_raw} " + ' '.join(f"{k}:{v}" for k, v in tier_values.items())

            mercs.append({
                'id': f"merc-{len(mercs) + 1}",
                'name': name,
                'grade': clean(grade_raw) or '일반',
                'recommend': clean(rec_raw) or None,
                'ability': clean(abil_raw),
                'tierValues': tier_values,
                'img': img,
                'search': {
                    'name': norm_key(name),
                    'cho': chosung(norm_key(name)),
                    'text': norm_key(all_text),
                }
            })

    # Left: cols (B=grade, C=rec, D=name, E=pic, F=abil, vals=[G, H, I, J, K])
    extract_side('B', 'C', 'D', 'E', 'F', [7, 8, 9, 10, 11], pics_left)
    # Right: cols (M=grade, N=rec, O=name, P=pic, Q=abil, vals=[R, S, T, U, V])
    extract_side('M', 'N', 'O', 'P', 'Q', [18, 19, 20, 21, 22], pics_right)

    print(f"Extracted {len(mercs)} mercenaries.")
    return mercs


# ----------------------------------------------------------------------
# 3. PARSE MOUNTS ('탈것' sheet)
# ----------------------------------------------------------------------
def parse_mounts(wb: Workbook):
    sh = wb.sheet('탈것')

    pics_left = {p.row: p for p in sh.pictures if p.col in (3, 4)}
    pics_right = {p.row: p for p in sh.pictures if p.col in (8, 9)}

    mounts = []

    def extract_side(col_no, col_pic, col_name, col_abil, col_comment, pics_map):
        for r in range(23, 53):
            no_raw = clean(sh.get(r, col_no))
            name_raw = clean(sh.get(r, col_name))
            abil_raw = clean(sh.get(r, col_abil))
            comment_raw = clean(sh.get(r, col_comment))

            if not no_raw.isdigit() or not name_raw:
                continue

            no = int(no_raw)
            img = None
            pic = pics_map.get(r)
            if pic:
                img_name = f"mount_{no:02d}_{norm_key(name_raw)}.webp"
                img = save_image(wb, pic.media_path, IMG_MOUNTS / img_name)

            all_text = f"{name_raw} {abil_raw} {comment_raw}"

            mounts.append({
                'id': f"mount-{no}",
                'no': no,
                'name': name_raw,
                'ability': abil_raw,
                'comment': comment_raw or None,
                'img': img,
                'search': {
                    'name': norm_key(name_raw),
                    'cho': chosung(norm_key(name_raw)),
                    'text': norm_key(all_text),
                    'comment': norm_key(comment_raw or ''),
                }
            })

    # Left: B=No, C=Pic, D=Name, E=Abil, F=Comment
    extract_side('B', 'C', 'D', 'E', 'F', pics_left)
    # Right: G=No, H=Pic, I=Name, J=Abil, K=Comment
    extract_side('G', 'H', 'I', 'J', 'K', pics_right)

    mounts.sort(key=lambda x: x['no'])

    # Extract 3 distinct sub-option categories (Tower, Hero, Common)
    tower_opts = []
    for r in range(55, 63):
        no = clean(sh.get(r, 'B'))
        text = clean(sh.get(r, 'C'))
        rng = clean(sh.get(r, 'F'))
        if text:
            tower_opts.append({
                'no': int(no) if no.isdigit() else len(tower_opts) + 1,
                'name': text,
                'range': rng
            })

    hero_opts = []
    for r in range(55, 71):
        no = clean(sh.get(r, 'G'))
        text = clean(sh.get(r, 'H'))
        rng = clean(sh.get(r, 'K'))
        if r == 65:
            extra = clean(sh.get(66, 'H'))
            if extra:
                text = f"{text} {extra}"
        elif r == 66:
            continue
        if text:
            hero_opts.append({
                'no': int(no) if no.isdigit() else len(hero_opts) + 1,
                'name': text,
                'range': rng
            })

    common_opts = []
    for r in range(65, 73):
        no = clean(sh.get(r, 'B'))
        text = clean(sh.get(r, 'C'))
        rng = clean(sh.get(r, 'F'))
        if r == 71:
            extra = clean(sh.get(72, 'C'))
            if extra:
                text = f"{text} [{extra}]"
        elif r == 72:
            continue
        if text:
            common_opts.append({
                'no': int(no) if no.isdigit() else len(common_opts) + 1,
                'name': text,
                'range': rng
            })

    sub_options = {
        'tower': tower_opts,
        'hero': hero_opts,
        'common': common_opts
    }

    print(f"Extracted {len(mounts)} mounts and {len(tower_opts)} tower, {len(hero_opts)} hero, {len(common_opts)} common sub-options.")
    return mounts, sub_options


def main():
    wb = Workbook(str(XLSX_PATH))

    heroes = parse_heroes(wb)
    mercs = parse_mercenaries(wb)
    mounts, mount_sub_options = parse_mounts(wb)

    # Save individual JSONs
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    (DATA_DIR / 'heroes.json').write_text(json.dumps(heroes, ensure_ascii=False, indent=2), encoding='utf-8')
    (DATA_DIR / 'mercenaries.json').write_text(json.dumps(mercs, ensure_ascii=False, indent=2), encoding='utf-8')
    (DATA_DIR / 'mounts.json').write_text(json.dumps({
        'mounts': mounts,
        'subOptions': mount_sub_options
    }, ensure_ascii=False, indent=2), encoding='utf-8')

    # Bundle into JS for standalone file execution
    bundle = {
        'heroes': heroes,
        'mercenaries': mercs,
        'mounts': mounts,
        'mountSubOptions': mount_sub_options
    }
    (DATA_DIR / 'underdark_all.js').write_text(
        'window.UNDERDARK_EXPANSION=' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';',
        encoding='utf-8'
    )

    print("\n✅ All data converted successfully!")


if __name__ == '__main__':
    main()

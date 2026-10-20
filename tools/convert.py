"""Convert the Underdark Excel sheets into data/items.json + item images.

Usage:  python tools/convert.py
Re-run whenever the Excel files are updated.
"""
from __future__ import annotations

import collections
import datetime as dt
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from xlsx_reader import Workbook, Sheet  # noqa: E402
from stats import STAT_DEFS, extract_stats, unparsed_fragments, normalize_text  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ITEM_XLSX = ROOT / '언닥-인벤토리-아이템_각성.xlsx'
OUT_JSON = ROOT / 'data' / 'items.json'
OUT_IMG = ROOT / 'assets' / 'items'
REPORT = ROOT / 'tools' / 'report.txt'

CATEGORIES = [
    # id, label, main sheet, awakening sheet
    ('weapon', '주 무기', '주 무기', '주 무기(각성)'),
    ('sub', '보조 무기', '보조 무기', '보조 무기(각성)'),
    ('helmet', '투구', '투구', '투구(각성)'),
    ('ring', '반지', '반지', '반지(각성)'),
    ('etc', '기타', '기타', '기타(각성)'),
]

# Tag columns in the sheets (abbreviation -> description)
TAG_DEFS = {
    '관통': '관통 공격', '넉백': '넉백', '처형': '즉시 처형', '스턴': '스턴',
    '이감': '이동 속도 감소', '스플': '스플래시', '자동': '버프 자동 선택',
    '배수': '공격력 배수', '영체': '영웅 체력', '영공': '영웅 공격력',
    '영치피': '영웅 치명타 피해', '영치확': '영웅 치명타 확률', '타공': '타워 공격력',
    '타치피': '타워 치명타 피해', '타치확': '타워 치명타 확률', '상태이상': '상태이상 관련',
    '부활': '부활', '곡': '곡괭이', '면역': '면역 몬스터 추가 피해', '치확': '치명타 확률',
    '영공속': '영웅 공격 속도', '타수': '다중 타격', '영타수': '영웅 다중 타격',
    '상추피': '상태이상 추가 피해', '투사체': '투사체 증가',
}
# stats -> tags, so filters work even when the sheet has no such column
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
TAG_ALIASES = {'상태 이상': '상태이상'}

GRADE_ORDER = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-',
               'D+', 'D', 'D-', 'E+', 'E', 'E-', 'F+', 'F', 'F-']
USAGE = {'O': '추천', '△': '상황별', 'X': '비추천', 'XX': '최악'}

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


def norm_key(s: str) -> str:
    return re.sub(r'[\s/·,.\-()]+', '', s).lower()


def clean(s: str) -> str:
    return normalize_text(s or '')


def split_name(raw: str) -> tuple[str, list[str]]:
    """'빛의 단검\n(빛단)' -> ('빛의 단검', ['빛단'])"""
    aliases = re.findall(r'\(([^)]+)\)', raw)
    name = re.sub(r'\([^)]*\)', ' ', raw)
    name = clean(name.replace('/', ' '))
    return name, [a.strip() for a in aliases if a.strip()]


def ability_lines(raw: str) -> list[str]:
    """Split ability cell into display lines (keeps sentences readable)."""
    if not raw:
        return []
    lines = []
    for part in re.split(r'\n+', raw):
        part = clean(part)
        if not part or part in ('없음.', '없음'):
            continue
        # some cells pack multiple sentences in one line
        for s in re.split(r'(?<=다\.)\s+(?=\S)', part):
            s = s.strip()
            if s:
                lines.append(s)
    # merge continuation lines (no sentence end) into previous sentence
    merged: list[str] = []
    for s in lines:
        if merged and not re.search(r'(다\.?|\]|\)|다\.\s*\[.*\])$', merged[-1]):
            merged[-1] = merged[-1] + ' ' + s
        else:
            merged.append(s)
    return merged


def grade_info(raw: str):
    raw = clean(raw)
    toks = re.findall(r'[SABCDEF][+-]?', raw)
    ranks = [GRADE_ORDER.index(t) for t in toks if t in GRADE_ORDER]
    if not ranks:
        return raw, None, None
    best = min(ranks)
    return raw, best, GRADE_ORDER[best][0]


def find_header(sheet: Sheet) -> tuple[int, dict[str, int]]:
    for r in range(1, 15):
        row = sheet.row_values(r)
        names = {clean(v): c for c, v in row.items()}
        if '순번' in names and '이름' in names:
            return r, names
    raise ValueError(f'header not found in {sheet.name}')


def item_rows(sheet: Sheet, col_no: int) -> list[int]:
    return [r for r in range(1, sheet.max_row + 1) if clean(sheet.get(r, col_no)).isdigit()]


# --------------------------------------------------------------------------
def parse_main(sheet: Sheet, cat_id: str, wb: Workbook, report: list[str]):
    hdr_row, hdr = find_header(sheet)
    c_no, c_name = hdr['순번'], hdr['이름']
    c_abil = hdr.get('능력')
    c_range = hdr.get('근/원')
    c_use = hdr.get('사용여부')
    c_grade = hdr.get('등급')
    c_comment = hdr.get('코멘트')
    c_drop = hdr.get('드랍')
    # tag columns: between 능력 and 사용여부
    tag_cols = {c: TAG_ALIASES.get(n, n) for n, c in hdr.items() if c_abil < c < c_use}

    # main picture per row (largest picture centred in the 사진 column)
    pic_col = hdr.get('사진', c_name - 1)
    pics: dict[int, object] = {}
    for p in sheet.pictures:
        if abs(p.col - pic_col) <= 1:
            if p.row not in pics or p.area > pics[p.row].area:
                pics[p.row] = p

    items = []
    for r in item_rows(sheet, c_no):
        raw_name = sheet.get(r, c_name)
        if not clean(raw_name) or clean(raw_name) == '이름':
            continue
        no = int(clean(sheet.get(r, c_no)))
        name, aliases = split_name(raw_name)
        abil_raw = sheet.get(r, c_abil)
        tags: dict[str, object] = {}
        for c, tname in tag_cols.items():
            v = clean(sheet.get(r, c))
            if v:
                tags[tname] = True if v.upper() == 'O' else v
        grade_raw, grade_rank, grade_tier = grade_info(sheet.get(r, c_grade))
        use = clean(sheet.get(r, c_use)).upper()
        drops = [clean(d) for d in re.split(r'[,\n]', sheet.get(r, c_drop) or '') if clean(d)]

        img = None
        if r in pics:
            img = save_image(wb, pics[r].media_path, f'{cat_id}_{no:03d}')
        else:
            report.append(f'[no image] {sheet.name} #{no} {name}')

        item = {
            'id': f'{cat_id}-{no}',
            'cat': cat_id,
            'no': no,
            'name': name,
            'aliases': aliases,
            'range': clean(sheet.get(r, c_range)) if c_range else None,
            'abilities': ability_lines(abil_raw),
            'tags': tags,
            'grade': grade_raw or None,
            'gradeRank': grade_rank,
            'tier': grade_tier,
            'usage': use or None,
            'usageLabel': USAGE.get(use),
            'comment': clean(sheet.get(r, c_comment)) if c_comment else None,
            'drops': drops,
            'img': img,
            '_abil_raw': abil_raw,
        }
        for frag in unparsed_fragments(abil_raw):
            report.append(f'[unparsed] {sheet.name} {name}: {frag}')
        items.append(item)
    return items


def parse_awakening(sheet: Sheet) -> dict[str, dict]:
    """Return {norm_name: {'no': n, 'levels': {1: text, ...}, 'mainOnly': bool}}"""
    hdr_row, hdr = find_header(sheet)
    c_no, c_name = hdr['순번'], hdr['이름']
    c_lvl = hdr['각성']
    c_chg = hdr['변화']
    rows = item_rows(sheet, c_no)
    out = {}
    for i, r in enumerate(rows):
        end = rows[i + 1] if i + 1 < len(rows) else sheet.max_row + 1
        name, _ = split_name(sheet.get(r, c_name))
        if not name or name == '이름':
            continue
        levels: dict[int, str] = {}
        main_only = False
        for rr in range(r, end):
            lbl = clean(sheet.get(rr, c_lvl))
            txt = sheet.get(rr, c_chg) or ''
            if '주옵션' in txt:
                main_only = True
            m = re.match(r'(\d)\s*각성', lbl)
            if m and clean(txt) and '주옵션' not in txt:
                levels[int(m.group(1))] = txt
        out[norm_key(name)] = {'no': int(clean(sheet.get(r, c_no))), 'levels': levels, 'mainOnly': main_only}
    return out


def save_image(wb: Workbook, media_path: str, stem: str) -> str:
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    data = wb.read_bytes(media_path)
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    im.thumbnail((160, 160), Image.LANCZOS)
    out = OUT_IMG / f'{stem}.webp'
    im.save(out, 'WEBP', quality=88, method=6)
    return f'assets/items/{stem}.webp'


def build_stats(item: dict, awak: dict | None, report: list[str]):
    """stats: {key: [lv0..lv5]} where None = unknown for that level."""
    base = extract_stats(item['_abil_raw'])
    per_level: list[dict[str, float] | None] = [base]
    known_levels = [0]
    for lv in range(1, 6):
        if awak and awak['mainOnly'] and not awak['levels']:
            per_level.append(dict(base))  # only main option grows; abilities unchanged
            known_levels.append(lv)
            continue
        txt = awak['levels'].get(lv) if awak else None
        if txt:
            cur = dict(per_level[-1] or base)
            # carry forward: find last known
            for prev in reversed(per_level):
                if prev is not None:
                    cur = dict(prev)
                    break
            cur.update(extract_stats(txt))
            per_level.append(cur)
            known_levels.append(lv)
        else:
            per_level.append(None)
    keys = sorted({k for lvl in per_level if lvl for k in lvl})
    stats = {k: [(lvl.get(k) if lvl is not None else None) for lvl in per_level] for k in keys}
    return stats, known_levels


def awakening_lines(awak: dict | None) -> dict[str, list[str]]:
    if not awak:
        return {}
    return {str(lv): ability_lines(txt) for lv, txt in sorted(awak['levels'].items())}


def main():
    report: list[str] = []
    wb = Workbook(str(ITEM_XLSX))
    if OUT_IMG.exists():
        for f in OUT_IMG.glob('*.webp'):
            f.unlink()

    all_items = []
    drop_counter: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for cat_id, label, main_name, awak_name in CATEGORIES:
        items = parse_main(wb.sheet(main_name), cat_id, wb, report)
        awak = parse_awakening(wb.sheet(awak_name))
        by_no = {v['no']: v for v in awak.values()}
        matched = 0
        for it in items:
            a = awak.get(norm_key(it['name']))
            if a is None:
                a = by_no.get(it['no'])
                if a is not None:
                    report.append(f'[awak by number] {label} #{it["no"]} {it["name"]}')
            if a is not None:
                matched += 1
            else:
                report.append(f'[no awakening] {label} #{it["no"]} {it["name"]}')
            it['stats'], it['knownLevels'] = build_stats(it, a, report)
            it['awakening'] = awakening_lines(a)
            if a and a['mainOnly'] and not a['levels']:
                it['awakeningNote'] = '각성 시 주옵션만 성장합니다.'
            for k in it['stats']:
                tag = STAT_TO_TAG.get(k)
                if tag and tag not in it['tags']:
                    it['tags'][tag] = True
            for d in it['drops']:
                drop_counter[norm_key(d)][d] += 1
            all_items.append(it)
        print(f'{label:6s}: {len(items):3d} items, awakening matched {matched}')

    # canonical drop names (most common spelling)
    canon = {k: c.most_common(1)[0][0] for k, c in drop_counter.items()}
    for it in all_items:
        seen = []
        for d in it['drops']:
            cd = canon[norm_key(d)]
            if cd not in seen:
                seen.append(cd)
        it['drops'] = seen
        # precomputed search fields
        text_all = ' '.join(it['abilities'] + [l for ls in it['awakening'].values() for l in ls])
        it['search'] = {
            'name': norm_key(it['name']),
            'cho': chosung(norm_key(it['name'])),
            'alias': [norm_key(a) for a in it['aliases']],
            'aliasCho': [chosung(norm_key(a)) for a in it['aliases']],
            'text': norm_key(text_all),
            'comment': norm_key(it['comment'] or ''),
            'drops': norm_key(' '.join(it['drops'])),
        }
        del it['_abil_raw']

    drop_freq = collections.Counter(d for it in all_items for d in it['drops'])
    used_stats = sorted({k for it in all_items for k in it['stats']}, key=list(STAT_DEFS).index)
    used_tags = [t for t in TAG_DEFS if any(t in it['tags'] for it in all_items)]

    payload = {
        'generatedAt': dt.datetime.now().isoformat(timespec='seconds'),
        'source': ITEM_XLSX.name,
        'categories': [{'id': c[0], 'label': c[1]} for c in CATEGORIES],
        'grades': GRADE_ORDER,
        'usage': USAGE,
        'statDefs': {k: STAT_DEFS[k] for k in used_stats},
        'tagDefs': {t: TAG_DEFS[t] for t in used_tags},
        'drops': [d for d, _ in drop_freq.most_common()],
        'items': all_items,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # also emit a JS version so the site works from file:// without a server
    (OUT_JSON.parent / 'items.js').write_text(
        'window.UNDERDARK_DATA=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';',
        encoding='utf-8')
    REPORT.write_text('\n'.join(report), encoding='utf-8')
    print(f'total {len(all_items)} items, {len(used_stats)} stat types, {len(payload["drops"])} drop sources')
    print(f'json {OUT_JSON.stat().st_size // 1024} KB, report lines {len(report)} -> {REPORT}')


if __name__ == '__main__':
    main()

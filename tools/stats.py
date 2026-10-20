"""Ability sentence -> structured stat extraction.

Each rule is a regex applied to the (whitespace-normalised) ability text.
Rules are applied in order and matched spans are masked, so more specific
rules must come first (e.g. "모든 타워와 영웅의 공격력" before "영웅의 공격력").

STAT_DEFS is exported to the web app so the search box understands
aliases such as `치피>=100` or `타공>1`.
"""
from __future__ import annotations

import re

N = r'(\d+(?:\.\d+)?)'

# key -> (label, unit, group, aliases)
STAT_DEFS: dict[str, dict] = {}


def _def(key, label, unit, group, aliases):
    STAT_DEFS[key] = {'label': label, 'unit': unit, 'group': group, 'aliases': aliases}


# --- 공격력
_def('all_atk', '모든 타워·영웅 공격력', '%', '공격력', ['모공', '모든공격력', '전체공격력'])
_def('hero_tower_mult', '영웅·타워 공격력 배수', '배', '공격력', ['배수', '영타배수', '공격력배수'])
_def('tower_atk_mult', '타워 공격력 (1+N배)', '배', '공격력', ['타공', '타공배수', '타워공격력', '타워공'])
_def('tower_atk', '타워 공격력', '%', '공격력', ['타공퍼', '타워공격력퍼'])
_def('tower_aura', '주변 타워 공격력', '%', '공격력', ['주변타공', '깃발', '범위타공'])
_def('tower_buff_bonus', '버프 선택 타워 공격력 추가', '%', '공격력', ['버프타공'])
_def('hero_atk', '영웅 공격력', '%', '공격력', ['영공', '영웅공격력'])
_def('pick_atk', '곡괭이 타워 수당 공격력', '%', '공격력', ['곡증뎀', '곡괭이공격력'])
# --- 치명타
_def('hero_crit_dmg', '영웅 치명타 피해', '%', '치명타', ['영치피', '치피', '치명타피해'])
_def('hero_crit_rate', '영웅 치명타 확률', '%', '치명타', ['영치확', '치확', '치명타확률'])
_def('tower_crit_dmg', '타워 치명타 피해', '%', '치명타', ['타치피'])
_def('tower_crit_rate', '타워 치명타 확률', '%', '치명타', ['타치확'])
# --- 공격 방식
_def('projectile', '투사체 개수', '개', '공격', ['투사체', '투사체개수', '투사'])
_def('projectile_buff', '버프 투사체 추가 옵션', '개', '공격', ['버프투사체'])
_def('projectile_size', '투사체 크기', '배', '공격', ['투사체크기', '크기'])
_def('double_attack', '두 번 공격 확률', '%', '공격', ['두번공격', '더블', '2타', '타수'])
_def('triple_attack', '세 번 공격 확률', '%', '공격', ['세번공격', '트리플', '3타'])
_def('splash', '스플래시 데미지', '%', '공격', ['스플', '스플래시'])
_def('hero_atk_speed', '영웅 공격 속도', '%', '공격', ['영공속', '공속', '공격속도'])
_def('tower_atk_speed', '타워 공격 속도', '%', '공격', ['타공속'])
# --- 처형
_def('execute', '일반 몬스터 처형 확률', '%', '처형', ['처형', '처형확률'])
_def('execute_slowed', '이감 몬스터 처형 확률', '%', '처형', ['이감처형'])
_def('execute_air', '공중 몬스터 처형 확률', '%', '처형', ['공중처형'])
_def('execute_hp', '체력 N% 이하 즉시 처치', '%', '처형', ['체력처형', '막타'])
# --- 상태이상
_def('stun_chance', '스턴 확률', '%', '상태이상', ['스턴', '스턴확률'])
_def('slow_chance', '이속 감소 부여 확률', '%', '상태이상', ['이감확률'])
_def('slow', '몬스터 이동 속도 감소', '%', '상태이상', ['이감', '이속감소', '슬로우'])
_def('air_slow', '공중 몬스터 이동 속도 감소', '%', '상태이상', ['공중이감'])
_def('bleed_chance', '출혈 부여 확률', '%', '상태이상', ['출혈'])
# --- 추가 피해
_def('status_bonus', '상태이상 1개당 추가 피해', '%', '추가 피해', ['상추피', '상태이상추가피해'])
_def('immune_bonus', '면역 몬스터 추가 피해', '%', '추가 피해', ['면역', '면추피', '면역추가피해'])
_def('slowed_bonus', '이감 몬스터 추가 피해', '%', '추가 피해', ['이추피', '이감추가피해'])
_def('stun_bonus', '스턴 몬스터 추가 피해', '%', '추가 피해', ['스추피', '스턴추가피해'])
_def('air_bonus', '공중 몬스터 추가 피해', '%', '추가 피해', ['공추피', '공중추가피해', '공중'])
_def('boss_bonus', '보스 추가 피해', '%', '추가 피해', ['보추피', '보스추가피해'])
_def('hero_boss_dmg', '영웅 보스 피해 증가', '%', '추가 피해', ['영보피', '보스피해'])
_def('tower_boss_dmg', '타워 보스 피해 증가', '%', '추가 피해', ['타보추피', '타보피'])
_def('monster_dmg_taken', '몬스터 받는 피해 증가', '%', '추가 피해', ['몬받피'])
# --- 생존
_def('hero_hp', '영웅 체력', '%', '생존', ['영체', '영웅체력', '체력'])
_def('hero_hp_flat', '영웅 체력 (고정)', '', '생존', ['영체고정'])
_def('dmg_reduction', '영웅 받는 피해 감소', '%', '생존', ['받피감', '피해감소'])
_def('hero_move_speed', '영웅 이동 속도', '', '생존', ['이속', '이동속도'])
_def('potion_drop', '포션 드랍 확률', '%', '생존', ['포션'])
_def('revive_cd', '부활 쿨타임', '초', '생존', ['부활'])
# --- 유틸
_def('pickaxe', '곡괭이 획득 확률', '%', '유틸', ['곡', '곡괭이'])
_def('tower_card', '타워 카드 획득 확률', '%', '유틸', ['타워카드', '카드'])
_def('buff_select', '웨이브 종료 버프 선택 확률', '%', '유틸', ['버프선택', '버프'])
_def('extra_tower', '업그레이드 시 추가 타워 확률', '%', '유틸', ['추가타워'])
_def('item_drop', '아이템 드랍률', '%', '유틸', ['드랍률', '템드랍'])
_def('bomb_dmg', '폭탄 데미지', '%', '유틸', ['폭탄'])
_def('shovel', '삽 획득 확률', '%', '유틸', ['삽'])

# (regex, {group_index: key})
RULES: list[tuple[re.Pattern, dict[int, str]]] = []


def _r(pattern: str, mapping):
    if isinstance(mapping, str):
        mapping = {1: mapping}
    RULES.append((re.compile(pattern), mapping))


# order matters: specific -> generic
_r(rf'모든 타워와 영웅의 공격력이 {N}%', 'all_atk')
_r(rf'영웅과 타워의 공격력이 {N}배', 'hero_tower_mult')
_r(rf'타워 공격력이\s*1\s*\+\s*{N}배', 'tower_atk_mult')
_r(rf'버프 선택\s*창에서 타워의 공격력이 {N}%', 'tower_buff_bonus')
_r(rf'\(ex\.[^)]*\)', {})  # example text, ignore
_r(rf'\d+칸 안에 있는 타워의 공격력이 {N}%', 'tower_aura')
_r(rf'타워 목록에 곡괭이를 들고 있는 수만큼 전체 공격력이 {N}%', 'pick_atk')
_r(rf'타워의 공격력이? {N}%', 'tower_atk')
_r(rf'영웅의 공격력이 {N}%', 'hero_atk')

_r(rf'영웅의 치명타 피해가 {N}%', 'hero_crit_dmg')
_r(rf'영웅의 치명타 확률[이리] {N}%', 'hero_crit_rate')
_r(rf'타워의 치명타 피해가 {N}%', 'tower_crit_dmg')
_r(rf'타워의 치명타 확률[이리] {N}%', 'tower_crit_rate')

_r(rf'\[무기 투사체 {N}개 추가\]', 'projectile_buff')
_r(rf'투사체 (?:개수[를르]|수가) {N}개', 'projectile')
_r(rf'투사체 크기를 {N}배', 'projectile_size')
_r(rf'{N}%의? 확률로 두 번 공격', 'double_attack')
_r(rf'{N}%의? 확률로 세 번 공격', 'triple_attack')
_r(rf'공격력의 {N}%\s*만큼 스플래시', 'splash')
_r(rf'영웅의 공격 속도가 {N}%', 'hero_atk_speed')
_r(rf'타워의 공격 속도가 {N}%', 'tower_atk_speed')

_r(rf'이동 속도가 감소한 일반 몬스터를 공격하면,?\s*{N}%\s*확률로 처형', 'execute_slowed')
_r(rf'{N}%의? 확[률룰]로 일반 몬스터를 즉시 처형', 'execute')
_r(rf'{N}%의? 확률로 공중 일반 몬스터를 즉시 처[치지]', 'execute_air')
_r(rf'{N}% 이하의 체력을 가진 적을 즉시 처치', 'execute_hp')

_r(rf'{N}%의? 확률로 몬스터를 [\d.]+초 동안 스턴', 'stun_chance')
_r(rf'{N}%의? 확률로 [\d.]+초 동안 몬스터의 이동 속도를 {N}% 감소', {1: 'slow_chance', 2: 'slow'})
_r(rf'얼음 메테오에 맞은 적은 이동속도가 [\d.]+초 동안 {N}% 감소', 'slow')
_r(rf'얼음벽 주변에 있는 일반 몬스터는 {N}% 이동 속도가 감소', 'slow')
_r(rf'공중 몬스터의 이동\s?속도가 {N}% 감소', 'air_slow')
_r(rf'몬스터의 이동 속도가 {N}% 감소', 'slow')
_r(rf'{N}% 확률로 적에게 출혈', 'bleed_chance')

_r(rf'상태 이상 하나당\s*{N}%', 'status_bonus')
_r(rf'면역 상태인 몬스터에게 {N}%', 'immune_bonus')
_r(rf'이동 속도가 감소한 몬스터를 공격하면 {N}%', 'slowed_bonus')
_r(rf'스턴\s?상태의 몬스터에게 (?:가하는 피해가\s*)?{N}%', 'stun_bonus')
_r(rf'공중 몬스터에게 추가로 {N}%', 'air_bonus')
_r(rf'영웅이 보스에게 주는 피해가 {N}%', 'hero_boss_dmg')
_r(rf'타워가 보스에게 주는 피해가 {N}%', 'tower_boss_dmg')
_r(rf'보스에게 추가로 {N}%', 'boss_bonus')
_r(rf'몬스터가 받는 피해를 {N}%', 'monster_dmg_taken')

_r(rf'영웅의 체력이 {N}%', 'hero_hp')
_r(rf'영웅 체력이 {N} 증가', 'hero_hp_flat')
_r(rf'영웅이 받는 피해를 {N}%', 'dmg_reduction')
_r(rf'영웅의 이동 속도가 {N}\s*증가', 'hero_move_speed')
_r(rf'{N}%의? 확률로 (?:체력 )?포션을 드랍', 'potion_drop')
_r(rf'부활합니다\.?\s*\[쿨타임 {N}초\]', 'revive_cd')

_r(rf'{N}% 확률로 추가되는\s*곡괭이', 'pickaxe')
_r(rf'{N}% 확률로 (?:네크로맨서 )?타워 카드', 'tower_card')
_r(rf'{N}% 확률로 버프를 선택', 'buff_select')
_r(rf'{N}% 확률로 추가 타워를 획득', 'extra_tower')
_r(rf'아이템 드랍률이 {N}%', 'item_drop')
_r(rf'폭탄을 떨어뜨려 {N}%', 'bomb_dmg')
_r(rf'{N}% 확률로 곡괭이 대신 삽', 'shovel')


def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.replace('\n', ' ')).strip()


def extract_stats(text: str) -> dict[str, float]:
    """Return {stat_key: value}. If a key appears twice the larger value wins."""
    t = normalize_text(text)
    out: dict[str, float] = {}
    for pat, mapping in RULES:
        def repl(m):
            for gi, key in mapping.items():
                v = float(m.group(gi))
                if key not in out or v > out[key]:
                    out[key] = v
            return '\x00' * len(m.group(0))
        t = pat.sub(repl, t)
    return out


# Sentences with a number that no rule caught -> reported for maintenance.
_NUM_SENT = re.compile(r'[^.\x00]*\d[^.\x00]*')


def unparsed_fragments(text: str) -> list[str]:
    t = normalize_text(text)
    for pat, _ in RULES:
        t = pat.sub(lambda m: '\x00' * len(m.group(0)), t)
    frags = []
    for m in _NUM_SENT.finditer(t):
        s = m.group(0).strip(' ,/')
        if re.search(r'\d', s) and len(s) > 4:
            frags.append(s)
    return frags

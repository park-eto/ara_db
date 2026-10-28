/**
 * Underdark Live Google Sheets Synchronization
 * - Fetches live CSV data from Google Sheets in real-time
 * - Parses Heroes, Mercenaries, Mounts, Mount Sub-options, Pets
 * - Preserves existing image paths and structures
 * - Provides seamless background sync with localStorage cache
 */

(function () {
  'use strict';

  const SHEET_ID = '1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi';
  const CACHE_KEY = 'underdark_live_expansion_cache_v4';
  const CACHE_TIME_KEY = 'underdark_live_expansion_timestamp_v4';
  try {
    localStorage.removeItem('underdark_live_expansion_cache');
    localStorage.removeItem('underdark_live_expansion_cache_v2');
    localStorage.removeItem('underdark_live_expansion_cache_v3');
  } catch (e) {}
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

  function chosung(s) {
    if (!s) return '';
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i) - 0xAC00;
      if (code >= 0 && code < 11172) {
        out.push(CHO[Math.floor(code / 588)]);
      } else if (s[i].trim()) {
        out.push(s[i].toLowerCase());
      }
    }
    return out.join('');
  }

  function normKey(s) {
    return (s || '').replace(/[\s/·,.\-()★☆\[\]]+/g, '').toLowerCase();
  }

  function clean(s) {
    return (s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let entry = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(entry);
        entry = '';
      } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(entry);
        if (row.some(cell => cell.trim().length > 0)) {
          rows.push(row);
        }
        row = [];
        entry = '';
      } else {
        entry += ch;
      }
    }
    if (entry.length > 0 || row.length > 0) {
      row.push(entry);
      if (row.some(cell => cell.trim().length > 0)) {
        rows.push(row);
      }
    }
    return rows;
  }

  async function fetchSheetCSV(sheetName) {
    const encoded = encodeURIComponent(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encoded}&t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet "${sheetName}": HTTP ${res.status}`);
    }
    const text = await res.text();
    return parseCSV(text);
  }

  function buildColMap(headers) {
    const map = {};
    headers.forEach((h, idx) => {
      map[clean(h)] = idx;
    });
    return map;
  }

  function syncHeroesFromRows(rows, existingHeroesMap) {
    if (!rows || rows.length < 2) return [];
    const colMap = buildColMap(rows[0]);
    const heroes = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const name = get('영웅명');
      if (!name) continue;

      const aliasesRaw = get('별칭');
      const aliases = aliasesRaw.split(/[,/]/).map(s => s.trim()).filter(Boolean);

      const noRaw = get('No');
      const no = /^\d+$/.test(noRaw) ? parseInt(noRaw, 10) : null;
      const grade = get('등급') || '전설';
      const tier = get('티어') || null;
      const ability = get('기본 고유 능력');
      const comment = get('평가 및 코멘트');

      const levels = {};
      ['3', '6', '9', '12', '15'].forEach(lv => {
        const abilCol = lv !== '15' ? `${lv}Lv 능력` : '15Lv+ 능력';
        const starCol = lv !== '15' ? `${lv}Lv 추천도` : '15Lv+ 추천도';
        const lvAbil = get(abilCol);
        const lvStar = get(starCol);
        if (lvAbil) {
          levels[lv] = {
            level: parseInt(lv, 10),
            ability: lvAbil,
            stars: lvStar
          };
        }
      });

      const cleanName = normKey(name);
      let imgPath = null;
      if (existingHeroesMap[cleanName] && existingHeroesMap[cleanName].img) {
        imgPath = existingHeroesMap[cleanName].img;
      } else {
        imgPath = `assets/heroes/hero_${cleanName}.webp`;
      }

      const allText = `${name} ${aliases.join(' ')} ${ability} ${Object.values(levels).map(l => l.ability).join(' ')}`;

      heroes.push({
        id: `hero-${no !== null ? no : heroes.length + 1}`,
        no: no,
        name: name,
        aliases: aliases,
        grade: grade,
        tier: tier,
        ability: ability,
        levels: levels,
        comment: comment || null,
        img: imgPath,
        search: {
          name: cleanName,
          cho: chosung(cleanName),
          alias: aliases.map(normKey),
          text: normKey(allText),
          comment: normKey(comment || '')
        }
      });
    }

    heroes.sort((a, b) => (a.no ?? 999) - (b.no ?? 999));
    return heroes;
  }

  function syncMercenariesFromRows(rows, existingMercsMap) {
    if (!rows || rows.length < 2) return [];
    const colMap = buildColMap(rows[0]);
    const mercs = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const name = get('용병명');
      if (!name) continue;

      const grade = get('기본 등급') || '일반';
      const rec = get('추천 등급') || null;
      let ability = get('고유 능력');
      ability = ability.replace(/영웅이 공격할 때 공격할 때/g, '영웅이 공격할 때')
                       .replace(/1%의 확률로 세 번/g, 'N%의 확률로 세 번')
                       .replace(/공격할 때 1%의 확률로/g, '공격할 때 N%의 확률로');

      const tierValues = {};
      ['B', 'A', 'S', 'SS', 'SSS'].forEach(t => {
        const val = get(`${t}티어 효과`);
        if (val) tierValues[t] = val;
      });

      const cleanName = normKey(name);
      let imgPath = null;
      if (existingMercsMap[cleanName] && existingMercsMap[cleanName].img) {
        imgPath = existingMercsMap[cleanName].img;
      } else {
        imgPath = `assets/mercenaries/merc_${cleanName}.webp`;
      }

      const allText = `${name} ${ability} ${Object.entries(tierValues).map(([k, v]) => `${k}:${v}`).join(' ')}`;

      mercs.push({
        id: `merc-${mercs.length + 1}`,
        name: name,
        grade: grade,
        recommend: rec,
        ability: ability,
        tierValues: tierValues,
        img: imgPath,
        search: {
          name: cleanName,
          cho: chosung(cleanName),
          text: normKey(allText)
        }
      });
    }

    return mercs;
  }

  function syncMountsFromRows(rows, existingMountsMap) {
    if (!rows || rows.length < 2) return [];
    const colMap = buildColMap(rows[0]);
    const mounts = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const name = get('탈것 이름');
      if (!name) continue;

      const noRaw = get('No');
      const no = /^\d+$/.test(noRaw) ? parseInt(noRaw, 10) : mounts.length + 1;
      const ability = get('고유 능력');
      const comment = get('평가 및 코멘트');

      const cleanName = normKey(name);
      let imgPath = null;
      if (existingMountsMap[no] && existingMountsMap[no].img) {
        imgPath = existingMountsMap[no].img;
      } else {
        const noPad = String(no).padStart(2, '0');
        imgPath = `assets/mounts/mount_${noPad}_${cleanName}.webp`;
      }

      const allText = `${name} ${ability} ${comment}`;

      mounts.push({
        id: `mount-${no}`,
        no: no,
        name: name,
        ability: ability,
        comment: comment || null,
        img: imgPath,
        search: {
          name: cleanName,
          cho: chosung(cleanName),
          text: normKey(allText),
          comment: normKey(comment || '')
        }
      });
    }

    mounts.sort((a, b) => a.no - b.no);
    return mounts;
  }

  function syncMountSubOptionsFromRows(rows) {
    const subOptions = { tower: [], hero: [], common: [] };
    if (!rows || rows.length < 2) return subOptions;
    const colMap = buildColMap(rows[0]);

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const cat = get('분류');
      const noRaw = get('순번');
      const no = /^\d+$/.test(noRaw) ? parseInt(noRaw, 10) : 1;
      const optName = get('옵션명');
      const rng = get('수치 범위');

      const item = { no: no, name: optName, range: rng };
      if (cat.includes('타워 관련')) {
        subOptions.tower.push(item);
      } else if (cat.includes('영웅 관련')) {
        subOptions.hero.push(item);
      } else {
        subOptions.common.push(item);
      }
    }

    return subOptions;
  }

  function syncPetsFromRows(rows, existingPetsMap) {
    if (!rows || rows.length < 2) return [];
    const colMap = buildColMap(rows[0]);
    const pets = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const name = get('펫 이름');
      if (!name) continue;

      const noRaw = get('도감 No');
      const no = /^\d+$/.test(noRaw) ? parseInt(noRaw, 10) : pets.length + 1;
      const tier = get('티어');
      const ability = get('기본 고유 능력');
      const dropsRaw = get('드랍 및 획득처');
      const drops = dropsRaw.split(/[,/]/).map(d => d.trim()).filter(Boolean);

      const cleanName = normKey(name);
      let imgPath = null;
      if (existingPetsMap[no] && existingPetsMap[no].img) {
        imgPath = existingPetsMap[no].img;
      } else {
        const noPad = String(no).padStart(2, '0');
        imgPath = `assets/pets/pet_${noPad}_${cleanName}.webp`;
      }

      pets.push({
        id: `pet-${no}`,
        no: no,
        name: name,
        tier: tier,
        ability: ability,
        drops: drops,
        dropRaw: dropsRaw,
        img: imgPath,
        search: {
          name: cleanName,
          cho: chosung(cleanName),
          text: normKey(`${name}${ability}${dropsRaw}${tier}`),
          tier: tier ? tier.toLowerCase() : '',
          drops: drops.map(normKey)
        }
      });
    }

    pets.sort((a, b) => a.no - b.no);
    return pets;
  }

  const CAT_MAP = {
    '주 무기': 'weapon',
    '주무기': 'weapon',
    '보조 무기': 'sub',
    '보조무기': 'sub',
    '투구': 'helmet',
    '반지': 'ring',
    '기타': 'etc'
  };

  const USAGE_MAP = {
    '추천': 'O',
    '상황별': '△',
    '비추천': 'X',
    '최악': 'XX'
  };

  const STAT_NUM = '(\\d+(?:\\.\\d+)?)';
  const STAT_RULES = [
    [new RegExp(`모든 타워와 영웅의 공격력이 ${STAT_NUM}%`), { 1: 'all_atk' }],
    [new RegExp(`영웅과 타워의 공격력이 ${STAT_NUM}배`), { 1: 'hero_tower_mult' }],
    [new RegExp(`타워 공격력이\\s*1\\s*\\+\\s*${STAT_NUM}배`), { 1: 'tower_atk_mult' }],
    [new RegExp(`버프 선택\\s*창에서 타워의 공격력이 ${STAT_NUM}%`), { 1: 'tower_buff_bonus' }],
    [new RegExp(`\\(ex\\.[^)]*\\)`), {}],
    [new RegExp(`\\d+칸 안에 있는 타워의 공격력이 ${STAT_NUM}%`), { 1: 'tower_aura' }],
    [new RegExp(`타워 목록에 곡괭이를 들고 있는 수만큼 전체 공격력이 ${STAT_NUM}%`), { 1: 'pick_atk' }],
    [new RegExp(`타워의 공격력이? ${STAT_NUM}%`), { 1: 'tower_atk' }],
    [new RegExp(`영웅의 공격력이 ${STAT_NUM}%`), { 1: 'hero_atk' }],
    [new RegExp(`영웅의 치명타 피해가 ${STAT_NUM}%`), { 1: 'hero_crit_dmg' }],
    [new RegExp(`영웅의 치명타 확률[이리] ${STAT_NUM}%`), { 1: 'hero_crit_rate' }],
    [new RegExp(`타워의 치명타 피해가 ${STAT_NUM}%`), { 1: 'tower_crit_dmg' }],
    [new RegExp(`타워의 치명타 확률[이리] ${STAT_NUM}%`), { 1: 'tower_crit_rate' }],
    [new RegExp(`\\[무기 투사체 ${STAT_NUM}개 추가\\]`), { 1: 'projectile_buff' }],
    [new RegExp(`투사체 (?:개수[를르]|수가) ${STAT_NUM}개`), { 1: 'projectile' }],
    [new RegExp(`투사체 크기를 ${STAT_NUM}배`), { 1: 'projectile_size' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 두 번 공격`), { 1: 'double_attack' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 세 번 공격`), { 1: 'triple_attack' }],
    [new RegExp(`공격력의 ${STAT_NUM}%\\s*만큼 스플래시`), { 1: 'splash' }],
    [new RegExp(`영웅의 공격 속도가 ${STAT_NUM}%`), { 1: 'hero_atk_speed' }],
    [new RegExp(`타워의 공격 속도가 ${STAT_NUM}%`), { 1: 'tower_atk_speed' }],
    [new RegExp(`이동 속도가 감소한 일반 몬스터를 공격하면,?\\s*${STAT_NUM}%\\s*확률로 처형`), { 1: 'execute_slowed' }],
    [new RegExp(`${STAT_NUM}%의? 확[률룰]로 일반 몬스터를 즉시 처형`), { 1: 'execute' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 공중 일반 몬스터를 즉시 처[치지]`), { 1: 'execute_air' }],
    [new RegExp(`${STAT_NUM}% 이하의 체력을 가진 적을 즉시 처치`), { 1: 'execute_hp' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 몬스터를 [\\d.]+초 동안 스턴`), { 1: 'stun_chance' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 [\\d.]+초 동안 몬스터의 이동 속도를 ${STAT_NUM}% 감소`), { 1: 'slow_chance', 2: 'slow' }],
    [new RegExp(`얼음 메테오에 맞은 적은 이동속도가 [\\d.]+초 동안 ${STAT_NUM}% 감소`), { 1: 'slow' }],
    [new RegExp(`얼음벽 주변에 있는 일반 몬스터는 ${STAT_NUM}% 이동 속도가 감소`), { 1: 'slow' }],
    [new RegExp(`공중 몬스터의 이동\\s?속도가 ${STAT_NUM}% 감소`), { 1: 'air_slow' }],
    [new RegExp(`몬스터의 이동 속도가 ${STAT_NUM}% 감소`), { 1: 'slow' }],
    [new RegExp(`${STAT_NUM}% 확률로 적에게 출혈`), { 1: 'bleed_chance' }],
    [new RegExp(`상태 이상 하나당\\s*${STAT_NUM}%`), { 1: 'status_bonus' }],
    [new RegExp(`면역 상태인 몬스터에게 ${STAT_NUM}%`), { 1: 'immune_bonus' }],
    [new RegExp(`이동 속도가 감소한 몬스터를 공격하면 ${STAT_NUM}%`), { 1: 'slowed_bonus' }],
    [new RegExp(`스턴\\s?상태의 몬스터에게 (?:가하는 피해가\\s*)?${STAT_NUM}%`), { 1: 'stun_bonus' }],
    [new RegExp(`공중 몬스터에게 추가로 ${STAT_NUM}%`), { 1: 'air_bonus' }],
    [new RegExp(`영웅이 보스에게 주는 피해가 ${STAT_NUM}%`), { 1: 'hero_boss_dmg' }],
    [new RegExp(`타워가 보스에게 주는 피해가 ${STAT_NUM}%`), { 1: 'tower_boss_dmg' }],
    [new RegExp(`보스에게 추가로 ${STAT_NUM}%`), { 1: 'boss_bonus' }],
    [new RegExp(`몬스터가 받는 피해를 ${STAT_NUM}%`), { 1: 'monster_dmg_taken' }],
    [new RegExp(`영웅의 체력이 ${STAT_NUM}%`), { 1: 'hero_hp' }],
    [new RegExp(`영웅 체력이 ${STAT_NUM} 증가`), { 1: 'hero_hp_flat' }],
    [new RegExp(`영웅이 받는 피해를 ${STAT_NUM}%`), { 1: 'dmg_reduction' }],
    [new RegExp(`영웅의 이동 속도가 ${STAT_NUM}\\s*증가`), { 1: 'hero_move_speed' }],
    [new RegExp(`${STAT_NUM}%의? 확률로 (?:체력 )?포션을 드랍`), { 1: 'potion_drop' }],
    [new RegExp(`부활합니다\\.?\\s*\\[쿨타임 ${STAT_NUM}초\\]`), { 1: 'revive_cd' }],
    [new RegExp(`${STAT_NUM}% 확률로 추가되는\\s*곡괭이`), { 1: 'pickaxe' }],
    [new RegExp(`${STAT_NUM}% 확률로 (?:네크로맨서 )?타워 카드`), { 1: 'tower_card' }],
    [new RegExp(`${STAT_NUM}% 확률로 버프를 선택`), { 1: 'buff_select' }],
    [new RegExp(`${STAT_NUM}% 확률로 추가 타워를 획득`), { 1: 'extra_tower' }],
    [new RegExp(`아이템 드랍률이 ${STAT_NUM}%`), { 1: 'item_drop' }],
    [new RegExp(`폭탄을 떨어뜨려 ${STAT_NUM}%`), { 1: 'bomb_dmg' }],
    [new RegExp(`${STAT_NUM}% 확률로 곡괭이 대신 삽`), { 1: 'shovel' }]
  ];

  function extractStats(text) {
    if (!text) return {};
    let t = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const out = {};
    for (const [pat, mapping] of STAT_RULES) {
      t = t.replace(pat, (full, ...groups) => {
        for (const [gi, key] of Object.entries(mapping)) {
          const valStr = groups[parseInt(gi, 10) - 1];
          if (valStr !== undefined) {
            const v = parseFloat(valStr);
            if (!isNaN(v)) {
              if (out[key] === undefined || v > out[key]) {
                out[key] = v;
              }
            }
          }
        }
        return '\x00'.repeat(full.length);
      });
    }
    return out;
  }

  function syncItemsFromRows(rows, existingItemsMap) {
    if (!rows || rows.length < 2) return null;
    const headers = rows[0].map(clean);
    if (!headers.includes('아이템명')) return null;

    const colMap = buildColMap(rows[0]);
    const items = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c.trim())) continue;

      function get(colName) {
        const idx = colMap[colName];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : '';
      }

      const name = get('아이템명');
      if (!name) continue;

      const catRaw = clean(get('분류'));
      const cat = CAT_MAP[catRaw] || 'etc';
      const noRaw = get('No');
      const no = /^\d+$/.test(noRaw) ? parseInt(noRaw, 10) : items.length + 1;
      const range = get('공격 거리') || null;
      const grade = get('등급') || 'F-';
      const tier = get('티어') || null;
      const usageLabel = get('추천') || '비추천';
      const usage = USAGE_MAP[usageLabel] || 'X';

      const abilRaw = get('기본 고유 능력');
      const abilities = abilRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

      const awakening = {};
      ['1', '2', '3', '4', '5'].forEach(lv => {
        const aRaw = get(`${lv}각성 능력`);
        if (aRaw) {
          const lines = aRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (lines.length) awakening[lv] = lines;
        }
      });

      const dropsRaw = get('드랍처');
      const drops = dropsRaw.split(/[,/]/).map(s => s.trim()).filter(Boolean);
      const comment = get('평가 및 코멘트');

      const cleanName = normKey(name);
      const existing = existingItemsMap[cleanName] || {};

      // Check if ability text or awakening text actually changed from existing
      const baseText = abilities.join(' ');
      const existingBaseText = (existing.abilities || []).join(' ');
      const isBaseChanged = normKey(baseText) !== normKey(existingBaseText);

      let isAwakChanged = false;
      const existingAwak = existing.awakening || {};
      for (const lv of ['1', '2', '3', '4', '5']) {
        const curLines = (awakening[lv] || []).join(' ');
        const exLines = (existingAwak[lv] || []).join(' ');
        if (normKey(curLines) !== normKey(exLines)) {
          isAwakChanged = true;
          break;
        }
      }

      let stats = existing.stats;
      let knownLevels = existing.knownLevels ? [...existing.knownLevels] : [0];

      // If text changed or existing stats is missing, re-extract stats accurately
      if (isBaseChanged || isAwakChanged || !stats || !Object.keys(stats).length) {
        const baseStats = extractStats(baseText);
        const perLevel = [baseStats];
        knownLevels = [0];

        for (let lvInt = 1; lvInt <= 5; lvInt++) {
          const lvStr = String(lvInt);
          const txt = (awakening[lvStr] || []).join(' ');
          if (txt) {
            let cur = { ...(perLevel[perLevel.length - 1] || baseStats) };
            for (let p = perLevel.length - 1; p >= 0; p--) {
              if (perLevel[p]) { cur = { ...perLevel[p] }; break; }
            }
            Object.assign(cur, extractStats(txt));
            perLevel.push(cur);
            knownLevels.push(lvInt);
          } else if (existing.awakeningNote === '각성 시 주옵션만 성장합니다.') {
            perLevel.push({ ...baseStats });
            knownLevels.push(lvInt);
          } else {
            perLevel.push(null);
          }
        }

        const keysSet = new Set();
        perLevel.forEach(lvl => {
          if (lvl) Object.keys(lvl).forEach(k => keysSet.add(k));
        });
        const keys = Array.from(keysSet).sort();
        const extractedStats = {};
        keys.forEach(k => {
          extractedStats[k] = perLevel.map(lvl => (lvl && lvl[k] !== undefined) ? lvl[k] : null);
        });
        stats = extractedStats;
      }

      const allText = `${name} ${abilities.join(' ')} ${Object.values(awakening).flat().join(' ')} ${comment}`;

      items.push({
        ...existing,
        id: existing.id || `${cat}-${no}`,
        cat: cat,
        no: no,
        name: name,
        range: range,
        grade: grade,
        tier: tier,
        usage: usage,
        usageLabel: usageLabel,
        abilities: abilities.length ? abilities : (existing.abilities || []),
        awakening: Object.keys(awakening).length ? awakening : (existing.awakening || {}),
        knownLevels: knownLevels,
        stats: Object.keys(stats).length ? stats : (existing.stats || {}),
        drops: drops.length ? drops : (existing.drops || []),
        comment: comment || existing.comment || '',
        img: existing.img || `assets/items/${cat}_${String(no).padStart(3, '0')}.webp`,
        search: {
          name: cleanName,
          cho: chosung(cleanName),
          alias: existing.search?.alias || [],
          aliasCho: existing.search?.aliasCho || [],
          text: normKey(allText),
          comment: normKey(comment || ''),
          drops: drops.map(normKey).join('')
        }
      });
    }

    return items.length ? items : null;
  }

  async function fetchLiveExpansionData(force = false) {
    const base = window.UNDERDARK_EXPANSION || {};

    const existingHeroesMap = {};
    (base.heroes || []).forEach(h => { existingHeroesMap[normKey(h.name)] = h; });

    const existingMercsMap = {};
    (base.mercenaries || []).forEach(m => { existingMercsMap[normKey(m.name)] = m; });

    const existingMountsMap = {};
    (base.mounts || []).forEach(m => { existingMountsMap[m.no] = m; });

    const existingPetsMap = {};
    (base.pets || []).forEach(p => { existingPetsMap[p.no] = p; });

    const existingItemsMap = {};
    if (window.UNDERDARK_DATA && window.UNDERDARK_DATA.items) {
      window.UNDERDARK_DATA.items.forEach(it => { existingItemsMap[normKey(it.name)] = it; });
    }

    // Fetch all sheets concurrently
    const [heroRows, mercRows, mountRows, subOptRows, petRows, itemRows] = await Promise.all([
      fetchSheetCSV('영웅'),
      fetchSheetCSV('지원용병'),
      fetchSheetCSV('탈것'),
      fetchSheetCSV('탈것 부옵션'),
      fetchSheetCSV('펫'),
      fetchSheetCSV('아이템').catch(() => null)
    ]);

    const heroes = syncHeroesFromRows(heroRows, existingHeroesMap);
    const mercs = syncMercenariesFromRows(mercRows, existingMercsMap);
    const mounts = syncMountsFromRows(mountRows, existingMountsMap);
    const subOptions = syncMountSubOptionsFromRows(subOptRows);
    const pets = syncPetsFromRows(petRows, existingPetsMap);
    const syncedItems = itemRows ? syncItemsFromRows(itemRows, existingItemsMap) : null;

    const bundle = {
      heroes: heroes.length ? heroes : base.heroes,
      mercenaries: mercs.length ? mercs : base.mercenaries,
      mounts: mounts.length ? mounts : base.mounts,
      mountSubOptions: (subOptions.tower.length || subOptions.hero.length || subOptions.common.length) ? subOptions : base.mountSubOptions,
      pets: pets.length ? pets : base.pets,
      petGuide: base.petGuide || {},
      camp: base.camp || (window.UNDERDARK_EXPANSION ? window.UNDERDARK_EXPANSION.camp : null),
      items: syncedItems
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch (e) {
      console.warn('LocalStorage quota exceeded, cache not saved to disk:', e);
    }

    return bundle;
  }

  function getCachedData() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  window.SheetsSync = {
    fetchLiveExpansionData,
    getCachedData,
    SHEET_ID
  };
})();

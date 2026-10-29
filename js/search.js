/**
 * Ara DB VER 2.0 — Ultra-Fast Search Engine (js/search.js)
 * Features:
 *  - Korean Chosung search (e.g. ㅂㄷ -> 빛의 단검, ㅎㄹ -> 화로)
 *  - Alias & normalized substring search (e.g. 빛단, 정불갑)
 *  - Official ID search (e.g. #7012, #101)
 *  - Numeric stat condition queries (e.g. 치피>=60, 투사체>=2, 공속>=50, 보공>=30)
 *  - Instant cross-category match counter
 */
(function (global) {
  'use strict';

  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const CHO_SET = new Set(CHO.split(''));

  function toChosung(str) {
    if (!str) return '';
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 0xAC00;
      if (code >= 0 && code < 11172) {
        out += CHO[Math.floor(code / 588)];
      } else if (str[i].trim()) {
        out += str[i].toLowerCase();
      }
    }
    return out;
  }

  function normKey(str) {
    return String(str || '').replace(/[\s/·,.\-()★☆\[\]:]+/g, '').toLowerCase();
  }

  function isChosungOnly(token) {
    if (!token) return false;
    for (let i = 0; i < token.length; i++) {
      if (!CHO_SET.has(token[i])) return false;
    }
    return true;
  }

  // Stat alias dictionary for numeric condition queries like 치피>=60
  const STAT_ALIAS_MAP = {
    '치피': ['치피', '치명타피해', '영웅치피', '타워치피'],
    '치명타피해': ['치피', '치명타피해'],
    '치확': ['치확', '치명타확률', '영웅치확', '타워치확'],
    '치명타확률': ['치확', '치명타확률'],
    '공속': ['공속', '공격속도', '영웅공속', '타공속'],
    '공격속도': ['공속', '공격속도'],
    '투사체': ['투사체', '투사체수', '투사체개수'],
    '투사체크기': ['투사체크기', '크기'],
    '보공': ['보공', '보스피해', '타워보공'],
    '보스': ['보공', '보스피해'],
    '영공': ['영공', '영웅공격력'],
    '타공': ['타공', '타워공격력'],
    '전공': ['전공', '모공', '전체공격력', '모든공격력'],
    '모공': ['전공', '모공', '전체공격력', '모든공격력'],
    '피증': ['피해증가', '영공', '타공', '전공', '받피증'],
    '피해증가': ['피해증가', '영공', '타공', '전공', '받피증'],
    '처형': ['처형', '즉사'],
    '즉사': ['처형', '즉사'],
    '스턴': ['스턴', '기절', '스턴추뎀'],
    '감속': ['감속', '슬로우', '감속추뎀'],
    '스플래시': ['스플래시', '범위피해'],
  };

  const COND_REGEX = /^([가-힣a-zA-Z_]+)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/;

  function parseQueryTokens(rawQuery) {
    const cleaned = String(rawQuery || '').trim();
    if (!cleaned) return [];
    const parts = cleaned.split(/\s+/);
    return parts.map(raw => {
      const m = raw.match(COND_REGEX);
      if (m) {
        return {
          type: 'stat_cond',
          raw,
          statKey: m[1].toLowerCase(),
          op: m[2],
          val: parseFloat(m[3]),
        };
      }
      if (raw.startsWith('#') && raw.length > 1) {
        return {
          type: 'id',
          raw,
          idStr: raw.slice(1).toLowerCase(),
        };
      }
      const n = normKey(raw);
      return {
        type: isChosungOnly(n) ? 'chosung' : 'text',
        raw,
        lower: raw.toLowerCase(),
        norm: n,
        cho: toChosung(raw),
      };
    });
  }

  function compareNum(actual, op, target) {
    if (actual === undefined || actual === null || Number.isNaN(actual)) return false;
    switch (op) {
      case '>=': return actual >= target;
      case '<=': return actual <= target;
      case '>':  return actual > target;
      case '<':  return actual < target;
      case '=':  return Math.abs(actual - target) < 0.001;
      default:   return false;
    }
  }

  function matchStatCondition(entry, token) {
    const stats = entry.stats;
    if (stats) {
      const candidates = STAT_ALIAS_MAP[token.statKey] || [token.statKey];
      for (const cKey of candidates) {
        if (stats[cKey] !== undefined && compareNum(stats[cKey], token.op, token.val)) {
          return true;
        }
      }
      // Also check any partial key match in stats
      for (const [k, v] of Object.entries(stats)) {
        if (k.toLowerCase().includes(token.statKey) && compareNum(v, token.op, token.val)) {
          return true;
        }
      }
    }

    // Fallback: regex scan over entry text (works for Heroes, Towers, Mounts, Pets, Camp, etc.)
    const fullText = (entry.search && entry.search.full) || '';
    if (!fullText.includes(token.statKey)) return false;
    const nums = fullText.match(/\d+(?:\.\d+)?/g);
    if (!nums) return false;
    return nums.some(n => compareNum(parseFloat(n), token.op, token.val));
  }

  function matchEntry(entry, parsedTokens) {
    if (!parsedTokens || parsedTokens.length === 0) return true;
    const s = entry.search || {
      full: String(entry.name || '').toLowerCase(),
      norm: normKey(entry.name || ''),
      cho: toChosung(entry.name || ''),
    };

    for (const tk of parsedTokens) {
      if (tk.type === 'id') {
        const oid = String(entry.officialId || entry.no || '').toLowerCase();
        if (oid !== tk.idStr && !s.full.includes('#' + tk.idStr)) return false;
      } else if (tk.type === 'stat_cond') {
        if (!matchStatCondition(entry, tk)) return false;
      } else if (tk.type === 'chosung') {
        if (!s.cho.includes(tk.norm) && !(s.nameCho && s.nameCho.includes(tk.norm))) {
          return false;
        }
      } else {
        const hitFull = s.full.includes(tk.lower);
        const hitNorm = tk.norm && s.norm.includes(tk.norm);
        const hitCho = tk.cho && isChosungOnly(tk.raw) && s.cho.includes(tk.cho);
        if (!hitFull && !hitNorm && !hitCho) return false;
      }
    }
    return true;
  }

  function rebuildEntrySearch(entry, extraFields) {
    const parts = [
      `#${entry.officialId || ''}`,
      entry.name || '',
      Array.isArray(entry.aliases) ? entry.aliases.join(' ') : '',
      entry.tier || '',
      entry.grade || '',
      entry.recommend || '',
      entry.usageLabel || '',
      entry.ability || '',
      Array.isArray(entry.abilities) ? entry.abilities.join(' ') : '',
      entry.comment || '',
      ...(extraFields || []),
    ];
    const blob = parts.join(' ').trim();
    entry.search = {
      full: blob.toLowerCase(),
      norm: normKey(blob),
      cho: toChosung(blob),
      nameCho: toChosung((entry.name || '') + ' ' + (Array.isArray(entry.aliases) ? entry.aliases.join(' ') : '')),
    };
  }

  function countAllCategories(db, rawQuery) {
    const tokens = parseQueryTokens(rawQuery);
    if (!tokens.length || !db) return null;
    const relicsBundle = [
      ...(db.relics || []),
      ...(db.runes || []),
      ...(db.skins || []),
    ];
    return {
      items: (db.items || []).filter(e => matchEntry(e, tokens)).length,
      heroes: (db.heroes || []).filter(e => matchEntry(e, tokens)).length,
      mercenaries: (db.mercenaries || []).filter(e => matchEntry(e, tokens)).length,
      towers: (db.towers || []).filter(e => matchEntry(e, tokens)).length,
      mounts: ((db.mounts && db.mounts.mounts) || []).filter(e => matchEntry(e, tokens)).length,
      pets: ((db.pets && db.pets.pets) || []).filter(e => matchEntry(e, tokens)).length,
      camp: ((db.camp && db.camp.items) || []).filter(e => matchEntry(e, tokens)).length,
      relics: relicsBundle.filter(e => matchEntry(e, tokens)).length,
    };
  }

  global.AraSearchV2 = {
    toChosung,
    normKey,
    parseQueryTokens,
    matchEntry,
    rebuildEntrySearch,
    countAllCategories,
  };
})(window);


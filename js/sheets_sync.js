/**
 * Ara DB VER 3.0 — Live Google Master Sheet Synchronizer (js/sheets_sync.js)
 * Default Master Sheet V3 ID: 1Ln2YWMLTQV9BzcqfDG8ni_5a9v5Nhi7u
 * Supports all 8 data tabs: [아이템, 영웅, 지원용병, 타워, 탈것, 펫, 야영지, 유물_룬_스킨]
 * Works on both HTTP(S) (via fetch CSV) and file:// protocol (via gviz JSONP fallback).
 */
(function (global) {
  'use strict';

  const DEFAULT_SHEET_ID = '1Ln2YWMLTQV9BzcqfDG8ni_5a9v5Nhi7u';
  const STORAGE_SHEET_ID_KEY = 'ara_db_v3_custom_sheet_id_v2';
  const STORAGE_CACHE_KEY = 'ara_db_v3_live_overrides_v2';
  const STORAGE_TIME_KEY = 'ara_db_v3_live_timestamp_v2';

  function extractSheetId(input) {
    const raw = String(input || '').trim();
    if (!raw) return DEFAULT_SHEET_ID;
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    return raw;
  }

  function getActiveSheetId() {
    try {
      return localStorage.getItem(STORAGE_SHEET_ID_KEY) || DEFAULT_SHEET_ID;
    } catch (e) {
      return DEFAULT_SHEET_ID;
    }
  }

  function setActiveSheetId(newIdOrUrl) {
    const cleanId = extractSheetId(newIdOrUrl);
    try {
      if (cleanId) {
        localStorage.setItem(STORAGE_SHEET_ID_KEY, cleanId);
      } else {
        localStorage.removeItem(STORAGE_SHEET_ID_KEY);
        localStorage.removeItem(STORAGE_CACHE_KEY);
      }
    } catch (e) {}
    return cleanId;
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

  function fetchSheetViaJSONP(sheetId, sheetName) {
    return new Promise((resolve, reject) => {
      const cbName = '__araGvizCb_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
      const encoded = encodeURIComponent(sheetName);
      const script = document.createElement('script');
      let timer = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, 10000);

      function cleanup() {
        clearTimeout(timer);
        try { delete global[cbName]; } catch (e) { global[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      global[cbName] = function (resp) {
        cleanup();
        if (!resp || resp.status !== 'ok' || !resp.table) {
          reject(new Error('Invalid gviz response'));
          return;
        }
        const cols = (resp.table.cols || []).map(c => String(c.label || '').trim());
        const rows = [];
        if (cols.some(Boolean)) {
          rows.push(cols);
        }
        for (const r of (resp.table.rows || [])) {
          const cells = (r.c || []).map(cell => {
            if (!cell) return '';
            if (cell.f !== undefined && cell.f !== null) return String(cell.f);
            if (cell.v !== undefined && cell.v !== null) return String(cell.v);
            return '';
          });
          if (cells.some(c => c.trim().length > 0)) {
            rows.push(cells);
          }
        }
        resolve(rows);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('JSONP script error'));
      };
      script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${cbName}&sheet=${encoded}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function fetchSheetCSV(sheetId, sheetName) {
    if (global.location && global.location.protocol !== 'file:') {
      try {
        const encoded = encodeURIComponent(sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encoded}&t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
            return parseCSV(text);
          }
        }
      } catch (e) {
        // Fallback to JSONP below
      }
    }
    return fetchSheetViaJSONP(sheetId, sheetName);
  }

  function buildHeaderMap(headerRow) {
    const map = {};
    (headerRow || []).forEach((h, idx) => {
      const key = String(h || '').replace(/\s+/g, '').toLowerCase();
      if (key) map[key] = idx;
    });
    return map;
  }

  function getCell(row, headerMap, candidateNames) {
    for (const name of candidateNames) {
      const k = name.replace(/\s+/g, '').toLowerCase();
      const idx = headerMap[k];
      if (idx !== undefined && idx < row.length) {
        return String(row[idx] || '').trim();
      }
    }
    return '';
  }

  function hasHeader(headerMap, candidateNames) {
    return candidateNames.some(name => headerMap[name.replace(/\s+/g, '').toLowerCase()] !== undefined);
  }

  function parseTraitsString(str) {
    if (!str || typeof str !== 'string' || !str.trim()) return null;
    const parts = str.split(/\s*\|\s*|\r?\n(?=\[)/).map(s => s.trim()).filter(Boolean);
    const traits = [];
    for (const part of parts) {
      const m = part.match(/^\[(?:Lv\.?)?(\d+)(?:Lv)?(?:\s+([★☆]+))?\]\s*(.*)$/);
      if (m) {
        const unlockLevel = parseInt(m[1], 10);
        const star = (m[2] || '').trim();
        const text = (m[3] || '').trim();
        traits.push({ unlockLevel, text, star });
      } else {
        const m2 = part.match(/^(\d+)(?:Lv|레벨)\s*:?\s*(.*)$/);
        if (m2) {
          traits.push({ unlockLevel: parseInt(m2[1], 10), text: m2[2].trim(), star: '' });
        }
      }
    }
    return traits.length ? traits : null;
  }

  function parseTierValuesString(str) {
    if (!str || typeof str !== 'string' || !str.trim()) return null;
    const tv = {};
    const matches = str.matchAll(/(SSS|SS|S|A|B)\s*[:=]\s*([^|/\n]+)/gi);
    for (const m of matches) {
      tv[m[1].toUpperCase()] = m[2].trim();
    }
    return Object.keys(tv).length ? tv : null;
  }

  function parseWaveBuffsString(str) {
    if (!str || typeof str !== 'string' || !str.trim()) return null;
    const parts = str.split(/\s*\|\s*|\r?\n(?=\[)/).map(s => s.trim()).filter(Boolean);
    const buffs = [];
    for (const part of parts) {
      const m = part.match(/^\[(?:Lv\.?)?(\d+)(?:Lv)?(?:[·\s]+(\d+)회?)?\]\s*(.*)$/);
      if (m) {
        const towerLv = parseInt(m[1], 10);
        const maxPickCount = m[2] ? parseInt(m[2], 10) : 1;
        const text = (m[3] || '').trim();
        buffs.push({ towerLv, maxPickCount, text });
      }
    }
    return buffs.length ? buffs : null;
  }

  function parseRowsToOverrides(rows) {
    if (!rows || rows.length < 2) return [];
    const hMap = buildHeaderMap(rows[0]);
    const hasCommentCol = hasHeader(hMap, ['코멘트', '한줄평', '비고', '설명/코멘트']);
    const list = [];
    const searchHelper = global.AraSearchV3 || global.AraSearchV2;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const officialId = getCell(r, hMap, ['공식id', 'parserid']);
      const name = getCell(r, hMap, ['아이템명', '영웅명', '영웅', '용병명', '타워명', '타워', '탈것명', '펫이름', '펫명', '펫', '이름', '종류']);
      if (!officialId && !name) continue;

      const subType = getCell(r, hMap, ['구분', '분류']);
      const tier = getCell(r, hMap, ['티어', '종합티어']);
      const grade = getCell(r, hMap, ['펫등급', '종합등급', '등급', '희귀도', '최소등급']);
      const usage = getCell(r, hMap, ['사용여부', '추천용도']);
      const tagsRaw = getCell(r, hMap, ['주요옵션']);
      const dropsRaw = getCell(r, hMap, ['드랍', '획득스테이지', '획득처', '획득처(뽑기)', '대상영웅/획득처']);
      const recommend = getCell(r, hMap, ['추천도', '영웅덱추천', '추천', '영웅덱추천타워']);
      const aliasesRaw = getCell(r, hMap, ['별칭(검색어)', '별칭', '검색어']);
      const comment = getCell(r, hMap, ['코멘트', '한줄평', '비고', '설명/코멘트']);
      const ability = getCell(r, hMap, ['능력', '기본패시브/스킬', '공식효과', '보유효과', '타워설명', '보유/장착능력치', '기본능력', '능력치(최소~신등급)']);
      const ability0 = getCell(r, hMap, ['능력(0각성)', '기본스탯(0성)']);
      const ability5 = getCell(r, hMap, ['5각성변화', '5성각성효과']);
      const traitsRaw = getCell(r, hMap, ['레벨별추가능력·별점(★☆)', '레벨별추가능력', '레벨별특성(3/6/9/12/15)', '레벨별특성', '특성']);
      const traits = parseTraitsString(traitsRaw);
      const tierValuesRaw = getCell(r, hMap, ['등급별수치(b/a/s/ss/sss)', 'b/a/s/ss/sss수치']);
      const tierValues = parseTierValuesString(tierValuesRaw);
      const waveBuffsRaw = getCell(r, hMap, ['추가버프선택(lv.0/1/4/8/12/16)', '웨이브버프요약(lv.0/1/4/8/12/16)', '웨이브버프', '추가버프선택']);
      const waveBuffs = parseWaveBuffsString(waveBuffsRaw);
      const acquisition = getCell(r, hMap, ['대상영웅/획득처', '획득처', '획득처(뽑기)', '해금조건(퀘스트)']);
      const poolType = getCell(r, hMap, ['합성분류']);
      const typeName = getCell(r, hMap, ['분류']);
      const level = getCell(r, hMap, ['해금레벨', '레벨']);

      list.push({
        officialId: officialId ? String(Math.trunc(Number(officialId)) || officialId) : '',
        name,
        normName: searchHelper ? searchHelper.normKey(name) : name,
        subType,
        tier,
        grade,
        usage,
        tags: tagsRaw ? tagsRaw.split(/[,]+/).map(s => s.trim()).filter(Boolean) : null,
        drops: dropsRaw ? dropsRaw.split(/[,]+/).map(s => s.trim()).filter(Boolean) : null,
        recommend,
        aliases: aliasesRaw ? aliasesRaw.split(/[,/]+/).map(s => s.trim()).filter(Boolean) : null,
        hasCommentCol,
        comment,
        ability,
        ability0,
        ability5,
        traits,
        tierValues,
        waveBuffs,
        acquisition,
        poolType,
        typeName,
        level,
      });
    }
    return list;
  }

  function applyListOverrides(targetArray, overrideList, subTypeFilter) {
    if (!Array.isArray(targetArray) || !Array.isArray(overrideList) || !overrideList.length) return 0;
    const byId = new Map();
    const byNorm = new Map();
    const searchHelper = global.AraSearchV3 || global.AraSearchV2;

    for (const ov of overrideList) {
      if (subTypeFilter && ov.subType && !ov.subType.includes(subTypeFilter)) continue;
      if (ov.officialId) byId.set(String(ov.officialId), ov);
      if (ov.normName) byNorm.set(ov.normName, ov);
    }

    let updatedCount = 0;
    for (const item of targetArray) {
      const normName = searchHelper ? searchHelper.normKey(item.name) : item.name;
      const ov = byId.get(String(item.officialId)) || byNorm.get(normName);
      if (!ov) continue;

      let changed = false;
      if (ov.tier && 'tier' in item) { item.tier = ov.tier; changed = true; }
      if (ov.grade && ('cat' in item || 'dropRaw' in item || 'grade' in item)) { item.grade = ov.grade; changed = true; }
      if (ov.usage && 'usage' in item) {
        item.usage = ov.usage;
        changed = true;
      }
      if (ov.tags && 'tags' in item) {
        item.tags = ov.tags;
        changed = true;
      }
      if (ov.drops && 'drops' in item) {
        item.drops = ov.drops;
        changed = true;
      }
      if (ov.recommend) {
        if ('recommend' in item) item.recommend = ov.recommend;
        if ('heroDeckRec' in item) item.heroDeckRec = ov.recommend;
        changed = true;
      }
      if (ov.aliases && 'aliases' in item) {
        item.aliases = ov.aliases;
        changed = true;
      }
      if (ov.hasCommentCol && 'comment' in item) {
        item.comment = ov.comment;
        changed = true;
      }
      if (ov.ability && 'ability' in item) {
        item.ability = ov.ability;
        changed = true;
      }
      if (ov.ability0 && item.awakening) {
        if (!item.awakening['0']) item.awakening['0'] = { lines: [] };
        item.awakening['0'].lines = [ov.ability0];
        item.abilities = [ov.ability0];
        changed = true;
      }
      if (ov.ability5 && item.awakening) {
        if (!item.awakening['5']) item.awakening['5'] = { lines: [] };
        item.awakening['5'].lines = [ov.ability5];
        changed = true;
      }
      if (ov.tierValues && 'tierValues' in item) {
        item.tierValues = { ...(item.tierValues || {}), ...ov.tierValues };
        changed = true;
      }
      if (ov.waveBuffs && ov.waveBuffs.length && Array.isArray(item.waveBuffs)) {
        item.waveBuffs = ov.waveBuffs;
        changed = true;
      }
      if (ov.poolType && 'poolType' in item) {
        item.poolType = ov.poolType;
        changed = true;
      }
      if (ov.typeName && 'typeName' in item) {
        item.typeName = ov.typeName;
        changed = true;
      }
      if (ov.level && 'level' in item) {
        item.level = ov.level;
        changed = true;
      }
      if (ov.acquisition) {
        if ('acquisition' in item) item.acquisition = ov.acquisition;
        if ('heroName' in item && !item.heroName) item.heroName = ov.acquisition;
        changed = true;
      }
      if (ov.traits && ov.traits.length && Array.isArray(item.traits)) {
        const traitMap = new Map(ov.traits.map(t => [t.unlockLevel, t]));
        item.levels = item.levels || {};
        item.traits = item.traits.map(orig => {
          const matched = traitMap.get(orig.unlockLevel);
          if (matched) {
            item.levels['lv' + orig.unlockLevel] = matched.text || orig.text;
            return {
              ...orig,
              text: matched.text || orig.text,
              star: matched.star !== undefined ? matched.star : orig.star,
            };
          }
          return orig;
        });
        changed = true;
      }

      if (changed) {
        if (searchHelper) {
          searchHelper.rebuildEntrySearch(item);
        }
        updatedCount++;
      }
    }
    return updatedCount;
  }

  function parseRowsToPatchNotes(rows) {
    if (!rows || rows.length < 1) return [];
    const hMap = buildHeaderMap(rows[0]);
    const verCols = ['버전', '패치버전', '업데이트버전', '회차', 'version', 'ver'];
    const dateCols = ['날짜', '패치날짜', '업데이트날짜', '일자', '일시', 'date'];
    const catCols = ['구분', '분류', '카테고리', '항목', '패치구분', 'type', 'category'];
    const titleCols = ['제목', '패치제목', '요약', '대상', '내용요약', '항목명', 'title'];
    const contentCols = ['내용', '상세내용', '패치내용', '설명', '내역', '상세', '업데이트내용', 'content', 'desc'];
    const pinCols = ['고정', '중요', '강조', '핀', 'pin', 'important'];

    const hasKnownHeader =
      hasHeader(hMap, verCols) ||
      hasHeader(hMap, dateCols) ||
      hasHeader(hMap, catCols) ||
      hasHeader(hMap, titleCols) ||
      hasHeader(hMap, contentCols);

    const startIdx = hasKnownHeader ? 1 : 0;
    const notes = [];
    let lastVersion = '';
    let lastDate = '';

    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => String(c || '').trim().length > 0)) continue;

      let version = '';
      let date = '';
      let category = '';
      let title = '';
      let content = '';
      let pinnedRaw = '';

      if (hasKnownHeader) {
        version = getCell(r, hMap, verCols);
        date = getCell(r, hMap, dateCols);
        category = getCell(r, hMap, catCols);
        title = getCell(r, hMap, titleCols);
        content = getCell(r, hMap, contentCols);
        pinnedRaw = getCell(r, hMap, pinCols);
      } else {
        // Positional fallback: [버전, 날짜, 구분, 제목, 내용, 고정]
        version = String(r[0] || '').trim();
        date = String(r[1] || '').trim();
        category = String(r[2] || '').trim();
        title = String(r[3] || '').trim();
        content = String(r[4] !== undefined ? r[4] : (r[3] || '')).trim();
        pinnedRaw = String(r[5] || '').trim();
      }

      if (!version && !date && !title && !content) continue;

      if (version) lastVersion = version;
      if (date) lastDate = date;

      const effVersion = version || lastVersion || date || lastDate || '인게임 업데이트';
      const effDate = date || lastDate || '';

      // If only title is filled and content is empty, treat title as content if no content column exists
      if (!content && title && !hasHeader(hMap, contentCols)) {
        content = title;
        title = '';
      }

      notes.push({
        id: 'patch_' + i,
        version: effVersion,
        date: effDate,
        category: category || '업데이트',
        title: title || '',
        content: content || '',
        pinned: /^(o|ㅇ|true|1|★|☆|고정|중요|y|yes)$/i.test(String(pinnedRaw || '').trim()),
      });
    }
    return notes;
  }

  function applyAllOverridesToDB(db, overridesBundle) {
    if (!db || !overridesBundle) return 0;
    let total = 0;
    total += applyListOverrides(db.items, overridesBundle.items);
    total += applyListOverrides(db.heroes, overridesBundle.heroes);
    total += applyListOverrides(db.mercenaries, overridesBundle.mercenaries);
    total += applyListOverrides(db.towers, overridesBundle.towers);
    total += applyListOverrides(db.mounts && db.mounts.mounts, overridesBundle.mounts);
    total += applyListOverrides(db.pets && db.pets.pets, overridesBundle.pets);
    total += applyListOverrides(db.camp && db.camp.items, overridesBundle.camp);
    if (overridesBundle.etc) {
      total += applyListOverrides(db.relics, overridesBundle.etc, '유물');
      total += applyListOverrides(db.runes, overridesBundle.etc, '룬');
      total += applyListOverrides(db.skins, overridesBundle.etc, '스킨');
    }
    if (Array.isArray(overridesBundle.patchNotes) && overridesBundle.patchNotes.length > 0) {
      db.patchNotes = overridesBundle.patchNotes;
      total += overridesBundle.patchNotes.length;
    }
    return total;
  }

  async function syncFromGoogleSheets(db, onStatusOrOptions) {
    const onStatus = typeof onStatusOrOptions === 'function' ? onStatusOrOptions : null;
    const sheetId = getActiveSheetId();
    if (!sheetId) {
      if (onStatus) onStatus('idle', '로컬 V3 활성');
      return { ok: false, successTabs: 0, updated: 0 };
    }

    if (onStatus) onStatus('syncing', 'V3 시트 동기화 중...');

    try {
      const cachedRaw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.sheetId === sheetId && cached.bundle) {
          applyAllOverridesToDB(db, cached.bundle);
        }
      }
    } catch (e) {}

    const sheetTabs = [
      { key: 'items', names: ['아이템'] },
      { key: 'heroes', names: ['영웅'] },
      { key: 'mercenaries', names: ['지원용병', '지원 용병'] },
      { key: 'towers', names: ['타워', '전체 타워'] },
      { key: 'mounts', names: ['탈것'] },
      { key: 'pets', names: ['펫'] },
      { key: 'camp', names: ['야영지'] },
      { key: 'etc', names: ['유물_룬_스킨', '스킨'] },
      { key: 'patchNotes', names: ['패치노트', '패치 노트', '인게임패치', '업데이트'], isPatchNote: true },
    ];

    const bundle = {};
    let successTabs = 0;

    await Promise.all(sheetTabs.map(async (tab) => {
      for (const tabName of tab.names) {
        try {
          const rows = await fetchSheetCSV(sheetId, tabName);
          if (rows && rows.length > 0) {
            const parsed = tab.isPatchNote ? parseRowsToPatchNotes(rows) : (rows.length > 1 ? parseRowsToOverrides(rows) : []);
            if (parsed.length > 0) {
              bundle[tab.key] = parsed;
              successTabs++;
              break;
            }
          }
        } catch (err) {}
      }
    }));

    if (successTabs === 0) {
      if (onStatus) onStatus('idle', '로컬 V3 활성');
      return { ok: false, sheetId, successTabs: 0, updated: 0 };
    }

    const updated = applyAllOverridesToDB(db, bundle);
    const nowStr = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit'
    });

    try {
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify({ sheetId, bundle }));
      localStorage.setItem(STORAGE_TIME_KEY, nowStr);
    } catch (e) {}

    if (onStatus) onStatus('ok', `V3 시트 연동됨 (${successTabs}개 탭)`);

    return {
      ok: true,
      sheetId,
      successTabs,
      updated,
      fetchedTabs: successTabs,
      updatedRows: updated,
      timestamp: nowStr,
    };
  }

  async function syncPatchNotesOnly(db) {
    const sheetId = getActiveSheetId();
    if (!sheetId) return { ok: false, count: 0 };
    const candidateNames = ['패치노트', '패치 노트', '인게임패치', '업데이트'];
    for (const tabName of candidateNames) {
      try {
        const rows = await fetchSheetCSV(sheetId, tabName);
        if (rows && rows.length > 0) {
          const parsed = parseRowsToPatchNotes(rows);
          if (parsed.length > 0) {
            if (db) db.patchNotes = parsed;
            try {
              const cachedRaw = localStorage.getItem(STORAGE_CACHE_KEY);
              const cached = cachedRaw ? JSON.parse(cachedRaw) : { sheetId, bundle: {} };
              if (cached && cached.bundle) {
                cached.bundle.patchNotes = parsed;
                localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cached));
              }
            } catch (e) {}
            return { ok: true, count: parsed.length, notes: parsed };
          }
        }
      } catch (err) {}
    }
    return { ok: false, count: 0 };
  }

  global.AraSheetsSyncV3 = {
    DEFAULT_SHEET_ID,
    getActiveSheetId,
    setActiveSheetId,
    syncFromGoogleSheets,
    syncPatchNotesOnly,
    getLastSyncTime: function () {
      try { return localStorage.getItem(STORAGE_TIME_KEY) || ''; } catch (e) { return ''; }
    },
  };
  global.AraSheetsSyncV2 = global.AraSheetsSyncV3;
})(window);

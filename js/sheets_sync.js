/**
 * Ara DB VER 2.0 — Live Google Master Sheet Synchronizer (js/sheets_sync.js)
 * Supports:
 *  - Ara_DB_V2_구글시트_마스터.xlsx sheets:
 *    [아이템, 영웅, 지원용병, 타워, 탈것, 펫, 야영지, 유물_룬_스킨]
 *  - Legacy V1 Google Sheet compatibility (DEFAULT_SHEET_ID: 1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi)
 *  - Custom Google Sheet URL or ID configuration via UI modal
 */
(function (global) {
  'use strict';

  const DEFAULT_SHEET_ID = '1MnjLbc4A9bggvl87ZG77dpzvaMCnFoWy';
  const STORAGE_SHEET_ID_KEY = 'ara_db_v2_custom_sheet_id_v3';
  const STORAGE_CACHE_KEY = 'ara_db_v2_live_overrides_v4';
  const STORAGE_TIME_KEY = 'ara_db_v2_live_timestamp_v4';

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

  async function fetchSheetCSV(sheetId, sheetName) {
    const encoded = encodeURIComponent(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encoded}&t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Sheet not public or tab missing');
    }
    return parseCSV(text);
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

  function parseRowsToOverrides(rows) {
    if (!rows || rows.length < 2) return [];
    const hMap = buildHeaderMap(rows[0]);
    const hasCommentCol = hasHeader(hMap, ['코멘트', '한줄평', '비고', '설명/코멘트']);
    const list = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const officialId = getCell(r, hMap, ['공식id', 'parserid']);
      const name = getCell(r, hMap, ['아이템명', '영웅명', '영웅', '용병명', '타워명', '타워', '탈것명', '펫이름', '펫명', '펫', '이름', '종류']);
      if (!officialId && !name) continue;

      const subType = getCell(r, hMap, ['구분', '분류']);
      const tier = getCell(r, hMap, ['티어', '종합티어']);
      const grade = getCell(r, hMap, ['펫등급', '종합등급', '등급']);
      const usage = getCell(r, hMap, ['사용여부']);
      const tagsRaw = getCell(r, hMap, ['주요옵션']);
      const dropsRaw = getCell(r, hMap, ['드랍']);
      const recommend = getCell(r, hMap, ['추천도', '영웅덱추천', '추천']);
      const aliasesRaw = getCell(r, hMap, ['별칭(검색어)', '별칭', '검색어']);
      const comment = getCell(r, hMap, ['코멘트', '한줄평', '비고', '설명/코멘트']);

      list.push({
        officialId,
        name,
        normName: global.AraSearchV2 ? global.AraSearchV2.normKey(name) : name,
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
      });
    }
    return list;
  }

  function applyListOverrides(targetArray, overrideList, subTypeFilter) {
    if (!Array.isArray(targetArray) || !Array.isArray(overrideList) || !overrideList.length) return 0;
    const byId = new Map();
    const byNorm = new Map();

    for (const ov of overrideList) {
      if (subTypeFilter && ov.subType && !ov.subType.includes(subTypeFilter)) continue;
      if (ov.officialId) byId.set(String(ov.officialId), ov);
      if (ov.normName) byNorm.set(ov.normName, ov);
    }

    let updatedCount = 0;
    for (const item of targetArray) {
      const normName = global.AraSearchV2 ? global.AraSearchV2.normKey(item.name) : item.name;
      const ov = byId.get(String(item.officialId)) || byNorm.get(normName);
      if (!ov) continue;

      let changed = false;
      if (ov.tier && 'tier' in item) { item.tier = ov.tier; changed = true; }
      if (ov.grade && ('cat' in item || 'dropRaw' in item)) { item.grade = ov.grade; changed = true; }
      if (ov.usage && 'usage' in item) {
        item.usage = ov.usage.split(/[/,\s]+/).filter(Boolean);
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

      if (changed) {
        updatedCount++;
        if (global.AraSearchV2) {
          global.AraSearchV2.rebuildEntrySearch(item);
        }
      }
    }
    return updatedCount;
  }

  function applyOverridesToDB(db, overridesBundle) {
    if (!db || !overridesBundle) return 0;
    let total = 0;
    total += applyListOverrides(db.items, overridesBundle.items);
    total += applyListOverrides(db.heroes, overridesBundle.heroes);
    total += applyListOverrides(db.mercenaries, overridesBundle.mercenaries);
    total += applyListOverrides(db.towers, overridesBundle.towers);
    total += applyListOverrides(db.mounts && db.mounts.mounts, overridesBundle.mounts);
    total += applyListOverrides(db.pets && db.pets.pets, overridesBundle.pets);
    total += applyListOverrides(db.camp && db.camp.items, overridesBundle.camp);
    total += applyListOverrides(db.relics, overridesBundle.etc, '유물');
    total += applyListOverrides(db.runes, overridesBundle.etc, '룬');
    total += applyListOverrides(db.skins, overridesBundle.etc, '스킨');
    return total;
  }

  async function syncFromGoogleSheets(db, onStatus) {
    const sheetId = getActiveSheetId();
    if (!sheetId) {
      if (onStatus) onStatus('idle', '로컬 최신DB 활성');
      return { ok: false, successTabs: 0, updated: 0 };
    }
    if (onStatus) onStatus('syncing', '시트 동기화 중...');

    // Apply cached overrides immediately if available
    try {
      const cached = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cached) {
        applyOverridesToDB(db, JSON.parse(cached));
      }
    } catch (e) {}

    const sheetSpecs = [
      { key: 'items', candidates: ['아이템'] },
      { key: 'heroes', candidates: ['영웅'] },
      { key: 'mercenaries', candidates: ['지원용병', '지원 용병'] },
      { key: 'towers', candidates: ['타워', '전체 타워'] },
      { key: 'mounts', candidates: ['탈것'] },
      { key: 'pets', candidates: ['펫'] },
      { key: 'camp', candidates: ['야영지'] },
      { key: 'etc', candidates: ['유물_룬_스킨', '스킨'] },
    ];

    const bundle = {};
    let successTabs = 0;

    await Promise.all(sheetSpecs.map(async spec => {
      for (const tabName of spec.candidates) {
        try {
          const rows = await fetchSheetCSV(sheetId, tabName);
          const parsed = parseRowsToOverrides(rows);
          if (parsed.length > 0) {
            bundle[spec.key] = parsed;
            successTabs++;
            break;
          }
        } catch (err) {
          // Try next candidate tab name
        }
      }
    }));

    if (successTabs > 0) {
      const updated = applyOverridesToDB(db, bundle);
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(bundle));
        localStorage.setItem(STORAGE_TIME_KEY, new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {}
      if (onStatus) onStatus('ok', `시트 연동됨 (${successTabs}개 탭 · ${updated}건 반영)`);
      return { ok: true, successTabs, updated };
    } else {
      if (onStatus) onStatus('idle', '로컬 최신DB 활성');
      return { ok: false, successTabs: 0, updated: 0 };
    }
  }

  global.AraSheetsSyncV2 = {
    DEFAULT_SHEET_ID,
    getActiveSheetId,
    setActiveSheetId,
    syncFromGoogleSheets,
  };
})(window);


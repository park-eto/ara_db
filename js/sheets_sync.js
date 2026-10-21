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
  const CACHE_KEY = 'underdark_live_expansion_cache';
  const CACHE_TIME_KEY = 'underdark_live_expansion_timestamp';
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
      const ability = get('고유 능력');

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

    // Fetch all 5 sheets concurrently
    const [heroRows, mercRows, mountRows, subOptRows, petRows] = await Promise.all([
      fetchSheetCSV('영웅'),
      fetchSheetCSV('지원용병'),
      fetchSheetCSV('탈것'),
      fetchSheetCSV('탈것 부옵션'),
      fetchSheetCSV('펫')
    ]);

    const heroes = syncHeroesFromRows(heroRows, existingHeroesMap);
    const mercs = syncMercenariesFromRows(mercRows, existingMercsMap);
    const mounts = syncMountsFromRows(mountRows, existingMountsMap);
    const subOptions = syncMountSubOptionsFromRows(subOptRows);
    const pets = syncPetsFromRows(petRows, existingPetsMap);

    const bundle = {
      heroes: heroes.length ? heroes : base.heroes,
      mercenaries: mercs.length ? mercs : base.mercenaries,
      mounts: mounts.length ? mounts : base.mounts,
      mountSubOptions: (subOptions.tower.length || subOptions.hero.length || subOptions.common.length) ? subOptions : base.mountSubOptions,
      pets: pets.length ? pets : base.pets,
      petGuide: base.petGuide || {}
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

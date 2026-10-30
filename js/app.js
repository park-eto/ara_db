/**
 * Ara DB VER 2.0 — Main Application Controller (js/app.js)
 * Mobile-First + High-Density Desktop UI
 */
(function () {
  'use strict';

  const DB = window.ARA_DB_V2;
  const Search = window.AraSearchV2;
  const SheetsSync = window.AraSheetsSyncV2;

  if (!DB) {
    console.error('ARA_DB_V2 data not loaded.');
    return;
  }

  const CATEGORY_ICONS = {
    items: 'assets/icons/InGameUI/Weapon_011.webp',
    heroes: 'assets/icons/OutGameUI/icon_skin.png',
    mercenaries: 'assets/icons/Reward2/Icon_Hero_009.webp',
    towers: 'assets/icons/Reward2/Icon_Tower_036.webp',
    mounts: 'assets/icons/Reward2/Vehicle_117.webp',
    pets: 'assets/icons/Reward2/Pet_1.webp',
    camp: 'assets/icons/Reward2/Housing_S_28.webp',
    relics: 'assets/icons/InGameUI/Rune_Stone_3.webp',
  };

  const STATE = {
    tab: 'items',
    query: '',
    viewMode: window.innerWidth <= 860 ? 'grid' : 'table',
    sortBy: 'default',
    globalAwk: '0',
    filters: {
      items: { cat: 'all', range: 'all', grade: 'all', usage: 'all' },
      heroes: { subView: 'heroes', grade: 'all', tier: 'all', skinType: 'all' },
      mercenaries: { recommend: 'all', grade: 'all' },
      towers: { grade: 'all', deck: 'all' },
      mounts: { pool: 'all', subView: 'list' },
      pets: { grade: 'all', subView: 'list' },
      camp: { type: 'all', level: 'all', subView: 'list' },
      relics: { subType: 'relic' },
    },
  };

  const QUICK_CHIPS_BY_TAB = {
    items: [
      { label: '🔥 S등급', q: 'S+' },
      { label: '💥 치피>=60', q: '치피>=60' },
      { label: '🏹 투사체>=1', q: '투사체>=1' },
      { label: '⚡ 공속>=40', q: '공속>=40' },
      { label: '🎯 관통', q: '관통' },
      { label: '💀 처형', q: '처형' },
      { label: '💫 스턴', q: '스턴' },
      { label: '❄️ 감속', q: '감속' },
      { label: '🌊 스플래시', q: '스플래시' },
    ],
    heroes: [
      { label: '🔥 SSS티어', q: 'SSS' },
      { label: '⭐ SS티어', q: 'SS' },
      { label: '💥 치명타', q: '치명타' },
      { label: '⚔️ 공격력', q: '공격력' },
      { label: '💫 스턴', q: '스턴' },
      { label: '❄️ 감속', q: '감속' },
      { label: '👑 보스', q: '보스' },
    ],
    mercenaries: [
      { label: '🌟 SSS추천', q: 'SSS' },
      { label: '⭐ SS추천', q: 'SS' },
      { label: '👍 S추천', q: 'S' },
      { label: '⚔️ 공격력', q: '공격력' },
      { label: '💥 치명타', q: '치명타' },
      { label: '⚡ 공격 속도', q: '공격 속도' },
    ],
    towers: [
      { label: '🏆 영웅덱 추천', q: '영웅덱' },
      { label: '⚔️ 공격력 버프', q: '공격력' },
      { label: '⚡ 공격속도 버프', q: '공격 속도' },
      { label: '💥 치명타', q: '치명타' },
      { label: '💫 스턴/기절', q: '스턴' },
    ],
    mounts: [
      { label: '💎 고급 합성', q: '고급 합성' },
      { label: '🎲 일반 합성', q: '일반 합성' },
      { label: '⚔️ 영웅 공격력', q: '영웅의 공격력' },
      { label: '🏰 타워 공격력', q: '타워의 공격력' },
      { label: '💥 치명타 피해', q: '치명타 피해' },
    ],
    pets: [
      { label: '🔥 S등급', q: 'S+' },
      { label: '⭐ A등급', q: 'A+' },
      { label: '⚔️ 공격력', q: '공격력' },
      { label: '💥 치명타', q: '치명타' },
      { label: '👑 보스 피해', q: '보스' },
    ],
    camp: [
      { label: '🏛️ 구조물', q: '구조물' },
      { label: '🏺 소품', q: '소품' },
      { label: '🌄 배경', q: '배경' },
      { label: '🔓 기본 해금', q: '기본' },
      { label: '⚔️ 공격력', q: '공격력' },
      { label: '💥 치명타', q: '치명타' },
    ],
    relics: [
      { label: '⏱️ 쿨타임', q: '쿨타임' },
      { label: '💠 문양', q: '문양' },
      { label: '💥 치명타', q: '치명타' },
      { label: '⚔️ 공격력', q: '공격력' },
      { label: '👑 보스', q: '보스' },
    ],
    growth: [],
  };

  const TAB_TITLES = {
    items: '장비 도감 (공식 0~5각성)',
    heroes: '영웅 · 스킨 도감',
    mercenaries: '지원용병 도감 (B~SSS)',
    towers: '타워 · 인게임 웨이브 버프 도감',
    mounts: '탈것 도감 · 부옵션/강화표',
    pets: '펫 도감 · 드랍 가이드',
    camp: '야영지 도감 (구조물·소품·배경)',
    relics: '유물 · 룬 도감',
    growth: '📈 공식 성장 테이블 & 스탯 계산기',
  };

  // DOM Elements
  const els = {
    searchInput: document.getElementById('globalSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    crossMatchBar: document.getElementById('crossMatchBar'),
    primaryNav: document.getElementById('primaryNav'),
    mobileBottomNav: document.getElementById('mobileBottomNav'),
    contextToolbar: document.getElementById('contextToolbar'),
    quickChipsBar: document.getElementById('quickChipsBar'),
    resultsHeader: document.getElementById('resultsHeader'),
    resultsCategoryTitle: document.getElementById('resultsCategoryTitle'),
    resultsCountBadge: document.getElementById('resultsCountBadge'),
    activeFilterSummary: document.getElementById('activeFilterSummary'),
    awkGlobalToggleWrap: document.getElementById('awkGlobalToggleWrap'),
    globalAwkSeg: document.getElementById('globalAwkSeg'),
    sortSelect: document.getElementById('sortSelect'),
    contentStage: document.getElementById('contentStage'),
    detailModalBackdrop: document.getElementById('detailModalBackdrop'),
    modalHeaderContent: document.getElementById('modalHeaderContent'),
    modalBodyContent: document.getElementById('modalBodyContent'),
    closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
    sheetConfigBackdrop: document.getElementById('sheetConfigBackdrop'),
    openSheetModalBtn: document.getElementById('openSheetModalBtn'),
    closeSheetModalBtn: document.getElementById('closeSheetModalBtn'),
    sheetIdInput: document.getElementById('sheetIdInput'),
    saveAndSyncSheetBtn: document.getElementById('saveAndSyncSheetBtn'),
    resetSheetIdBtn: document.getElementById('resetSheetIdBtn'),
    sheetSyncLog: document.getElementById('sheetSyncLog'),
    syncStatusDot: document.getElementById('syncStatusDot'),
    syncStatusText: document.getElementById('syncStatusText'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    brandHomeBtn: document.getElementById('brandHomeBtn'),
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tierBadgeClass(tierStr) {
    const s = String(tierStr || '').trim().toUpperCase();
    if (!s) return '';
    if (s.startsWith('SSS') || s.startsWith('SS') || s.startsWith('S') || s === 'O' || s.includes('필수') || s === '추천') return 'badge-tier-0';
    if (s.startsWith('A') || s === '△') return 'badge-tier-1';
    if (s.startsWith('B')) return 'badge-tier-2';
    return '';
  }

  function tierRankScore(item) {
    const t = String(item.tier || item.grade || item.recommend || item.heroDeckRec || '').trim().toUpperCase();
    if (!t) return 99;
    if (t === 'SSS') return 1;
    if (t === 'SSS-') return 2;
    if (t === 'SS' || t.includes('필수')) return 3;
    if (t === 'S+' || t === 'S~S+' || t === 'S+~S') return 4;
    if (t === 'S' || t === '추천') return 5;
    if (t === 'S-' || t === 'S~S-' || t === 'S-~A+') return 6;
    if (t === 'A+') return 7;
    if (t === 'A' || t === 'A~A+') return 8;
    if (t === 'A-' || t === 'A~A-') return 9;
    if (t === 'B+' || t === 'B~B+') return 10;
    if (t === 'B') return 11;
    if (t === 'B-' || t === 'B~B-') return 12;
    if (t.startsWith('C')) return 13;
    if (t.startsWith('D')) return 14;
    if (t.startsWith('E')) return 15;
    if (t.startsWith('F') || t === 'X' || t === 'J') return 16;
    return 99;
  }

  // =========================================================================
  // Official Item Main Stat Calculator Helper
  // =========================================================================
  const GRADE_COL_MAP = {
    '4': ['Att_Basic', 'Att_LvUp'],
    '3': ['AllAtt_Basic', 'AllAtt_LvUp'],
    '1': ['Tower_Basic', 'Tower_LvUp'],
    '10': ['Hp_Basic', 'Hp_LvUp'],
  };
  const AWK_MAIN_BONUS = [0, 50, 120, 200, 300, 400];

  function calculateItemMainStat(item, gradeIdx, level, qualityPct, awkLv) {
    const gradeTable = (DB.itemMeta && DB.itemMeta.gradeTable) || [];
    const gRow = gradeTable[gradeIdx] || gradeTable[7] || {};
    const statCode = (item.basicStat && item.basicStat.statCode) || '4';
    const cols = GRADE_COL_MAP[statCode] || GRADE_COL_MAP['4'];
    const basic = parseFloat(gRow[cols[0]] || 0);
    const lvUp = parseFloat(gRow[cols[1]] || 0);
    const effLv = Math.min(Math.max(1, parseInt(level, 10) || 1), 400);
    const q = Math.min(1.1, Math.max(0.9, parseFloat(qualityPct || 100) / 100));

    let s = q * (basic + lvUp * (effLv - 1));
    if (item.cat === 'ring' || (item.basicStat && item.basicStat.isRing)) {
      s *= 0.3;
    }

    const bonus = (gradeIdx === 7 && awkLv > 0) ? (AWK_MAIN_BONUS[awkLv] || 0) : 0;
    if (bonus > 0) {
      if (item.cat === 'weapon' && statCode === '4') {
        s = (100 + s) * (1 + bonus / 100) - 100;
      } else {
        s = s * (1 + bonus / 100);
      }
    }

    const mainPct = Math.round(s);
    let weaponFinalAtk = null;
    if (item.weaponSpecs && item.weaponSpecs.atk > 0) {
      weaponFinalAtk = Math.round(item.weaponSpecs.atk * (1 + s / 100));
    }
    return { mainPct, weaponFinalAtk };
  }

  // =========================================================================
  // Context Filter Bar Builder
  // =========================================================================
  function renderContextToolbar() {
    const tab = STATE.tab;
    els.awkGlobalToggleWrap.style.display = tab === 'items' ? 'flex' : 'none';
    els.resultsHeader.style.display = tab === 'growth' ? 'none' : 'flex';

    if (tab === 'growth') {
      els.contextToolbar.style.display = 'none';
      return;
    }
    els.contextToolbar.style.display = 'flex';

    let html = '';
    if (tab === 'items') {
      const f = STATE.filters.items;
      html += buildFilterRow('분류', 'cat', f.cat, [
        ['all', '전체 (208)'],
        ['weapon', '주 무기'],
        ['sub', '보조 무기'],
        ['helmet', '투구'],
        ['ring', '반지'],
        ['etc', '기타'],
      ]);
      html += buildFilterRow('근/원', 'range', f.range, [
        ['all', '전체'],
        ['근거리', '근거리'],
        ['원거리', '원거리'],
      ]);
      html += buildFilterRow('등급', 'grade', f.grade, [
        ['all', '전체'],
        ['S', 'S등급 (S+/S/S-)'],
        ['A', 'A등급 (A+/A/A-)'],
        ['B', 'B등급 (B+/B/B-)'],
        ['C', 'C등급 (C+/C/C-)'],
        ['D', 'D등급'],
        ['E', 'E등급'],
        ['F', 'F등급'],
      ]);
      html += buildFilterRow('사용여부', 'usage', f.usage, [
        ['all', '전체'],
        ['O', '⭕ O (사용)'],
        ['△', '🔺 △ (상황별)'],
        ['X', '❌ X (미사용)'],
      ]);
    } else if (tab === 'heroes') {
      const f = STATE.filters.heroes;
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['heroes', '영웅 도감 (35종)', 'assets/icons/Reward2/Icon_Hero_001.webp'],
        ['skins', '영웅 스킨 도감 (74종)', 'assets/icons/OutGameUI/icon_skin.png'],
      ]);
      if (f.subView === 'skins') {
        html += buildFilterRow('획득 구분', 'skinType', f.skinType, [
          ['all', '전체 (74종)'],
          ['시즌/이벤트 한정', '시즌/이벤트 한정 (39)'],
          ['일반/이벤트', '일반/이벤트 (16)'],
          ['패스/패키지 한정', '패스/패키지 한정 (11)'],
          ['특별 한정', '특별 한정 (8)'],
        ]);
      } else {
        html += buildFilterRow('등급', 'grade', f.grade, [
          ['all', '전체 (35)'],
          ['전설', '전설'],
          ['희귀', '희귀'],
          ['일반', '일반'],
        ]);
        html += buildFilterRow('티어', 'tier', f.tier, [
          ['all', '전체'],
          ['SSS', 'SSS (SSS/SSS-)'],
          ['SS', 'SS'],
          ['S', 'S'],
          ['A', 'A'],
          ['B', 'B'],
          ['C', 'C'],
          ['D', 'D~F'],
        ]);
      }
    } else if (tab === 'mercenaries') {
      const f = STATE.filters.mercenaries;
      html += buildFilterRow('추천', 'recommend', f.recommend, [
        ['all', '전체 (35)'],
        ['SSS', 'SSS (최고!)'],
        ['SS', 'SS (최고!)'],
        ['S', 'S (최고!)'],
        ['A', 'A (자주 사용)'],
        ['B', 'B (그럭저럭)'],
        ['C', 'C (종종 사용)'],
        ['J', 'J (자사)'],
        ['X', 'X (사용안함)'],
      ]);
      html += buildFilterRow('등급', 'grade', f.grade, [
        ['all', '전체'],
        ['전설', '전설'],
        ['희귀', '희귀'],
        ['일반', '일반'],
      ]);
    } else if (tab === 'towers') {
      const f = STATE.filters.towers;
      html += buildFilterRow('등급', 'grade', f.grade, [
        ['all', '전체 (46)'],
        ['전설', '전설'],
        ['희귀', '희귀'],
        ['일반', '일반'],
      ]);
      html += buildFilterRow('영웅덱', 'deck', f.deck, [
        ['all', '전체 타워'],
        ['heroDeck', '영웅덱 추천 타워만'],
      ]);
    } else if (tab === 'mounts') {
      const f = STATE.filters.mounts;
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['list', '탈것 도감 (57종)', CATEGORY_ICONS.mounts],
        ['subOptions', '📋 탈것 부옵션 30종 표'],
        ['upgrade', '⬆️ 탈것 강화 확률·사료 표'],
      ]);
      if (f.subView === 'list') {
        html += buildFilterRow('합성분류', 'pool', f.pool, [
          ['all', '전체 (57종)'],
          ['일반 합성', '일반 합성 (1~29번 · 29종)'],
          ['고급 합성', '고급 합성 (30~57번 · 28종)'],
        ]);
      }
    } else if (tab === 'pets') {
      const f = STATE.filters.pets;
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['list', '펫 도감 (26종)', CATEGORY_ICONS.pets],
        ['guide', '🗺️ 스테이지별 드랍 & 육성 가이드'],
      ]);
      if (f.subView === 'list') {
        html += buildFilterRow('펫 등급', 'grade', f.grade, [
          ['all', '전체 (26종)'],
          ['S', 'S등급 (S+/S/S-)'],
          ['A', 'A등급 (A+/A/A-)'],
          ['B', 'B등급 (B+/B/B-)'],
          ['C', 'C등급 (C+/C/C-)'],
          ['D', 'D~F등급'],
        ]);
      }
    } else if (tab === 'camp') {
      const f = STATE.filters.camp;
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['list', '야영지 도감 (55종)', CATEGORY_ICONS.camp],
        ['common', '📊 야영지 등급·부옵션·랜덤옵션 표'],
      ]);
      if (f.subView === 'list') {
        html += buildFilterRow('분류', 'type', f.type, [
          ['all', '전체 (55)'],
          ['structure', '구조물 (10)'],
          ['prop', '소품 (34)'],
          ['background', '배경 (11)'],
        ]);
        html += buildFilterRow('레벨', 'level', f.level, [
          ['all', '전체'],
          ['기본', '기본'],
          ['20레벨', '20레벨'],
          ['40레벨', '40레벨'],
          ['60레벨', '60레벨'],
        ]);
      }
    } else if (tab === 'relics') {
      const f = STATE.filters.relics;
      html += buildFilterRow('구분', 'subType', f.subType, [
        ['relic', '유물 (5종)', 'assets/icons/InGameUI/Relics_Full_2.webp'],
        ['rune', '룬 (9종)', CATEGORY_ICONS.relics],
        ['relicGrade', '📊 유물 등급별 수치표'],
      ]);
    }

    els.contextToolbar.innerHTML = html;
  }

  function buildFilterRow(label, filterKey, activeVal, options) {
    const chips = options.map(([val, text, iconPath]) => {
      const cls = val === activeVal ? 'filter-chip active' : 'filter-chip';
      const icHtml = iconPath ? `<img class="chip-ic-img" src="${escapeHtml(iconPath)}" alt="" />` : '';
      return `<button type="button" class="${cls}" data-fkey="${escapeHtml(filterKey)}" data-fval="${escapeHtml(val)}">${icHtml}${escapeHtml(text)}</button>`;
    }).join('');
    return `
      <div class="filter-row">
        <span class="filter-label">${escapeHtml(label)}</span>
        <div class="chip-scroll">${chips}</div>
      </div>
    `;
  }

  function renderQuickChips() {
    const list = QUICK_CHIPS_BY_TAB[STATE.tab] || [];
    if (!list.length) {
      els.quickChipsBar.style.display = 'none';
      return;
    }
    els.quickChipsBar.style.display = 'flex';
    const curQ = STATE.query.trim();
    els.quickChipsBar.innerHTML = `
      <span class="quick-chip-hint">⚡ 빠른 검색칩:</span>
      ${list.map(c => {
        const isActive = curQ === c.q;
        return `<button type="button" class="quick-chip ${isActive ? 'active' : ''}" data-qchip="${escapeHtml(c.q)}">${escapeHtml(c.label)}</button>`;
      }).join('')}
    `;
  }

  function renderCrossCategoryBar() {
    const q = STATE.query.trim();
    if (!q) {
      els.crossMatchBar.hidden = true;
      els.crossMatchBar.innerHTML = '';
      return;
    }
    const counts = Search.countAllCategories(DB, q);
    if (!counts) {
      els.crossMatchBar.hidden = true;
      return;
    }
    const labels = [
      ['items', '장비'],
      ['heroes', '영웅·스킨'],
      ['mercenaries', '지원'],
      ['towers', '타워·버프'],
      ['mounts', '탈것'],
      ['pets', '펫'],
      ['camp', '야영지'],
      ['relics', '유물·룬'],
    ];
    els.crossMatchBar.hidden = false;
    els.crossMatchBar.innerHTML = labels.map(([tabKey, label]) => {
      const cnt = counts[tabKey] || 0;
      const cls = tabKey === STATE.tab ? 'cross-match-pill active' : 'cross-match-pill';
      const icPath = CATEGORY_ICONS[tabKey];
      const icHtml = icPath ? `<img class="cross-ic-img" src="${escapeHtml(icPath)}" alt="" />` : '';
      return `<button type="button" class="${cls}" data-jump-tab="${tabKey}">${icHtml}${escapeHtml(label)} <strong>${cnt}</strong></button>`;
    }).join('');
  }

  // =========================================================================
  // Filtering & Sorting Pipeline
  // =========================================================================
  function getFilteredEntries() {
    const tokens = Search.parseQueryTokens(STATE.query);
    const tab = STATE.tab;
    let list = [];

    if (tab === 'items') {
      const f = STATE.filters.items;
      list = (DB.items || []).filter(it => {
        if (f.cat !== 'all' && it.cat !== f.cat) return false;
        if (f.range !== 'all' && it.range !== f.range) return false;
        if (f.grade !== 'all') {
          const g = String(it.grade || '').trim().toUpperCase();
          if (!g.startsWith(f.grade)) return false;
        }
        if (f.usage !== 'all') {
          const uArr = Array.isArray(it.usage) ? it.usage : [String(it.usage || '')];
          if (!uArr.includes(f.usage)) return false;
        }
        return Search.matchEntry(it, tokens);
      });
    } else if (tab === 'heroes') {
      const f = STATE.filters.heroes;
      const filterHeroes = () => (DB.heroes || []).filter(h => {
        if (f.grade !== 'all' && h.grade !== f.grade) return false;
        if (f.tier !== 'all') {
          const ht = String(h.tier || '').trim().toUpperCase();
          if (f.tier === 'SSS' && !ht.startsWith('SSS')) return false;
          if (f.tier === 'SS' && ht !== 'SS') return false;
          if (f.tier === 'S' && ht !== 'S') return false;
          if (f.tier === 'A' && !ht.startsWith('A')) return false;
          if (f.tier === 'B' && !ht.startsWith('B')) return false;
          if (f.tier === 'C' && !ht.startsWith('C')) return false;
          if (f.tier === 'D' && !['D', 'E', 'F'].some(x => ht.startsWith(x))) return false;
        }
        return Search.matchEntry(h, tokens);
      });
      const filterSkins = () => (DB.skins || []).map(s => ({ ...s, _kind: 'skin', _kindLabel: '스킨' })).filter(s => {
        if (f.skinType !== 'all' && s.purchaseType !== f.skinType) return false;
        return Search.matchEntry(s, tokens);
      });

      list = f.subView === 'skins' ? filterSkins() : filterHeroes();
      if (!list.length && tokens.length > 0) {
        const altSub = f.subView === 'skins' ? 'heroes' : 'skins';
        const altMatches = altSub === 'skins' ? filterSkins() : filterHeroes();
        if (altMatches.length > 0) {
          f.subView = altSub;
          list = altMatches;
          renderContextToolbar();
        }
      }
    } else if (tab === 'mercenaries') {
      const f = STATE.filters.mercenaries;
      list = (DB.mercenaries || []).filter(m => {
        if (f.grade !== 'all' && m.grade !== f.grade) return false;
        if (f.recommend !== 'all') {
          const rec = String(m.recommend || '').trim().toUpperCase();
          if (rec !== f.recommend) return false;
        }
        return Search.matchEntry(m, tokens);
      });
    } else if (tab === 'towers') {
      const f = STATE.filters.towers;
      list = (DB.towers || []).filter(t => {
        if (f.grade !== 'all' && t.grade !== f.grade) return false;
        if (f.deck === 'heroDeck' && !t.heroDeckRec) return false;
        return Search.matchEntry(t, tokens);
      });
    } else if (tab === 'mounts') {
      const f = STATE.filters.mounts;
      list = ((DB.mounts && DB.mounts.mounts) || []).filter(m => {
        if (f.pool !== 'all' && m.poolType !== f.pool) return false;
        return Search.matchEntry(m, tokens);
      });
    } else if (tab === 'pets') {
      const f = STATE.filters.pets;
      list = ((DB.pets && DB.pets.pets) || []).filter(p => {
        if (f.grade !== 'all') {
          const pg = String(p.grade || '').trim().toUpperCase();
          if (f.grade === 'D') {
            if (!['D', 'E', 'F'].some(x => pg.startsWith(x))) return false;
          } else if (!pg.startsWith(f.grade)) {
            return false;
          }
        }
        return Search.matchEntry(p, tokens);
      });
    } else if (tab === 'camp') {
      const f = STATE.filters.camp;
      list = ((DB.camp && DB.camp.items) || []).filter(c => {
        if (f.type !== 'all' && c.type !== f.type) return false;
        if (f.level !== 'all' && c.level !== f.level) return false;
        return Search.matchEntry(c, tokens);
      });
    } else if (tab === 'relics') {
      const f = STATE.filters.relics;
      const combined = [
        ...(DB.relics || []).map(r => ({ ...r, _kind: 'relic', _kindLabel: '유물' })),
        ...(DB.runes || []).map(r => ({ ...r, _kind: 'rune', _kindLabel: '룬' })),
      ];
      let activeSub = (f.subType && f.subType !== 'all' && f.subType !== 'relicGrade' && f.subType !== 'skin') ? f.subType : 'relic';
      list = combined.filter(e => e._kind === activeSub && Search.matchEntry(e, tokens));
      if (!list.length && tokens.length > 0) {
        for (const cand of ['relic', 'rune']) {
          const candMatches = combined.filter(e => e._kind === cand && Search.matchEntry(e, tokens));
          if (candMatches.length > 0) {
            f.subType = cand;
            list = candMatches;
            renderContextToolbar();
            break;
          }
        }
      }
    }

    // Sort
    const sortBy = STATE.sortBy;
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.name).localeCompare(String(b.name), 'ko');
      }
      if (sortBy === 'tier') {
        const diff = tierRankScore(a) - tierRankScore(b);
        if (diff !== 0) return diff;
      }
      if (sortBy === 'grade') {
        const ga = a.gradeRank !== undefined ? a.gradeRank : tierRankScore(a);
        const gb = b.gradeRank !== undefined ? b.gradeRank : tierRankScore(b);
        if (ga !== gb) return ga - gb;
      }
      if (a.no !== undefined && b.no !== undefined && a.no !== b.no) {
        return a.no - b.no;
      }
      return (a.officialId || a.no || 0) - (b.officialId || b.no || 0);
    });

    return list;
  }

  // =========================================================================
  // Stage Renderers (Card Grid, Data Table, Reference Sub-views)
  // =========================================================================
  function renderStage() {
    renderContextToolbar();
    renderQuickChips();
    renderCrossCategoryBar();

    const tab = STATE.tab;
    const catIcon = CATEGORY_ICONS[tab];
    const titleText = TAB_TITLES[tab] || '도감';
    els.resultsCategoryTitle.innerHTML = catIcon
      ? `<img class="cat-title-icon" src="${escapeHtml(catIcon)}" alt="" /><span>${escapeHtml(titleText)}</span>`
      : escapeHtml(titleText);

    if (tab === 'growth') {
      renderGrowthCalculatorStage();
      return;
    }

    // Handle specialized reference sub-views
    if (tab === 'mounts' && STATE.filters.mounts.subView === 'subOptions') {
      renderMountSubOptionsStage();
      return;
    }
    if (tab === 'mounts' && STATE.filters.mounts.subView === 'upgrade') {
      renderMountUpgradeStage();
      return;
    }
    if (tab === 'pets' && STATE.filters.pets.subView === 'guide') {
      renderPetGuideStage();
      return;
    }
    if (tab === 'camp' && STATE.filters.camp.subView === 'common') {
      renderCampCommonStage();
      return;
    }
    if (tab === 'relics' && STATE.filters.relics.subType === 'relicGrade') {
      renderRelicGradeTableStage();
      return;
    }

    const entries = getFilteredEntries();
    els.resultsCountBadge.textContent = `${entries.length}개`;
    els.activeFilterSummary.textContent = STATE.query ? `검색어: "${STATE.query}"` : '';

    if (!entries.length) {
      els.contentStage.innerHTML = `
        <div class="empty-state">
          <h3>조건에 맞는 항목이 없습니다 🔍</h3>
          <p style="margin-top:6px;">검색어나 필터를 초기화해 보세요. (초성 검색 예: <code>ㅂㄷ</code>, 수치 검색 예: <code>치피>=60</code>)</p>
        </div>
      `;
      return;
    }

    if (STATE.viewMode === 'table') {
      renderTableView(tab, entries);
    } else {
      renderCardGridView(tab, entries);
    }
  }

  function renderMercTopBanner() {
    return `
      <div class="modal-section" style="margin-bottom:14px;padding:12px 16px;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;font-size:12.5px;">
          <div>
            <strong>📌 추천도 기준:</strong>
            <span class="badge badge-tier-0" style="margin-left:4px;">SSS / SS / S: 최고!</span>
            <span class="badge badge-tier-1">A: 자주 사용함</span>
            <span class="badge badge-tier-2">B: 그럭저럭 좋음</span>
            <span class="badge">C: 종종 사용</span>
            <span class="badge">J: 자사</span>
            <span class="badge">X: 사용안함</span>
          </div>
          <div style="color:var(--text-secondary);">
            <strong>⚔️ 등급별 필요 레벨 & 모든 공격력 증가:</strong>
            B(5Lv, <strong>+10%</strong>) · A(9Lv, <strong>+20%</strong>) · S(13Lv, <strong>+30%</strong>) · SS(17Lv, <strong style="color:var(--accent-teal);">+40%</strong>) · SSS(20Lv, <strong style="color:var(--accent-amber);">+50%</strong>)
          </div>
        </div>
      </div>
    `;
  }

  function renderCardGridView(tab, entries) {
    const cardsHtml = entries.map(entry => {
      if (tab === 'items') return renderItemCard(entry);
      if (tab === 'heroes') return entry._kind === 'skin' ? renderRelicRuneSkinCard(entry, 'heroes') : renderHeroCard(entry);
      if (tab === 'mercenaries') return renderMercCard(entry);
      if (tab === 'towers') return renderTowerCard(entry);
      if (tab === 'mounts') return renderMountCard(entry);
      if (tab === 'pets') return renderPetCard(entry);
      if (tab === 'camp') return renderCampCard(entry);
      if (tab === 'relics') return renderRelicRuneSkinCard(entry, 'relics');
      return '';
    }).join('');

    const prefixHtml = tab === 'mercenaries' ? renderMercTopBanner() : '';
    els.contentStage.innerHTML = `${prefixHtml}<div class="card-grid">${cardsHtml}</div>`;
  }

  function renderDropBadges(arr) {
    return arr.map(d => `<span class="badge badge-drop">${escapeHtml(d)}</span>`).join('');
  }

  function renderCompactDropCell(dropsArr, fallbackStr, maxShow = 6) {
    const arr = Array.isArray(dropsArr) && dropsArr.length
      ? dropsArr
      : String(fallbackStr || '').split(/,\s*/).filter(Boolean);
    if (!arr.length) return '<span style="color:var(--text-muted);">-</span>';
    const fullTxt = arr.join(', ');
    if (arr.length <= maxShow && fullTxt.length <= 28) {
      return `<div class="drop-cell-wrap"><div class="drop-badges-inline">${renderDropBadges(arr)}</div></div>`;
    }
    const shortArr = arr.slice(0, maxShow);
    const restCnt = arr.length - maxShow;
    return `
      <div class="drop-cell-wrap has-more" title="${escapeHtml(fullTxt)} (클릭하여 펼치기)">
        <span class="drop-short"><span class="drop-badges-inline">${renderDropBadges(shortArr)}<button type="button" class="drop-more-btn" data-toggle-drop="expand">+${restCnt > 0 ? restCnt + '개' : '더보기'}</button></span></span>
        <span class="drop-full" hidden><span class="drop-badges-inline">${renderDropBadges(arr)}<button type="button" class="drop-more-btn" data-toggle-drop="collapse">접기</button></span></span>
      </div>
    `;
  }

  function renderItemCard(it) {
    const awkLv = STATE.globalAwk;
    const awkObj = (it.awakening && it.awakening[awkLv]) || { lines: it.abilities || [] };
    const lines = awkObj.lines && awkObj.lines.length ? awkObj.lines : (it.abilities || []);
    const usageStr = Array.isArray(it.usage) && it.usage.length ? it.usage.join('/') : '';
    const tags = it.tags || [];
    const dropsArr = (it.drops && it.drops.length) ? it.drops : (it.officialStages || []);

    return `
      <article class="db-card" data-open-id="${escapeHtml(it.id)}" data-open-tab="items">
        <div class="card-top">
          <div class="card-icon-box">
            ${it.img ? `<img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.name)}" loading="lazy" />` : '⚔️'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(it.name)}</h3>
              <span class="card-id">No.${it.no || it.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge">${escapeHtml(it.catLabel)}</span>
              ${it.range ? `<span class="badge">${escapeHtml(it.range)}</span>` : ''}
              ${it.grade ? `<span class="badge ${tierBadgeClass(it.grade)}">등급 ${escapeHtml(it.grade)}</span>` : ''}
              ${usageStr ? `<span class="badge ${tierBadgeClass(usageStr)}">사용 ${escapeHtml(usageStr)}</span>` : ''}
              ${awkLv !== '0' ? `<span class="badge badge-awk">★${awkLv}성 기준</span>` : ''}
            </div>
          </div>
        </div>

        <div class="card-abilities">
          ${lines.map((l, idx) => `<div class="ability-line ${idx === 0 && it.explain ? 'explain-line' : ''}">• ${escapeHtml(l)}</div>`).join('')}
        </div>

        ${tags.length ? `
          <div class="card-badges" style="margin-top:2px;">
            ${tags.map(t => `<span class="badge badge-rare">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}

        ${it.comment ? `<div class="card-comment">💬 ${escapeHtml(it.comment)}</div>` : ''}

        <div class="card-footer">
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;" title="${escapeHtml(dropsArr.join(', '))}">
            <span>📍 드랍:</span>
            ${dropsArr.length ? renderCompactDropCell(dropsArr, '', 5) : '<span class="badge badge-drop">-</span>'}
          </div>
          <span style="flex-shrink:0;">상세 · 계산기 ›</span>
        </div>
      </article>
    `;
  }

  function renderHeroCard(h) {
    return `
      <article class="db-card" data-open-id="${escapeHtml(h.id)}" data-open-tab="heroes">
        <div class="card-top">
          <div class="card-icon-box">
            ${h.img ? `<img src="${escapeHtml(h.img)}" alt="${escapeHtml(h.name)}" loading="lazy" />` : '🦸'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(h.name)}</h3>
              <span class="card-id">#${h.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge ${h.grade === '전설' ? 'badge-legend' : 'badge-rare'}">${escapeHtml(h.grade)}</span>
              ${h.tier ? `<span class="badge ${tierBadgeClass(h.tier)}">${escapeHtml(h.tier)}</span>` : ''}
              ${h.skins && h.skins.length ? `<span class="badge badge-level">스킨 ${h.skins.length}종</span>` : ''}
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line">${escapeHtml(h.ability)}</div>
        </div>
        ${h.comment ? `<div class="card-comment">💬 ${escapeHtml(h.comment)}</div>` : ''}
        <div class="card-footer">
          <span>${h.aliases && h.aliases.length ? `별칭: ${escapeHtml(h.aliases.join(', '))}` : `사거리 ${h.specs?.range || '-'} · 공속 ${h.specs?.aspd || '-'}`}</span>
          <span>특성 · 스킨 보기 ›</span>
        </div>
      </article>
    `;
  }

  function renderMercCard(m) {
    const tv = m.tierValues || {};
    return `
      <article class="db-card" data-open-id="${escapeHtml(m.id)}" data-open-tab="mercenaries">
        <div class="card-top">
          <div class="card-icon-box">
            ${m.img ? `<img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.name)}" loading="lazy" />` : '🛡️'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(m.name)}</h3>
              <span class="card-id">#${m.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge ${m.grade === '전설' ? 'badge-legend' : (m.grade === '희귀' ? 'badge-rare' : '')}">${escapeHtml(m.grade)}</span>
              ${m.recommend ? `<span class="badge ${tierBadgeClass(m.recommend)}">추천 ${escapeHtml(m.recommend)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line explain-line">${escapeHtml(m.templateKo || m.ability)}</div>
          <div class="ability-line" style="font-size:12px;">
            B(5Lv): <strong>${escapeHtml(tv.B || '-')}</strong> ·
            A(9Lv): <strong>${escapeHtml(tv.A || '-')}</strong> ·
            S(13Lv): <strong>${escapeHtml(tv.S || '-')}</strong> ·
            SS(17Lv): <strong>${escapeHtml(tv.SS || '-')}</strong> ·
            SSS(20Lv): <strong style="color:var(--accent-amber);">${escapeHtml(tv.SSS || '-')}</strong>
          </div>
        </div>
      </article>
    `;
  }

  function renderTowerCard(t) {
    return `
      <article class="db-card" data-open-id="${escapeHtml(t.id)}" data-open-tab="towers">
        <div class="card-top">
          <div class="card-icon-box">
            ${t.img ? `<img src="${escapeHtml(t.img)}" alt="${escapeHtml(t.name)}" loading="lazy" />` : '🏰'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(t.name)}</h3>
              <span class="card-id">#${t.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge ${t.grade === '전설' ? 'badge-legend' : (t.grade === '희귀' ? 'badge-rare' : '')}">${escapeHtml(t.grade)}</span>
              ${t.heroDeckRec ? `<span class="badge ${tierBadgeClass(t.heroDeckRec)}">추천: ${escapeHtml(t.heroDeckRec)}</span>` : ''}
              <span class="badge badge-level">추가버프 ${t.waveBuffs?.length || 0}종</span>
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line">${escapeHtml(t.ability)}</div>
        </div>
        ${t.comment ? `<div class="card-comment">💬 ${escapeHtml(t.comment)}</div>` : ''}
        <div class="card-footer">
          <span>공격력 ${t.specs?.atk} · 공속 ${t.specs?.aspd} · 사거리 ${t.specs?.range}</span>
          <span>웨이브 버프 보기 ›</span>
        </div>
      </article>
    `;
  }

  function renderMountCard(m) {
    return `
      <article class="db-card" data-open-id="${escapeHtml(m.id)}" data-open-tab="mounts">
        <div class="card-top">
          <div class="card-icon-box">
            ${m.img ? `<img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.name)}" loading="lazy" />` : '🦌'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(m.name)}</h3>
              <span class="card-id">No.${m.no}</span>
            </div>
            <div class="card-badges">
              <span class="badge ${m.poolType === '고급 합성' ? 'badge-legend' : 'badge-rare'}">${escapeHtml(m.poolType)}</span>
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line">${escapeHtml(m.ability)}</div>
        </div>
        ${m.comment ? `<div class="card-comment">💬 ${escapeHtml(m.comment)}</div>` : ''}
      </article>
    `;
  }

  function renderPetCard(p) {
    return `
      <article class="db-card" data-open-id="${escapeHtml(p.id)}" data-open-tab="pets">
        <div class="card-top">
          <div class="card-icon-box">
            ${p.img ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy" />` : '🐾'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(p.name)}</h3>
              <span class="card-id">종류 #${p.no}</span>
            </div>
            <div class="card-badges">
              ${p.grade ? `<span class="badge ${tierBadgeClass(p.grade)}">펫 등급 ${escapeHtml(p.grade)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="card-abilities">
          ${(p.effects && p.effects.length ? p.effects : [p.ability]).map(ef => `<div class="ability-line">• ${escapeHtml(ef)}</div>`).join('')}
        </div>
        <div class="card-footer">
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            <span>📍 드랍:</span>
            ${renderCompactDropCell(p.drops, p.dropRaw, 5)}
          </div>
          <span style="flex-shrink:0;">상세 ›</span>
        </div>
      </article>
    `;
  }

  function renderCampCard(c) {
    return `
      <article class="db-card" data-open-id="${escapeHtml(c.id)}" data-open-tab="camp">
        <div class="card-top">
          <div class="card-icon-box">
            ${c.img ? `<img src="${escapeHtml(c.img)}" alt="${escapeHtml(c.name)}" loading="lazy" />` : '⛺'}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(c.name)}</h3>
              <span class="card-id">#${c.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge">${escapeHtml(c.typeName)}</span>
              <span class="badge badge-level">레벨: ${escapeHtml(c.level)}</span>
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line">${escapeHtml(c.ability)}</div>
          ${c.quest ? `<div class="ability-line" style="font-size:12px;color:var(--text-muted);">🔓 해금 조건: ${escapeHtml(c.quest)}</div>` : ''}
        </div>
        ${c.comment ? `<div class="card-comment">💬 ${escapeHtml(c.comment)}</div>` : ''}
      </article>
    `;
  }

  function renderRelicRuneSkinCard(e, openTab = 'relics') {
    const isSkin = e._kind === 'skin' || (e.id && String(e.id).startsWith('skin_'));
    return `
      <article class="db-card ${isSkin ? 'db-skin-card' : ''}" data-open-id="${escapeHtml(e.id)}" data-open-tab="${escapeHtml(openTab)}">
        <div class="card-top ${isSkin ? 'skin-card-top' : ''}">
          <div class="card-icon-box ${isSkin ? 'skin-icon-box' : ''}">
            ${e.img ? `<img src="${escapeHtml(e.img)}" alt="${escapeHtml(e.name)}" loading="lazy" />` : (isSkin ? '👗' : '🔮')}
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title" style="${isSkin ? 'font-size:16px;' : ''}">${escapeHtml(e.name)}</h3>
              <span class="card-id">#${e.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge badge-rare">${escapeHtml(e._kindLabel)}</span>
              ${e.heroName ? `<span class="badge badge-level">${escapeHtml(e.heroName)} 전용</span>` : ''}
              ${e.purchaseType ? `<span class="badge">${escapeHtml(e.purchaseType)}</span>` : ''}
              ${e.coolTime ? `<span class="badge">쿨타임 ${e.coolTime}초</span>` : ''}
              ${e.recommend ? `<span class="badge ${tierBadgeClass(e.recommend)}">${escapeHtml(e.recommend)}</span>` : ''}
            </div>
            ${isSkin ? `
              <div class="card-abilities" style="margin-top:8px;">
                <div class="ability-line" style="font-weight:700;color:var(--accent-teal);">• ${escapeHtml(e.ability)}</div>
              </div>
            ` : ''}
          </div>
        </div>
        ${!isSkin ? `
          <div class="card-abilities">
            <div class="ability-line">${escapeHtml(e.ability)}</div>
          </div>
        ` : ''}
        ${e.comment ? `<div class="card-comment" style="margin-top:8px;">💬 ${escapeHtml(e.comment)}</div>` : ''}
      </article>
    `;
  }

  // =========================================================================
  // High-Density Table Renderer (Tailored per Category — Matching User Excels)
  // =========================================================================
  const COMMENT_TH_HTML = '<span class="th-comment-wrap"><img src="assets/comment_by_ara2.png" class="th-comment-icon" alt="" />코멘트</span>';

  function renderTableView(tab, entries) {
    let headHtml = '';
    let rowsHtml = '';

    if (tab === 'items') {
      const awkLv = STATE.globalAwk;
      headHtml = `
        <tr>
          <th style="width:55px;text-align:center;">순번</th>
          <th>아이템명 (별칭)</th>
          <th>분류 / 근·원</th>
          <th>고유 능력 (${awkLv === '0' ? '0각성 기본' : `★${awkLv}각성`})</th>
          <th>주요 옵션</th>
          <th style="text-align:center;">사용여부</th>
          <th style="text-align:center;">등급</th>
          <th>${COMMENT_TH_HTML}</th>
          <th>드랍</th>
        </tr>
      `;
      rowsHtml = entries.map(it => {
        const lines = (it.awakening && it.awakening[awkLv]?.lines) || it.abilities || [];
        const dropsTxt = (it.drops && it.drops.length) ? it.drops.join(', ') : (it.officialStages || []).join(', ');
        const usageStr = Array.isArray(it.usage) && it.usage.length ? it.usage.join('/') : '-';
        const tags = it.tags || [];
        return `
          <tr data-open-id="${escapeHtml(it.id)}" data-open-tab="items">
            <td style="text-align:center;font-weight:700;color:var(--text-muted);">${it.no || '-'}</td>
            <td>
              <div class="tbl-item-cell">
                ${it.img ? `<img class="tbl-icon" src="${escapeHtml(it.img)}" alt="" loading="lazy" />` : ''}
                <div>
                  <strong>${escapeHtml(it.name)}</strong>
                  ${it.aliases?.length ? `<div class="card-id">(${escapeHtml(it.aliases.join(', '))})</div>` : ''}
                </div>
              </div>
            </td>
            <td>
              <span class="badge">${escapeHtml(it.catLabel)}</span>
              ${it.range ? `<span class="badge">${escapeHtml(it.range)}</span>` : ''}
            </td>
            <td>${lines.map((l, idx) => `<div style="${idx === 0 && it.explain ? 'color:var(--accent-teal);font-weight:600;' : ''}">• ${escapeHtml(l)}</div>`).join('')}</td>
            <td>
              ${tags.length ? tags.map(t => `<span class="badge badge-rare" style="margin:1px;">${escapeHtml(t)}</span>`).join(' ') : '<span style="color:var(--text-muted);">-</span>'}
            </td>
            <td style="text-align:center;">
              <span class="badge ${tierBadgeClass(usageStr)}">${escapeHtml(usageStr)}</span>
            </td>
            <td style="text-align:center;">
              ${it.grade ? `<span class="badge ${tierBadgeClass(it.grade)}">${escapeHtml(it.grade)}</span>` : '-'}
            </td>
            <td style="color:var(--accent-amber);font-size:12px;max-width:240px;">
              ${it.comment ? `💬 ${escapeHtml(it.comment)}` : ''}
            </td>
            <td style="font-size:12px;color:var(--text-secondary);">
              ${renderCompactDropCell((it.drops && it.drops.length) ? it.drops : it.officialStages, '', 5)}
            </td>
          </tr>
        `;
      }).join('');
    } else if (tab === 'heroes') {
      const isSkinsView = STATE.filters.heroes.subView === 'skins' || (entries[0] && entries[0]._kind === 'skin');
      if (isSkinsView) {
        headHtml = `
          <tr>
            <th style="width:120px;text-align:center;">대상 영웅</th>
            <th style="min-width:260px;">스킨</th>
            <th>착용/보유 능력치</th>
            <th style="width:140px;text-align:center;">획득 구분</th>
            <th>${COMMENT_TH_HTML}</th>
          </tr>
        `;
        rowsHtml = entries.map(e => `
          <tr data-open-id="${escapeHtml(e.id)}" data-open-tab="heroes">
            <td style="text-align:center;"><span class="badge badge-level">${escapeHtml(e.heroName || '-')}</span></td>
            <td>
              <div class="tbl-item-cell tbl-skin-cell">
                ${e.img ? `<img class="tbl-icon tbl-skin-icon" src="${escapeHtml(e.img)}" alt="${escapeHtml(e.name)}" loading="lazy" />` : ''}
                <div>
                  <strong style="font-size:14px;display:block;margin-bottom:2px;">${escapeHtml(e.name)}</strong>
                  <span class="card-id">#${e.officialId}</span>
                </div>
              </div>
            </td>
            <td><strong style="color:var(--accent-teal);">${escapeHtml(e.ability)}</strong></td>
            <td style="text-align:center;"><span class="badge">${escapeHtml(e.purchaseType || '스킨')}</span></td>
            <td style="color:var(--accent-amber);font-size:12px;">${escapeHtml(e.comment || '')}</td>
          </tr>
        `).join('');
      } else {
        headHtml = `
          <tr>
            <th style="width:70px;text-align:center;">등급</th>
            <th style="width:75px;text-align:center;">티어</th>
            <th>영웅 (별칭)</th>
            <th>능력</th>
            <th>레벨별 추가능력 (Lv.3 / 6 / 9 / 12 / 15) · 별점(★☆)</th>
            <th>${COMMENT_TH_HTML}</th>
          </tr>
        `;
        rowsHtml = entries.map(h => {
          const traits = (h.traits || []).filter(t => t.text);
          return `
            <tr data-open-id="${escapeHtml(h.id)}" data-open-tab="heroes">
              <td style="text-align:center;">
                <span class="badge ${h.grade === '전설' ? 'badge-legend' : (h.grade === '희귀' ? 'badge-rare' : '')}">${escapeHtml(h.grade)}</span>
              </td>
              <td style="text-align:center;">
                ${h.tier ? `<span class="badge ${tierBadgeClass(h.tier)}">${escapeHtml(h.tier)}</span>` : '-'}
              </td>
              <td>
                <div class="tbl-item-cell">
                  ${h.img ? `<img class="tbl-icon" src="${escapeHtml(h.img)}" alt="" loading="lazy" />` : ''}
                  <div>
                    <strong>${escapeHtml(h.name)}</strong>
                    ${h.aliases?.length ? `<div class="card-id">(${escapeHtml(h.aliases.join(', '))})</div>` : ''}
                  </div>
                </div>
              </td>
              <td style="max-width:250px;white-space:pre-line;">${escapeHtml(h.ability)}</td>
              <td style="max-width:400px;font-size:12px;">
                ${traits.length ? traits.map(tr => `
                  <div style="margin-bottom:3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span class="badge badge-level" style="padding:1px 5px;font-size:11px;">${tr.unlockLevel}Lv</span>
                    <span>${escapeHtml(tr.text)}</span>
                    ${tr.star ? `<span style="color:var(--accent-amber);font-size:11.5px;font-weight:700;">${escapeHtml(tr.star)}</span>` : ''}
                  </div>
                `).join('') : '<span style="color:var(--text-muted);">-</span>'}
              </td>
              <td style="color:var(--accent-amber);font-size:12px;max-width:270px;white-space:pre-line;">${escapeHtml(h.comment || '')}</td>
            </tr>
          `;
        }).join('');
      }
    } else if (tab === 'mercenaries') {
      headHtml = `
        <tr>
          <th style="width:75px;text-align:center;">등급</th>
          <th style="width:75px;text-align:center;">추천</th>
          <th>영웅</th>
          <th>능력</th>
          <th style="text-align:center;">B (5Lv)</th>
          <th style="text-align:center;">A (9Lv)</th>
          <th style="text-align:center;">S (13Lv)</th>
          <th style="text-align:center;">SS (17Lv)</th>
          <th style="text-align:center;">SSS (20Lv)</th>
        </tr>
      `;
      rowsHtml = entries.map(m => {
        const tv = m.tierValues || {};
        return `
          <tr data-open-id="${escapeHtml(m.id)}" data-open-tab="mercenaries">
            <td style="text-align:center;"><span class="badge ${m.grade === '전설' ? 'badge-legend' : (m.grade === '희귀' ? 'badge-rare' : '')}">${escapeHtml(m.grade)}</span></td>
            <td style="text-align:center;"><span class="badge ${tierBadgeClass(m.recommend)}">${escapeHtml(m.recommend || '-')}</span></td>
            <td>
              <div class="tbl-item-cell">
                ${m.img ? `<img class="tbl-icon" src="${escapeHtml(m.img)}" alt="" loading="lazy" />` : ''}
                <div>
                  <strong>${escapeHtml(m.name)}</strong>
                </div>
              </div>
            </td>
            <td>${escapeHtml(m.templateKo || m.ability)}</td>
            <td style="text-align:center;font-weight:600;">${escapeHtml(tv.B || '-')}</td>
            <td style="text-align:center;font-weight:600;">${escapeHtml(tv.A || '-')}</td>
            <td style="text-align:center;font-weight:600;">${escapeHtml(tv.S || '-')}</td>
            <td style="text-align:center;font-weight:700;color:var(--accent-teal);">${escapeHtml(tv.SS || '-')}</td>
            <td style="text-align:center;font-weight:800;color:var(--accent-amber);">${escapeHtml(tv.SSS || '-')}</td>
          </tr>
        `;
      }).join('');
    } else if (tab === 'towers') {
      headHtml = `
        <tr>
          <th style="width:70px;text-align:center;">등급</th>
          <th>타워</th>
          <th>능력</th>
          <th>레벨별 추가 버프 선택 (Lv.0 / 1 / 4 / 8 / 12 / 16 & 횟수)</th>
          <th style="width:85px;text-align:center;">추천</th>
          <th>${COMMENT_TH_HTML}</th>
        </tr>
      `;
      rowsHtml = entries.map(t => {
        const wBuffs = t.waveBuffs || [];
        return `
          <tr data-open-id="${escapeHtml(t.id)}" data-open-tab="towers">
            <td style="text-align:center;">
              <span class="badge ${t.grade === '전설' ? 'badge-legend' : (t.grade === '희귀' ? 'badge-rare' : '')}">${escapeHtml(t.grade)}</span>
            </td>
            <td>
              <div class="tbl-item-cell">
                ${t.img ? `<img class="tbl-icon" src="${escapeHtml(t.img)}" alt="" loading="lazy" />` : ''}
                <div>
                  <strong>${escapeHtml(t.name)}</strong>
                </div>
              </div>
            </td>
            <td style="max-width:250px;">${escapeHtml(t.ability)}</td>
            <td style="max-width:360px;font-size:12px;">
              ${wBuffs.map(bf => `
                <div style="margin-bottom:2px;">
                  <span class="badge badge-level" style="padding:1px 5px;font-size:11px;">${bf.towerLv}Lv</span>
                  <span>${escapeHtml(bf.text)}</span>
                  <span style="color:var(--text-muted);font-size:11px;">(${bf.maxPickCount}회)</span>
                </div>
              `).join('')}
            </td>
            <td style="text-align:center;">
              ${t.heroDeckRec ? `<span class="badge ${tierBadgeClass(t.heroDeckRec)}">${escapeHtml(t.heroDeckRec)}</span>` : '-'}
            </td>
            <td style="color:var(--accent-amber);font-size:12px;max-width:240px;">${escapeHtml(t.comment || '')}</td>
          </tr>
        `;
      }).join('');
    } else if (tab === 'mounts') {
      headHtml = `
        <tr>
          <th style="width:60px;text-align:center;">숫자</th>
          <th style="width:110px;text-align:center;">합성 분류</th>
          <th>이름</th>
          <th>능력</th>
          <th>${COMMENT_TH_HTML}</th>
        </tr>
      `;
      rowsHtml = entries.map(m => `
        <tr data-open-id="${escapeHtml(m.id)}" data-open-tab="mounts">
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${m.no}</td>
          <td style="text-align:center;"><span class="badge ${m.poolType === '고급 합성' ? 'badge-legend' : 'badge-rare'}">${escapeHtml(m.poolType)}</span></td>
          <td>
            <div class="tbl-item-cell">
              ${m.img ? `<img class="tbl-icon" src="${escapeHtml(m.img)}" alt="" loading="lazy" />` : ''}
              <div>
                <strong>${escapeHtml(m.name)}</strong>
              </div>
            </div>
          </td>
          <td><strong>${escapeHtml(m.ability)}</strong></td>
          <td style="color:var(--accent-amber);font-size:12.5px;">${escapeHtml(m.comment || '')}</td>
        </tr>
      `).join('');
    } else if (tab === 'pets') {
      headHtml = `
        <tr>
          <th style="width:65px;text-align:center;">종류</th>
          <th>펫</th>
          <th>기본 능력</th>
          <th>드랍</th>
          <th style="width:90px;text-align:center;">펫 등급</th>
        </tr>
      `;
      rowsHtml = entries.map(p => `
        <tr data-open-id="${escapeHtml(p.id)}" data-open-tab="pets">
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${p.no}</td>
          <td>
            <div class="tbl-item-cell">
              ${p.img ? `<img class="tbl-icon" src="${escapeHtml(p.img)}" alt="" loading="lazy" />` : ''}
              <div>
                <strong>${escapeHtml(p.name)}</strong>
              </div>
            </div>
          </td>
          <td style="max-width:360px;">
            ${(p.effects && p.effects.length ? p.effects : [p.ability]).map(ef => `<div>• ${escapeHtml(ef)}</div>`).join('')}
          </td>
          <td style="font-size:12px;color:var(--text-secondary);">
            ${renderCompactDropCell(p.drops, p.dropRaw, 6)}
          </td>
          <td style="text-align:center;">
            ${p.grade ? `<span class="badge ${tierBadgeClass(p.grade)}">${escapeHtml(p.grade)}</span>` : '-'}
          </td>
        </tr>
      `).join('');
    } else if (tab === 'camp') {
      headHtml = `
        <tr>
          <th style="width:85px;text-align:center;">분류</th>
          <th>종류</th>
          <th style="width:85px;text-align:center;">레벨</th>
          <th>능력</th>
          <th>${COMMENT_TH_HTML}</th>
        </tr>
      `;
      rowsHtml = entries.map(c => `
        <tr data-open-id="${escapeHtml(c.id)}" data-open-tab="camp">
          <td style="text-align:center;"><span class="badge">${escapeHtml(c.typeName)}</span></td>
          <td>
            <div class="tbl-item-cell">
              ${c.img ? `<img class="tbl-icon" src="${escapeHtml(c.img)}" alt="" loading="lazy" />` : ''}
              <div>
                <strong>${escapeHtml(c.name)}</strong>
              </div>
            </div>
          </td>
          <td style="text-align:center;"><span class="badge badge-level">${escapeHtml(c.level)}</span></td>
          <td>
            <strong>${escapeHtml(c.ability)}</strong>
            ${c.rewardGem ? `<span class="badge badge-rare" style="margin-left:6px;">💎 붉은 보석 ${c.rewardGem.toLocaleString()}개</span>` : ''}
          </td>
          <td style="color:var(--accent-amber);font-size:12.5px;">${c.comment ? `💬 ${escapeHtml(c.comment)}` : ''}</td>
        </tr>
      `).join('');
    } else if (tab === 'relics') {
      const subType = STATE.filters.relics.subType || 'relic';
      if (subType === 'relic') {
        headHtml = `
          <tr>
            <th>유물명</th>
            <th style="width:90px;text-align:center;">쿨타임</th>
            <th style="width:120px;text-align:center;">획득처</th>
            <th>효과 (전설 · 신화 · 초월)</th>
            <th style="width:85px;text-align:center;">추천</th>
            <th>${COMMENT_TH_HTML}</th>
          </tr>
        `;
        rowsHtml = entries.map(e => `
          <tr data-open-id="${escapeHtml(e.id)}" data-open-tab="relics">
            <td>
              <div class="tbl-item-cell">
                ${e.img ? `<img class="tbl-icon" src="${escapeHtml(e.img)}" alt="" loading="lazy" />` : ''}
                <div>
                  <strong>${escapeHtml(e.name)}</strong>
                </div>
              </div>
            </td>
            <td style="text-align:center;"><span class="badge">${e.coolTime ? `${e.coolTime}초` : '-'}</span></td>
            <td style="text-align:center;font-size:12px;">${escapeHtml(e.acquisition || '-')}</td>
            <td><strong>${escapeHtml(e.ability)}</strong></td>
            <td style="text-align:center;">
              ${e.recommend ? `<span class="badge ${tierBadgeClass(e.recommend)}">${escapeHtml(e.recommend)}</span>` : '-'}
            </td>
            <td style="color:var(--accent-amber);font-size:12px;">${escapeHtml(e.comment || '')}</td>
          </tr>
        `).join('');
      } else {
        headHtml = `
          <tr>
            <th>룬 이름</th>
            <th>2세트 효과</th>
            <th>4세트 효과</th>
            <th>${COMMENT_TH_HTML}</th>
          </tr>
        `;
        rowsHtml = entries.map(e => `
          <tr data-open-id="${escapeHtml(e.id)}" data-open-tab="relics">
            <td>
              <div class="tbl-item-cell">
                ${e.img ? `<img class="tbl-icon" src="${escapeHtml(e.img)}" alt="" loading="lazy" />` : ''}
                <div>
                  <strong>${escapeHtml(e.name)}</strong>
                </div>
              </div>
            </td>
            <td><span class="badge badge-level">2세트</span> ${escapeHtml(e.set2 || '-')}</td>
            <td><span class="badge badge-legend">4세트</span> <strong>${escapeHtml(e.set4 || e.ability || '-')}</strong></td>
            <td style="color:var(--accent-amber);font-size:12px;">${escapeHtml(e.comment || '')}</td>
          </tr>
        `).join('');
      }
    }

    const prefixHtml = tab === 'mercenaries' ? renderMercTopBanner() : '';
    els.contentStage.innerHTML = `
      ${prefixHtml}
      <div class="table-wrap">
        <table class="db-table">
          <thead>${headHtml}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // =========================================================================
  // Reference Sub-Views (Mount Sub-Options, Upgrade, Pet Guide, Camp Common, Growth)
  // =========================================================================
  function renderMountSubOptionsStage() {
    const subsObj = (DB.mounts && DB.mounts.subOptions) || {};
    const heroSubs = subsObj.hero || [];
    const towerSubs = subsObj.tower || [];
    const commonSubs = subsObj.common || [];
    const totalCnt = heroSubs.length + towerSubs.length + commonSubs.length;
    els.resultsCountBadge.textContent = `${totalCnt}종`;

    const buildSec = (title, badgeCls, list) => `
      <div class="modal-section">
        <h3 class="modal-sec-title">${title} (${list.length}종)</h3>
        <div class="table-wrap">
          <table class="db-table">
            <thead>
              <tr><th style="width:70px;">No</th><th>부옵션 효과</th><th style="width:140px;">등장 슬롯 범위</th></tr>
            </thead>
            <tbody>
              ${list.map(s => `
                <tr>
                  <td><strong>#${s.no}</strong></td>
                  <td><strong>${escapeHtml(s.name)}</strong></td>
                  <td><span class="badge ${badgeCls}">${escapeHtml(s.range)}번 슬롯</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${buildSec('🦸 영웅 계열 탈것 부옵션', 'badge-tier-0', heroSubs)}
        ${buildSec('🏰 타워 계열 탈것 부옵션', 'badge-rare', towerSubs)}
        ${buildSec('🌟 공통 계열 탈것 부옵션', 'badge-legend', commonSubs)}
        <div class="modal-section">
          <h3 class="modal-sec-title">🖼️ 탈것 부옵션 참고표</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
            <img src="assets/mount_1.png" alt="탈것 가이드 1" style="max-width:100%;border-radius:10px;border:1px solid var(--border-subtle);" loading="lazy" />
            <img src="assets/mount_2.png" alt="탈것 가이드 2" style="max-width:100%;border-radius:10px;border:1px solid var(--border-subtle);" loading="lazy" />
          </div>
        </div>
      </div>
    `;
  }

  function renderMountUpgradeStage() {
    const up = (DB.mounts && DB.mounts.upgradeTable) || [];
    els.resultsCountBadge.textContent = `${up.length}단계`;
    els.contentStage.innerHTML = `
      <div class="table-wrap">
        <table class="db-table">
          <thead>
            <tr><th>강화 레벨</th><th>성공 확률 (%)</th><th>필요 사료량</th><th>기본 공격력 보너스 (%)</th><th>기본 체력 보너스 (%)</th></tr>
          </thead>
          <tbody>
            ${up.map(r => `
              <tr>
                <td><strong>+${r.level}강</strong></td>
                <td><span class="badge badge-rare">${r.successRate}%</span></td>
                <td>${r.needFeed}개</td>
                <td>+${r.atkBonus}%</td>
                <td>+${r.hpBonus}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPetGuideStage() {
    const guide = (DB.pets && DB.pets.guide) || {};
    const subOpts = guide.subOptions || [];
    const randOpts = guide.randomOptions || [];
    const bHero = guide.buildHero || {};
    const bTower = guide.buildTower || {};
    els.resultsCountBadge.textContent = '육성 · 옵션 가이드';

    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="modal-section">
          <h3 class="modal-sec-title">🏆 펫 종결 추천 세팅 (영웅덱 vs 타워덱)</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
            <div style="padding:14px;border-radius:12px;background:var(--bg-elevated);border:1px solid var(--border-subtle);">
              <div style="font-weight:900;font-size:15px;color:var(--accent-amber);margin-bottom:8px;">🦸 ${escapeHtml(bHero.title || '영웅덱 추천 세팅')}</div>
              <div style="margin-bottom:8px;"><strong>추천 주옵션(부옵):</strong> <span class="badge badge-tier-0">${escapeHtml(bHero.subOption || '')}</span></div>
              <div style="font-weight:700;font-size:12.5px;margin-bottom:4px;">추천 랜덤옵션 (4줄):</div>
              ${(bHero.randomOptions || []).map(ro => `<div style="font-size:13px;">• ${escapeHtml(ro)}</div>`).join('')}
            </div>
            <div style="padding:14px;border-radius:12px;background:var(--bg-elevated);border:1px solid var(--border-subtle);">
              <div style="font-weight:900;font-size:15px;color:var(--accent-teal);margin-bottom:8px;">🏰 ${escapeHtml(bTower.title || '타워덱 추천 세팅')}</div>
              <div style="margin-bottom:8px;"><strong>추천 주옵션(부옵):</strong> <span class="badge badge-rare">${escapeHtml(bTower.subOption || '')}</span></div>
              <div style="font-weight:700;font-size:12.5px;margin-bottom:4px;">추천 랜덤옵션 (4줄):</div>
              ${(bTower.randomOptions || []).map(ro => `<div style="font-size:13px;">• ${escapeHtml(ro)}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">📌 펫 기본 부옵션 목록 (${subOpts.length}종)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead><tr><th style="width:70px;">No</th><th style="width:100px;">계열</th><th>옵션 효과</th></tr></thead>
              <tbody>
                ${subOpts.map(s => `
                  <tr>
                    <td>#${s.no}</td>
                    <td><span class="badge ${s.category === '영웅' ? 'badge-tier-0' : 'badge-rare'}">${escapeHtml(s.category)}</span></td>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">🎲 펫 랜덤 옵션 목록 (${randOpts.length}종)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead><tr><th style="width:70px;">No</th><th style="width:100px;">계열</th><th>랜덤 옵션 효과</th></tr></thead>
              <tbody>
                ${randOpts.map(r => `
                  <tr>
                    <td>#${r.no}</td>
                    <td><span class="badge ${r.category === '영웅' ? 'badge-tier-0' : 'badge-rare'}">${escapeHtml(r.category)}</span></td>
                    <td><strong>${escapeHtml(r.name)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderCampCommonStage() {
    const common = (DB.camp && DB.camp.common) || {};
    const combos = common.recommendCombos || [];
    const subOpts = common.subOptions || [];
    const randOpts = common.randomOptions || [];
    const tips = common.tips || [];
    els.resultsCountBadge.textContent = '종합 가이드';

    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="modal-section">
          <h3 class="modal-sec-title">⛺ 야영지 추천 세팅 조합 (구조물 + 소품)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead><tr><th>구분/목적</th><th>추천 구조물 (2종)</th><th>추천 소품 세팅</th><th>핵심 팁</th></tr></thead>
              <tbody>
                ${combos.map(c => `
                  <tr>
                    <td><strong>${escapeHtml(c.mode)}</strong></td>
                    <td><span class="badge badge-legend">${escapeHtml(c.structure)}</span></td>
                    <td style="white-space:pre-line;">${escapeHtml(c.prop)}</td>
                    <td style="color:var(--accent-amber);">${escapeHtml(c.note || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">📌 야영지 주옵션 (옵션 8종) 추천 및 중요도</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead><tr><th>주옵션 (기본 옵션)</th><th><span class="th-comment-wrap"><img src="assets/comment_by_ara2.png" class="th-comment-icon" alt="" />추천 세팅 / 코멘트</span></th><th>중요도</th></tr></thead>
              <tbody>
                ${subOpts.map(s => {
                  const optText = typeof s === 'string' ? s : (s.option || '');
                  const recText = typeof s === 'object' ? (s.recommend || '') : '';
                  const starText = typeof s === 'object' ? (s.stars || '') : '';
                  return `
                    <tr>
                      <td><strong>${escapeHtml(optText)}</strong></td>
                      <td style="color:var(--accent-amber);">${escapeHtml(recText)}</td>
                      <td><span class="badge ${starText.includes('★') ? 'badge-tier-0' : ''}">${escapeHtml(starText || '-')}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">🎲 야영지 부옵션 (랜덤옵 12종) 추천 및 중요도</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead><tr><th>부옵션 (랜덤 옵션)</th><th><span class="th-comment-wrap"><img src="assets/comment_by_ara2.png" class="th-comment-icon" alt="" />추천 대상 / 코멘트</span></th><th>중요도</th></tr></thead>
              <tbody>
                ${randOpts.map(r => {
                  const optText = typeof r === 'string' ? r : (r.option || '');
                  const recText = typeof r === 'object' ? (r.recommend || '') : '';
                  const starText = typeof r === 'object' ? (r.stars || '') : '';
                  return `
                    <tr>
                      <td><strong>${escapeHtml(optText)}</strong></td>
                      <td style="color:var(--accent-amber);">${escapeHtml(recText)}</td>
                      <td><span class="badge ${starText.includes('★★★★') ? 'badge-tier-0' : 'badge-rare'}">${escapeHtml(starText || '-')}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${tips.length ? `
          <div class="modal-section">
            <h3 class="modal-sec-title">💡 야영지 신급 제작 & 옵션 핵심 팁</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${tips.map(t => `<div class="card-comment" style="white-space:pre-line;font-size:13px;">${escapeHtml(t)}</div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderRelicGradeTableStage() {
    const rGrades = DB.relicGrades || [];
    els.resultsCountBadge.textContent = `${rGrades.length}등급`;
    els.contentStage.innerHTML = `
      <div class="table-wrap">
        <table class="db-table">
          <thead>
            <tr><th>등급</th><th>최대 강화</th><th>강화 골드</th><th>판매 골드</th><th>신화/전설 조각 비용</th></tr>
          </thead>
          <tbody>
            ${rGrades.map(g => `
              <tr>
                <td><strong>${escapeHtml(g.Tmp)}</strong></td>
                <td>+${escapeHtml(g.Upgrade_Max)}강</td>
                <td>${escapeHtml(g.Upgrade_Gold)} G</td>
                <td>${escapeHtml(g.Sell_Gold)} G</td>
                <td>조각9: ${escapeHtml(g.Piece_9)} / 조각10: ${escapeHtml(g.Piece_10)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderGrowthCalculatorStage() {
    const costs = (DB.growth && DB.growth.heroTowerCosts) || [];
    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="modal-section">
          <h3 class="modal-sec-title">🧮 공식 장비 주옵션 & 각성 시뮬레이터 (3.5.0 공식 수식)</h3>
          <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">
            공식 수식: <code>q = 0.9 + 0.2*(품질/100)</code>, <code>s = q * (등급기본 + 레벨당증가*(레벨-1))</code> (반지는 <code>s*0.3</code>, 신등급 각성 보너스 0~400% 적용)
          </p>
          <div class="calc-grid">
            <div class="calc-field">
              <label>장비 부위/종류</label>
              <select id="simPart" class="ctrl-select">
                <option value="weapon_4">주 무기 (무기 공격력%)</option>
                <option value="other_3">보조/투구/기타 (모든 공격력%)</option>
                <option value="other_1">타워 특화 장비 (타워 공격력%)</option>
                <option value="ring_3">반지 (모든 공격력% × 0.3)</option>
              </select>
            </div>
            <div class="calc-field">
              <label>장비 등급</label>
              <select id="simGrade" class="ctrl-select">
                <option value="7" selected>신 (Grade 7)</option>
                <option value="6">전설 (Grade 6)</option>
                <option value="5">에픽 (Grade 5)</option>
                <option value="4">미스테리 (Grade 4)</option>
                <option value="3">엘리트 (Grade 3)</option>
                <option value="2">유니크 (Grade 2)</option>
                <option value="1">레어 (Grade 1)</option>
                <option value="0">일반 (Grade 0)</option>
              </select>
            </div>
            <div class="calc-field">
              <label>장비 레벨 (1~400)</label>
              <input type="number" id="simLv" class="ctrl-input" value="200" min="1" max="400" />
            </div>
            <div class="calc-field">
              <label>품질 난수 (1~100, 100=최상급)</label>
              <input type="number" id="simRand" class="ctrl-input" value="100" min="1" max="100" />
            </div>
            <div class="calc-field">
              <label>신등급 각성 단계 (0~5성)</label>
              <select id="simAwk" class="ctrl-select">
                <option value="0">0성 (보너스 0%)</option>
                <option value="1">1성 (+50%)</option>
                <option value="2">2성 (+120%)</option>
                <option value="3">3성 (+200%)</option>
                <option value="4">4성 (+300%)</option>
                <option value="5" selected>★5성 (+400%)</option>
              </select>
            </div>
          </div>
          <div class="calc-result-box" id="simResultBox"></div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">📊 영웅 · 타워 레벨업 필요 조각 수 (공식 Chart_Lv)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr><th>현재 레벨 → 다음 레벨</th><th>영웅 필요 조각</th><th>일반 타워 조각</th><th>희귀 타워 조각</th><th>전설 타워 조각</th></tr>
              </thead>
              <tbody>
                ${costs.map(c => `
                  <tr>
                    <td><strong>Lv.${c.level} → Lv.${c.level + 1}</strong></td>
                    <td>${c.heroPiece ? `${c.heroPiece}개` : '-'}</td>
                    <td>${c.towerNormal ? `${c.towerNormal}개` : '-'}</td>
                    <td>${c.towerRare ? `${c.towerRare}개` : '-'}</td>
                    <td><strong style="color:var(--accent-amber);">${c.towerLegend ? `${c.towerLegend}개` : '-'}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">🖼️ 인게임 성장 참고표</h3>
          <img src="assets/underdark_growth.png" alt="성장 테이블" style="max-width:100%;border-radius:12px;border:1px solid var(--border-subtle);" loading="lazy" />
        </div>
      </div>
    `;

    const updateSim = () => {
      const partVal = document.getElementById('simPart')?.value || 'weapon_4';
      const gradeIdx = parseInt(document.getElementById('simGrade')?.value || '7', 10);
      const lv = parseInt(document.getElementById('simLv')?.value || '200', 10);
      const rand = Math.min(100, Math.max(1, parseInt(document.getElementById('simRand')?.value || '100', 10)));
      const awkLv = parseInt(document.getElementById('simAwk')?.value || '5', 10);
      const qualityPct = (0.9 + 0.2 * (rand / 100)) * 100;

      const dummyItem = {
        cat: partVal.startsWith('weapon') ? 'weapon' : (partVal.startsWith('ring') ? 'ring' : 'sub'),
        basicStat: {
          statCode: partVal.split('_')[1],
          isRing: partVal.startsWith('ring'),
        },
        weaponSpecs: { atk: 50 },
      };
      const res = calculateItemMainStat(dummyItem, gradeIdx, lv, qualityPct, awkLv);
      const box = document.getElementById('simResultBox');
      if (box) {
        box.innerHTML = `
          <div>
            <div style="font-size:12px;color:var(--text-muted);">적용 배율: 품질 ${(qualityPct).toFixed(1)}% · 각성 보너스 +${gradeIdx === 7 ? AWK_MAIN_BONUS[awkLv] : 0}%</div>
            <div style="font-weight:700;">계산된 주옵션 수치</div>
          </div>
          <div class="calc-result-val">+${res.mainPct.toLocaleString()}%</div>
        `;
      }
    };

    ['simPart', 'simGrade', 'simLv', 'simRand', 'simAwk'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateSim);
      document.getElementById(id)?.addEventListener('change', updateSim);
    });
    updateSim();
  }

  // =========================================================================
  // Detail Modal Renderer
  // =========================================================================
  function openDetailModal(tab, id) {
    let entry = null;
    if (tab === 'items') entry = (DB.items || []).find(x => x.id === id);
    else if (tab === 'heroes') entry = [...(DB.heroes || []), ...(DB.skins || [])].find(x => x.id === id);
    else if (tab === 'mercenaries') entry = (DB.mercenaries || []).find(x => x.id === id);
    else if (tab === 'towers') entry = (DB.towers || []).find(x => x.id === id);
    else if (tab === 'mounts') entry = ((DB.mounts && DB.mounts.mounts) || []).find(x => x.id === id);
    else if (tab === 'pets') entry = ((DB.pets && DB.pets.pets) || []).find(x => x.id === id);
    else if (tab === 'camp') entry = ((DB.camp && DB.camp.items) || []).find(x => x.id === id);
    else if (tab === 'relics') {
      entry = [...(DB.relics || []), ...(DB.runes || [])].find(x => x.id === id);
    }

    if (!entry) return;

    const isSkin = entry._kind === 'skin' || String(entry.id).startsWith('skin_');

    els.modalHeaderContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="card-icon-box ${isSkin ? 'skin-icon-box modal-skin-icon-box' : ''}">
          ${entry.img ? `<img src="${escapeHtml(entry.img)}" alt="${escapeHtml(entry.name)}" />` : (isSkin ? '👗' : '✨')}
        </div>
        <div>
          <div class="card-title-row">
            <h2 id="modalTitle" style="font-size:18px;font-weight:900;">${escapeHtml(entry.name)}</h2>
            <span class="card-id">공식ID #${entry.officialId}</span>
          </div>
          <div class="card-badges">
            ${entry.catLabel ? `<span class="badge">${escapeHtml(entry.catLabel)}</span>` : ''}
            ${entry.range ? `<span class="badge">${escapeHtml(entry.range)}</span>` : ''}
            ${entry.grade ? `<span class="badge ${tierBadgeClass(entry.grade)}">${escapeHtml(entry.grade)}</span>` : ''}
            ${entry.tier ? `<span class="badge ${tierBadgeClass(entry.tier)}">${escapeHtml(entry.tier)}</span>` : ''}
            ${entry.recommend ? `<span class="badge ${tierBadgeClass(entry.recommend)}">추천 ${escapeHtml(entry.recommend)}</span>` : ''}
            ${entry.heroName ? `<span class="badge badge-level">${escapeHtml(entry.heroName)} 전용</span>` : ''}
            ${entry.purchaseType ? `<span class="badge">${escapeHtml(entry.purchaseType)}</span>` : ''}
            ${entry.usage && entry.usage.length ? `<span class="badge ${tierBadgeClass(entry.usage.join('/'))}">사용 ${escapeHtml(entry.usage.join('/'))}</span>` : ''}
            ${entry.level ? `<span class="badge badge-level">${escapeHtml(entry.level)}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    let bodyHtml = '';

    if (tab === 'items') {
      const awkLevels = [0, 1, 2, 3, 4, 5];
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment">💬 유저 코멘트: ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">
            <span>🌟 공식 0성 ~ 5성 각성 단계별 옵션 비교</span>
            <span style="font-size:11.5px;color:var(--text-muted);">신(Grade 7) 등급에서 각성 가능</span>
          </div>
          <div class="table-wrap">
            <table class="db-table" style="min-width:100%;">
              <thead><tr><th style="width:85px;">각성 단계</th><th>주옵션 배율</th><th>적용 효과 (공식 3.5.0 데이터)</th></tr></thead>
              <tbody>
                ${awkLevels.map(lv => {
                  const lines = entry.awakening?.[String(lv)]?.lines || entry.abilities || [];
                  return `
                    <tr>
                      <td><span class="badge ${lv === 5 ? 'badge-awk' : ''}">★${lv}성</span></td>
                      <td><strong>+${AWK_MAIN_BONUS[lv]}%</strong></td>
                      <td>${lines.map(l => `<div>• ${escapeHtml(l)}</div>`).join('')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-sec-title">
            <span>🧮 이 장비의 주옵션(${escapeHtml(entry.basicStat?.name || '공격력')}) 계산기</span>
          </div>
          <div class="calc-grid">
            <div class="calc-field">
              <label>등급</label>
              <select id="mCalcGrade" class="ctrl-select">
                <option value="7" selected>신</option>
                <option value="6">전설</option>
                <option value="5">에픽</option>
                <option value="4">미스테리</option>
              </select>
            </div>
            <div class="calc-field">
              <label>장비 레벨 (1~400)</label>
              <input type="number" id="mCalcLv" class="ctrl-input" value="200" min="1" max="400" />
            </div>
            <div class="calc-field">
              <label>각성 (0~5성)</label>
              <select id="mCalcAwk" class="ctrl-select">
                <option value="0">0성</option>
                <option value="1">1성</option>
                <option value="2">2성</option>
                <option value="3">3성</option>
                <option value="4">4성</option>
                <option value="5" selected>★5성</option>
              </select>
            </div>
          </div>
          <div class="calc-result-box" id="mCalcResult"></div>
        </div>

        <div class="modal-section">
          <div class="modal-sec-title">📍 획득처 및 부가 정보</div>
          ${entry.tags && entry.tags.length ? `<p style="margin-bottom:6px;"><strong>주요 옵션 태그:</strong> ${entry.tags.map(t => `<span class="badge badge-rare">${escapeHtml(t)}</span>`).join(' ')}</p>` : ''}
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong>드랍/획득처:</strong>
            <div class="drop-badges-inline">${(entry.drops && entry.drops.length) ? renderDropBadges(entry.drops) : '<span class="badge badge-drop">상자 뽑기 / 일일 상점</span>'}</div>
          </div>
          ${entry.aliases?.length ? `<p style="margin-top:6px;"><strong>검색 별칭:</strong> ${escapeHtml(entry.aliases.join(', '))}</p>` : ''}
        </div>
      `;
    } else if (tab === 'heroes' && !String(entry.id).startsWith('skin_')) {
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment" style="white-space:pre-line;">💬 ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">⚔️ 기본 패시브 및 전투 스펙</div>
          <p style="margin-bottom:8px;">${escapeHtml(entry.ability)}</p>
          <div class="card-badges">
            <span class="badge">공격속도 ${entry.specs?.aspd}</span>
            <span class="badge">치명타확률 ${entry.specs?.crit}%</span>
            <span class="badge">치명타피해 ${entry.specs?.critDmg}%</span>
            <span class="badge">사거리 ${entry.specs?.range}</span>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-sec-title">🌟 레벨별 해금 특성 (Lv.3 / 6 / 9 / 12 / 15) · 별점(★☆)</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${(entry.traits || []).map(tr => `
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <span class="badge badge-level" style="flex-shrink:0;">Lv.${tr.unlockLevel}</span>
                <span>${escapeHtml(tr.text)}</span>
                ${tr.star ? `<span style="color:var(--accent-amber);font-weight:700;">${escapeHtml(tr.star)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        ${entry.skins && entry.skins.length ? `
          <div class="modal-section">
            <div class="modal-sec-title">👗 전용 스킨 목록 (${entry.skins.length}종)</div>
            <div class="card-grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;">
              ${entry.skins.map(sk => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-subtle);">
                  ${sk.img ? `<img src="${escapeHtml(sk.img)}" alt="${escapeHtml(sk.name)}" style="width:104px;height:104px;object-fit:contain;flex-shrink:0;background:var(--bg-surface);border-radius:10px;border:1px solid var(--border-subtle);padding:3px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));" loading="lazy" />` : ''}
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:14px;">${escapeHtml(sk.name)}</div>
                    <div style="font-size:12px;color:var(--accent-primary);margin-top:4px;font-weight:600;">${escapeHtml(sk.ability)}</div>
                    ${sk.comment ? `<div style="font-size:11.5px;color:var(--accent-amber);margin-top:4px;">💬 ${escapeHtml(sk.comment)}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    } else if (tab === 'heroes' && String(entry.id).startsWith('skin_')) {
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment" style="white-space:pre-line;">💬 ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">👗 영웅 스킨 정보</div>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;">
            <div>🦸 <strong>대상 영웅:</strong> <span class="badge badge-level">${escapeHtml(entry.heroName || '-')}</span></div>
            <div>✨ <strong>착용/보유 능력치:</strong> <strong style="color:var(--accent-teal);">${escapeHtml(entry.ability)}</strong></div>
            <div>🏷️ <strong>획득 구분:</strong> <span class="badge">${escapeHtml(entry.purchaseType || '스킨')}</span></div>
          </div>
        </div>
      `;
    } else if (tab === 'mercenaries') {
      const tv = entry.tierValues || {};
      const gDetails = entry.gradeDetails || [];
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment">💬 ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">🛡️ 지원용병 등급별 효과 상승표 (B ~ SSS)</div>
          <p style="margin-bottom:10px;font-weight:700;">${escapeHtml(entry.templateKo || entry.ability)}</p>
          <div class="table-wrap">
            <table class="db-table" style="min-width:100%;">
              <thead><tr><th>지원 등급</th><th>필요 영웅 레벨</th><th>적용 수치</th><th>상세 설명</th></tr></thead>
              <tbody>
                ${gDetails.length ? gDetails.map(gd => `
                  <tr>
                    <td><span class="badge ${gd.grade === 'SSS' ? 'badge-tier-0' : (gd.grade === 'SS' ? 'badge-tier-1' : '')}">${escapeHtml(gd.grade)}</span></td>
                    <td>영웅 Lv.${gd.minHeroLv} 이상</td>
                    <td><strong>${escapeHtml((gd.values || []).join(' / '))}</strong></td>
                    <td>${escapeHtml(gd.text)}</td>
                  </tr>
                `).join('') : ['B', 'A', 'S', 'SS', 'SSS'].map(g => `
                  <tr>
                    <td><span class="badge">${g}</span></td>
                    <td>-</td>
                    <td><strong>${escapeHtml(tv[g] || '-')}</strong></td>
                    <td>${escapeHtml(entry.templateKo || entry.ability)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'towers') {
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment">💬 ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">🏰 타워 기본 설명 및 스펙</div>
          <p style="margin-bottom:8px;">${escapeHtml(entry.ability)}</p>
          <div class="card-badges">
            <span class="badge">기본 공격력 ${entry.specs?.atk}</span>
            <span class="badge">공격속도 ${entry.specs?.aspd}</span>
            <span class="badge">사거리 ${entry.specs?.range}</span>
            <span class="badge">타일크기 ${entry.specs?.tileCnt}칸</span>
            <span class="badge">최대 설치 ${entry.specs?.maxCount === -1 ? '무제한' : entry.specs?.maxCount + '개'}</span>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-sec-title">🃏 인게임 웨이브 버프 카드 목록 (해금 레벨 & 최대 선택 수)</div>
          <div class="table-wrap">
            <table class="db-table" style="min-width:100%;">
              <thead><tr><th>필요 타워 레벨</th><th>최대 선택 횟수</th><th>버프 카드 효과</th></tr></thead>
              <tbody>
                ${(entry.waveBuffs || []).map(bf => `
                  <tr>
                    <td><span class="badge badge-level">${bf.towerLv === 0 ? '기본 해금' : `타워 Lv.${bf.towerLv}`}</span></td>
                    <td>최대 ${bf.maxPickCount}회</td>
                    <td>${escapeHtml(bf.text)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      bodyHtml += `
        ${entry.comment ? `<div class="card-comment">💬 ${escapeHtml(entry.comment)}</div>` : ''}
        <div class="modal-section">
          <div class="modal-sec-title">📌 상세 능력치 및 정보</div>
          ${entry.set2 && entry.set4 ? `
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
              <div><span class="badge badge-level">2세트 효과</span> <strong>${escapeHtml(entry.set2)}</strong></div>
              <div><span class="badge badge-legend">4세트 효과</span> <strong>${escapeHtml(entry.set4)}</strong></div>
            </div>
          ` : `<p style="font-weight:700;">${escapeHtml(entry.ability)}</p>`}
          ${entry.acquisition ? `<p style="margin-top:8px;color:var(--text-secondary);">📍 <strong>획득처:</strong> ${escapeHtml(entry.acquisition)}</p>` : ''}
          ${entry.drops && entry.drops.length ? `<div style="margin-top:8px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span>📍 <strong>획득 스테이지/드랍처:</strong></span> <div class="drop-badges-inline">${renderDropBadges(entry.drops)}</div></div>` : ''}
          ${entry.heroName ? `<p style="margin-top:8px;color:var(--text-secondary);">🦸 <strong>대상 영웅:</strong> ${escapeHtml(entry.heroName)} (${escapeHtml(entry.purchaseType || '스킨')})</p>` : ''}
          ${entry.rewardGem ? `<p style="margin-top:8px;color:var(--accent-rose);font-weight:700;">💎 <strong>미션 보상:</strong> 붉은 보석 ${entry.rewardGem.toLocaleString()}개</p>` : ''}
          ${entry.perGrade ? `
            <div class="table-wrap" style="margin-top:12px;">
              <table class="db-table" style="min-width:100%;">
                <thead><tr><th>구분/세트</th><th>적용 효과</th></tr></thead>
                <tbody>
                  ${entry.perGrade.map(pg => `<tr><td><strong>${escapeHtml(pg.grade)}</strong></td><td>${escapeHtml(pg.text)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
    }

    els.modalBodyContent.innerHTML = bodyHtml;
    els.detailModalBackdrop.hidden = false;

    if (tab === 'items') {
      const updateModalCalc = () => {
        const g = parseInt(document.getElementById('mCalcGrade')?.value || '7', 10);
        const lv = parseInt(document.getElementById('mCalcLv')?.value || '200', 10);
        const awk = parseInt(document.getElementById('mCalcAwk')?.value || '5', 10);
        const res = calculateItemMainStat(entry, g, lv, 110, awk);
        const box = document.getElementById('mCalcResult');
        if (box) {
          box.innerHTML = `
            <div>
              <div style="font-size:12px;color:var(--text-muted);">최상급(110% 품질) 기준 ${escapeHtml(entry.basicStat?.name || '주옵션')}</div>
              ${res.weaponFinalAtk ? `<div style="font-size:12.5px;">무기 최종 공격력: <strong>${res.weaponFinalAtk.toLocaleString()}</strong> (기본 ${entry.weaponSpecs.atk})</div>` : ''}
            </div>
            <div class="calc-result-val">+${res.mainPct.toLocaleString()}%</div>
          `;
        }
      };
      ['mCalcGrade', 'mCalcLv', 'mCalcAwk'].forEach(cid => {
        document.getElementById(cid)?.addEventListener('input', updateModalCalc);
        document.getElementById(cid)?.addEventListener('change', updateModalCalc);
      });
      updateModalCalc();
    }
  }

  // =========================================================================
  // Event Bindings & Initialization
  // =========================================================================
  function switchTab(newTab) {
    if (!TAB_TITLES[newTab]) return;
    STATE.tab = newTab;

    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === newTab);
    });

    renderStage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindEvents() {
    // Search input
    els.searchInput.addEventListener('input', e => {
      STATE.query = e.target.value;
      els.clearSearchBtn.hidden = !STATE.query.length;
      renderStage();
    });

    els.clearSearchBtn.addEventListener('click', () => {
      STATE.query = '';
      els.searchInput.value = '';
      els.clearSearchBtn.hidden = true;
      els.searchInput.focus();
      renderStage();
    });

    // Cross-category jump
    els.crossMatchBar.addEventListener('click', e => {
      const btn = e.target.closest('[data-jump-tab]');
      if (btn) switchTab(btn.getAttribute('data-jump-tab'));
    });

    // Primary & Mobile Nav
    els.primaryNav.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });
    els.mobileBottomNav.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });

    // Context Filters
    els.contextToolbar.addEventListener('click', e => {
      const btn = e.target.closest('[data-fkey]');
      if (!btn) return;
      const fkey = btn.getAttribute('data-fkey');
      const fval = btn.getAttribute('data-fval');
      if (STATE.filters[STATE.tab]) {
        STATE.filters[STATE.tab][fkey] = fval;
        renderStage();
      }
    });

    // Quick Search Chips
    els.quickChipsBar.addEventListener('click', e => {
      const btn = e.target.closest('[data-qchip]');
      if (!btn) return;
      const q = btn.getAttribute('data-qchip');
      STATE.query = STATE.query.trim() === q ? '' : q;
      els.searchInput.value = STATE.query;
      els.clearSearchBtn.hidden = !STATE.query.length;
      renderStage();
    });

    // Global Awakening Switcher
    els.globalAwkSeg.addEventListener('click', e => {
      const btn = e.target.closest('[data-awk]');
      if (!btn) return;
      STATE.globalAwk = btn.getAttribute('data-awk');
      els.globalAwkSeg.querySelectorAll('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-awk') === STATE.globalAwk);
      });
      renderStage();
    });

    // Sort & View Mode
    els.sortSelect.addEventListener('change', e => {
      STATE.sortBy = e.target.value;
      renderStage();
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.viewMode = btn.getAttribute('data-view');
        document.querySelectorAll('.view-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-view') === STATE.viewMode);
        });
        renderStage();
      });
    });

    // Card / Table Row Click -> Open Detail Modal (or toggle truncated drop list)
    els.contentStage.addEventListener('click', e => {
      const dropBtn = e.target.closest('[data-toggle-drop]');
      if (dropBtn) {
        e.stopPropagation();
        const wrap = dropBtn.closest('.drop-cell-wrap');
        if (wrap) {
          const shortEl = wrap.querySelector('.drop-short');
          const fullEl = wrap.querySelector('.drop-full');
          const isExpanding = dropBtn.getAttribute('data-toggle-drop') === 'expand';
          if (shortEl && fullEl) {
            shortEl.hidden = isExpanding;
            fullEl.hidden = !isExpanding;
          }
        }
        return;
      }

      const target = e.target.closest('[data-open-id]');
      if (!target) return;
      openDetailModal(target.getAttribute('data-open-tab'), target.getAttribute('data-open-id'));
    });

    els.closeDetailModalBtn.addEventListener('click', () => {
      els.detailModalBackdrop.hidden = true;
    });
    els.detailModalBackdrop.addEventListener('click', e => {
      if (e.target === els.detailModalBackdrop) els.detailModalBackdrop.hidden = true;
    });

    // Google Sheet Modal
    els.openSheetModalBtn.addEventListener('click', () => {
      els.sheetIdInput.value = SheetsSync.getActiveSheetId();
      els.sheetSyncLog.textContent = '';
      els.sheetConfigBackdrop.hidden = false;
    });
    els.closeSheetModalBtn.addEventListener('click', () => {
      els.sheetConfigBackdrop.hidden = true;
    });
    els.sheetConfigBackdrop.addEventListener('click', e => {
      if (e.target === els.sheetConfigBackdrop) els.sheetConfigBackdrop.hidden = true;
    });

    els.saveAndSyncSheetBtn.addEventListener('click', async () => {
      const cleanId = SheetsSync.setActiveSheetId(els.sheetIdInput.value);
      els.sheetIdInput.value = cleanId;
      els.sheetSyncLog.textContent = '구글 시트에서 실시간 데이터를 불러오는 중...';
      const res = await SheetsSync.syncFromGoogleSheets(DB, updateSyncBadge);
      if (res.ok) {
        els.sheetSyncLog.textContent = `✅ 동기화 완료! (${res.successTabs}개 시트 탭에서 총 ${res.updated}건의 유저 코멘트/티어 반영)`;
        renderStage();
      } else {
        els.sheetSyncLog.textContent = '⚠️ 시트를 불러오지 못했습니다. 시트 공유 권한(링크가 있는 모든 사용자 뷰어)을 확인해주세요.';
      }
    });

    els.resetSheetIdBtn.addEventListener('click', () => {
      const cleanId = SheetsSync.setActiveSheetId(SheetsSync.DEFAULT_SHEET_ID);
      els.sheetIdInput.value = cleanId;
      els.sheetSyncLog.textContent = '기본 시트 ID로 복원되었습니다.';
    });

    // Theme toggle
    els.themeToggleBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      els.themeIcon.textContent = next === 'light' ? '☀️' : '🌙';
      try { localStorage.setItem('ara_db_v2_theme', next); } catch (e) {}
    });

    // Brand Home reset
    els.brandHomeBtn.addEventListener('click', () => {
      STATE.query = '';
      els.searchInput.value = '';
      els.clearSearchBtn.hidden = true;
      switchTab('items');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        els.detailModalBackdrop.hidden = true;
        els.sheetConfigBackdrop.hidden = true;
      }
      if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) &&
          document.activeElement !== els.searchInput &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        els.searchInput.focus();
      }
    });
  }

  function updateSyncBadge(state, text) {
    if (!els.syncStatusDot || !els.syncStatusText) return;
    els.syncStatusDot.classList.toggle('syncing', state === 'syncing');
    els.syncStatusText.textContent = text;
  }

  function init() {
    try {
      const savedTheme = localStorage.getItem('ara_db_v2_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', savedTheme);
        els.themeIcon.textContent = savedTheme === 'light' ? '☀️' : '🌙';
      }
    } catch (e) {}

    // Sync viewMode button active state (Desktop = table default, Mobile = grid default)
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-view') === STATE.viewMode);
    });

    bindEvents();
    renderStage();

    // Trigger live Google Sheets sync in background
    if (SheetsSync) {
      SheetsSync.syncFromGoogleSheets(DB, updateSyncBadge).then(res => {
        if (res && res.ok) renderStage();
      });
    }
  }

  init();
})();


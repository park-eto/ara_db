/**
 * Ara DB VER 3.0 — Main Application Controller (js/app.js)
 * Master DB V3 (Google Sheet Live Sync) + In-Game Daily Dungeon Simulator + Abyss & Medusa Farming Guide
 * Mobile-First Overhaul + High-Density Desktop UI
 */
(function () {
  'use strict';

  const DB = window.ARA_DB_V3 || window.ARA_DB_V2;
  const Search = window.AraSearchV3 || window.AraSearchV2;
  const SheetsSync = window.AraSheetsSyncV3 || window.AraSheetsSyncV2;
  const Simulator = window.AraSimulatorV3;

  if (!DB) {
    console.error('ARA_DB_V3 data not loaded.');
    return;
  }

  const CATEGORY_ICONS = {
    items: 'assets/icons/InGameUI/Weapon_011.webp',
    heroes: 'assets/icon_skin.png',
    mercenaries: 'assets/icons/Reward2/Icon_Hero_025.webp',
    towers: 'assets/icons/InGameUI/Tower_25.webp',
    simulator: 'assets/icons/OutGameUI/Housing_4.webp',
    farming: 'assets/icons/InGameUI/Weapon2_20.webp',
    mounts: 'assets/icons/Reward2/Vehicle_117.webp',
    pets: 'assets/icons/Reward2/Pet_17.webp',
    camp: 'assets/icons/Reward2/Housing_2.webp',
    relics: 'assets/icons/InGameUI/Rune_Stone_3.webp',
    stages: 'assets/icons/InGameUI/Bag_30.webp',
    growth: '',
  };

  const COMMENT_ICON_HTML = '<img class="comment-ara-ic" src="assets/comment_by_ara2.png" alt="코멘트" />';
  function renderCardComment(comment, label = '') {
    if (!comment) return '';
    return `<div class="card-comment">${COMMENT_ICON_HTML}<span>${label ? escapeHtml(label) : ''}${escapeHtml(comment)}</span></div>`;
  }
  function renderInlineComment(comment) {
    if (!comment) return '';
    return `<span class="tbl-comment-cell">${COMMENT_ICON_HTML}<span>${escapeHtml(comment)}</span></span>`;
  }

  // Mobile 5-Group Navigation Mapping (Fixes V2 10-tab overflow bug)
  const MOBILE_GROUPS = {
    equip: {
      label: '장비·유물',
      tabs: [
        { tab: 'items', label: '⚔️ 장비 도감 (208)', icon: CATEGORY_ICONS.items },
        { tab: 'relics', label: '🔮 유물·룬 (14)', icon: CATEGORY_ICONS.relics },
      ],
    },
    hero: {
      label: '영웅·용병',
      tabs: [
        { tab: 'heroes', label: '🦸 영웅·스킨 (35·74)', icon: CATEGORY_ICONS.heroes },
        { tab: 'mercenaries', label: '🛡️ 지원용병 (35)', icon: CATEGORY_ICONS.mercenaries },
      ],
    },
    tower: {
      label: '타워·배치',
      tabs: [
        { tab: 'simulator', label: '🔥 일일던전 배치 공유', icon: CATEGORY_ICONS.simulator },
        { tab: 'towers', label: '🏰 타워·버프 도감 (46)', icon: CATEGORY_ICONS.towers },
      ],
    },
    companion: {
      label: '탈것·펫·야영',
      tabs: [
        { tab: 'mounts', label: '🦌 탈것 (57)', icon: CATEGORY_ICONS.mounts },
        { tab: 'pets', label: '🐾 펫 (26)', icon: CATEGORY_ICONS.pets },
        { tab: 'camp', label: '⛺ 야영지 (55)', icon: CATEGORY_ICONS.camp },
      ],
    },
    farming: {
      label: '스테이지·정보',
      tabs: [
        { tab: 'stages', label: '🗺️ 스테이지·상점', icon: CATEGORY_ICONS.stages },
        { tab: 'growth', label: '📈 성장·계산기', icon: '' },
      ],
    },
  };

  const TAB_TO_MGROUP = {};
  Object.entries(MOBILE_GROUPS).forEach(([gKey, gObj]) => {
    gObj.tabs.forEach(t => {
      TAB_TO_MGROUP[t.tab] = gKey;
    });
  });

  const STATE = {
    tab: 'items',
    query: '',
    viewMode: window.innerWidth <= 860 ? 'grid' : 'table',
    sortBy: 'default',
    globalAwk: '0',
    mobileFilterOpen: false,
    filters: {
      items: { cat: 'all', range: 'all', grade: 'all', usage: 'all' },
      heroes: { subView: 'heroes', grade: 'all', tier: 'all', skinType: 'all' },
      mercenaries: { recommend: 'all', grade: 'all' },
      towers: { grade: 'all', deck: 'all', size: 'all' },
      farming: { dungeon: 'medusa', campBoost: 'boosted', dropsPerRun: 12 },
      mounts: { pool: 'all', subView: 'list' },
      pets: { grade: 'all', subView: 'list' },
      camp: { type: 'all', level: 'all', subView: 'list' },
      relics: { subType: 'relic' },
      stages: { subView: 'shopBox', boxId: 'all', shopCat: 'all', stageRange: 'milestone', selectedStage: 100, dungeonId: '41' },
    },
  };

  const QUICK_CHIPS_BY_TAB = {
    items: [
      { label: '🔥 S등급', q: 'S+' },
      { label: '🗡️ 빛의 단검', q: '빛의 단검' },
      { label: '🏹 감염된 신궁의 활', q: '감염된 신궁의 활' },
      { label: '🎯 사거리>=8', q: '사거리>=8' },
      { label: '💥 치피>=60', q: '치피>=60' },
      { label: '🏹 투사체>=1', q: '투사체>=1' },
      { label: '⚡ 공속>=40', q: '공속>=40' },
      { label: '🎯 관통', q: '관통' },
      { label: '💀 처형', q: '처형' },
      { label: '💫 스턴', q: '스턴' },
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
      { label: '🧩 2x2 (4칸)', q: '2x2' },
      { label: '🧩 3x2 (6칸)', q: '3x2' },
      { label: '🧩 3x3 (9칸)', q: '3x3' },
      { label: '🎯 사거리>=7', q: '사거리>=7' },
      { label: '⚔️ 공격력 버프', q: '공격력' },
      { label: '⚡ 공격속도 버프', q: '공격 속도' },
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
    stages: [
      { label: '🎁 정복 패키지', q: '정복' },
      { label: '🦸 영웅 패키지', q: '영웅' },
      { label: '🏰 타워 패키지', q: '타워' },
      { label: '🎫 패스', q: '패스' },
      { label: '👗 스킨', q: '스킨' },
      { label: '💎 다이아', q: '다이아' },
    ],
    simulator: [],
    farming: [],
    growth: [],
  };

  const TAB_TITLES = {
    items: '장비 도감 (공식 0~5각성 · 마스터 V3)',
    heroes: '영웅 · 스킨 도감',
    mercenaries: '지원용병 도감 (B~SSS)',
    towers: '타워 · 인게임 웨이브 버프 도감',
    simulator: '일일던전 배치 공유 시뮬레이터',
    farming: '심연의 모래 구멍 & 메두사 파밍 확률 가이드',
    mounts: '탈것 도감 · 강화표 (57종)',
    pets: '펫 도감 · 드랍 가이드',
    camp: '야영지 도감 (구조물·소품·배경)',
    relics: '유물 · 룬 도감',
    stages: '스테이지 밸런스 · 상점 뽑기 확률 · 패키지 도감',
    growth: '📈 공식 성장 테이블 & 스탯 계산기',
  };

  // DOM Elements
  const els = {
    searchInput: document.getElementById('globalSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    crossMatchBar: document.getElementById('crossMatchBar'),
    primaryNav: document.getElementById('primaryNav'),
    mobileBottomNav: document.getElementById('mobileBottomNav'),
    mobileSubnavBar: document.getElementById('mobileSubnavBar'),
    mobileFilterBar: document.getElementById('mobileFilterBar'),
    mobileFilterToggleBtn: document.getElementById('mobileFilterToggleBtn'),
    mobileFilterActiveBadge: document.getElementById('mobileFilterActiveBadge'),
    mobileFilterChevron: document.getElementById('mobileFilterChevron'),
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
    detailModalDragHandle: document.getElementById('detailModalDragHandle'),
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
    headerSimBtn: document.getElementById('headerSimBtn'),
    headerPatchBtn: document.getElementById('headerPatchBtn'),
    patchNewBadge: document.getElementById('patchNewBadge'),
    patchNoteBackdrop: document.getElementById('patchNoteBackdrop'),
    patchModalDragHandle: document.getElementById('patchModalDragHandle'),
    closePatchModalBtn: document.getElementById('closePatchModalBtn'),
    refreshPatchNotesBtn: document.getElementById('refreshPatchNotesBtn'),
    patchSearchInput: document.getElementById('patchSearchInput'),
    patchCategoryPills: document.getElementById('patchCategoryPills'),
    patchModalBody: document.getElementById('patchModalBody'),
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setModalLock(isOpen) {
    document.body.classList.toggle('modal-open', Boolean(isOpen));
  }

  function closeAllModals() {
    els.detailModalBackdrop.hidden = true;
    els.sheetConfigBackdrop.hidden = true;
    if (els.patchNoteBackdrop) els.patchNoteBackdrop.hidden = true;
    setModalLock(false);
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
    if (t === 'B+') return 10;
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
  const STAT_NAME_MAP = {
    '4': '무기 공격력',
    '3': '모든 공격력',
    '1': '모든 타워 공격력',
    '10': '영웅 체력',
  };
  const AWK_MAIN_BONUS = [0, 50, 120, 200, 300, 400];

  function calculateItemMainStat(item, gradeIdx, level, qualityPct, awkLv, overrideStatCode) {
    const gradeTable = (DB.itemMeta && DB.itemMeta.gradeTable) || [];
    const gRow = gradeTable[gradeIdx] || gradeTable[7] || {};
    const statCode = String(overrideStatCode || (item.basicStat && item.basicStat.statCode) || '4');
    const cols = GRADE_COL_MAP[statCode] || GRADE_COL_MAP['4'];
    const basic = parseFloat(gRow[cols[0]] || 0);
    const lvUp = parseFloat(gRow[cols[1]] || 0);
    const effLv = Math.min(Math.max(1, parseInt(level, 10) || 1), 400);
    const qPct = parseFloat(qualityPct !== undefined && qualityPct !== null ? qualityPct : 110);
    const q = Math.min(1.1, Math.max(0.9, qPct / 100));

    const baseVal = basic + lvUp * (effLv - 1);
    let s = q * baseVal;
    const isRing = item.cat === 'ring' || (item.basicStat && item.basicStat.isRing);
    if (isRing) {
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
    if (item.weaponSpecs && item.weaponSpecs.atk > 0 && statCode === '4') {
      weaponFinalAtk = Math.round(item.weaponSpecs.atk * (1 + s / 100));
    }
    return {
      statCode,
      statName: STAT_NAME_MAP[statCode] || '주옵션',
      mainPct,
      weaponFinalAtk,
      basic,
      lvUp,
      effLv,
      q,
      qPct,
      baseVal,
      bonus,
      s,
      isRing,
    };
  }

  // =========================================================================
  // Mobile Sub-Nav & Filter Drawer Helpers
  // =========================================================================
  function renderMobileSubnav() {
    if (!els.mobileSubnavBar) return;
    const mGroupKey = TAB_TO_MGROUP[STATE.tab] || 'equip';
    const groupObj = MOBILE_GROUPS[mGroupKey];

    // Highlight active group in bottom nav
    if (els.mobileBottomNav) {
      els.mobileBottomNav.querySelectorAll('[data-mgroup]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mgroup') === mGroupKey);
      });
    }

    if (!groupObj || groupObj.tabs.length <= 1) {
      els.mobileSubnavBar.innerHTML = '';
      els.mobileSubnavBar.hidden = true;
      return;
    }

    els.mobileSubnavBar.hidden = false;
    els.mobileSubnavBar.innerHTML = groupObj.tabs.map(t => {
      const isAct = t.tab === STATE.tab;
      const icHtml = t.icon ? `<img class="m-subnav-ic" src="${escapeHtml(t.icon)}" alt="" />` : '';
      return `
        <button type="button" class="m-subnav-pill ${isAct ? 'active' : ''}" data-tab="${escapeHtml(t.tab)}">
          ${icHtml}<span>${escapeHtml(t.label)}</span>
        </button>
      `;
    }).join('');
  }

  function updateMobileFilterBadge() {
    if (!els.mobileFilterActiveBadge || !els.mobileFilterBar) return;
    const tab = STATE.tab;
    if (tab === 'simulator' || tab === 'growth') {
      els.mobileFilterBar.style.display = 'none';
      return;
    }
    els.mobileFilterBar.style.display = '';

    const fObj = STATE.filters[tab] || {};
    const activeVals = Object.entries(fObj)
      .filter(([k, v]) => v && v !== 'all' && v !== 'list' && v !== 'heroes' && k !== 'selectedStage' && k !== 'dropsPerRun')
      .map(([, v]) => v);
    els.mobileFilterActiveBadge.textContent = activeVals.length ? `${activeVals.length}개 적용중` : '전체 보기';
    els.contextToolbar.classList.toggle('mobile-expanded', STATE.mobileFilterOpen);
    if (els.mobileFilterChevron) {
      els.mobileFilterChevron.textContent = STATE.mobileFilterOpen ? '▲' : '▼';
    }
    if (els.mobileFilterToggleBtn) {
      els.mobileFilterToggleBtn.setAttribute('aria-expanded', String(STATE.mobileFilterOpen));
    }
  }

  // =========================================================================
  // Context Filter Bar Builder
  // =========================================================================
  function renderContextToolbar() {
    const tab = STATE.tab;
    els.awkGlobalToggleWrap.style.display = tab === 'items' ? 'flex' : 'none';
    els.resultsHeader.style.display = (tab === 'growth' || tab === 'simulator' || tab === 'farming') ? 'none' : 'flex';

    renderMobileSubnav();
    updateMobileFilterBadge();

    if (tab === 'growth' || tab === 'simulator') {
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
        ['skins', '영웅 스킨 도감 (74종)', 'assets/icon_skin.png'],
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
      html += buildFilterRow('건설 크기', 'size', f.size || 'all', [
        ['all', '전체 크기'],
        ['4', '2×2 (4칸 · 소형)'],
        ['6', '3×2 · 2×3 (6칸 · 중형)'],
        ['8', '4×2 · 2×4 (8칸 · 장방형)'],
        ['9', '3×3 (9칸 · 대형)'],
        ['16', '4×4 (16칸 · 초대형)'],
      ]);
      html += buildFilterRow('영웅덱', 'deck', f.deck, [
        ['all', '전체 타워'],
        ['heroDeck', '영웅덱 추천 타워만'],
      ]);
    } else if (tab === 'farming') {
      const f = STATE.filters.farming;
      html += buildFilterRow('파밍 던전', 'dungeon', f.dungeon, [
        ['medusa', '🐍 메두사 — 빛의 단검 · 감염된 신궁의 활 확률 집중 분석', 'assets/icons/InGameUI/Weapon2_20.webp'],
        ['abyss', '🏜️ 심연의 모래 구멍 — 보스 주기 · 장비 26종 드랍 확률표', 'assets/icons/InGameUI/Weapon_2_120.webp'],
      ]);
      html += buildFilterRow('야영지 소품', 'campBoost', f.campBoost, [
        ['boosted', '⛺ 부위 집중 소품 세팅 적용 (해당 부위 27.27%)'],
        ['base', '🎲 기본 세팅 (5부위 균등 20.0%)'],
      ]);
    } else if (tab === 'mounts') {
      const f = STATE.filters.mounts;
      // Note: Mount sub-option probabilities removed per user request
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['list', '탈것 도감 (57종)', CATEGORY_ICONS.mounts],
        ['upgrade', '⬆️ 탈것 강화 단계별 사료 표'],
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
        ['common', '📊 야영지 추천 세팅 조합 · 주옵션/부옵션 표'],
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
    } else if (tab === 'stages') {
      const f = STATE.filters.stages;
      html += buildFilterRow('화면보기', 'subView', f.subView, [
        ['shopBox', '🎁 뽑기 상자 (1~18Lv 확률 · 보석 소모량) & 일일상점', 'assets/icons/InGameUI/Bag_30.webp'],
        ['shopPkg', '🛒 패키지 · 클리어 보상 도감 (576종)', 'assets/icons/InGameUI/Bag_28.webp'],
        ['stageCalc', '🗺️ 메인 스테이지 밸런스 · 드랍률 (1~1,010스테이지)', 'assets/icons/InGameUI/TrapCard_10.webp'],
        ['dungeon', '⛩️ 특수 던전 (사원·무덤·제단·고블린 1~20단계)', 'assets/icons/InGameUI/Relics_Full_4.webp'],
      ]);
      if (f.subView === 'shopBox') {
        html += buildFilterRow('상자 종류', 'boxId', f.boxId, [
          ['all', '전체 상자 보기 (4종)'],
          ['110', '⚔️ 아이템 상자 (1~18Lv)'],
          ['120', '🏰 타워 & 영웅 상자 (1~18Lv)'],
          ['130', '🐾 펫 상자 (1~18Lv)'],
          ['131', '⛺ 오브젝트(야영지) 상자 (2~18Lv)'],
        ]);
      } else if (f.subView === 'shopPkg') {
        html += buildFilterRow('분류', 'shopCat', f.shopCat, [
          ['all', '전체 (576종)'],
          ['스테이지·던전 기념', '스테이지·던전 기념'],
          ['영웅 패키지', '영웅 패키지'],
          ['타워·탈것 패키지', '타워·탈것 패키지'],
          ['패스·정기 패키지', '패스·정기 패키지'],
          ['스킨 패키지', '스킨 패키지'],
          ['이벤트·시즌 패키지', '이벤트·시즌 패키지'],
          ['기본 상점·편의성', '기본 상점·편의성'],
        ]);
      } else if (f.subView === 'stageCalc') {
        html += buildFilterRow('구간 보기', 'stageRange', f.stageRange, [
          ['milestone', '주요 구간 요약 (10스테이지 단위)'],
          ['1_200', '1 ~ 200 스테이지'],
          ['201_400', '201 ~ 400 스테이지'],
          ['401_600', '401 ~ 600 스테이지'],
          ['601_800', '601 ~ 800 스테이지'],
          ['801_1010', '801 ~ 1,010 스테이지'],
          ['curses', '☠️ 스테이지 저주 카드(18종) · 저주 타워(5종) 도감'],
        ]);
      } else if (f.subView === 'dungeon') {
        html += buildFilterRow('던전 선택', 'dungeonId', f.dungeonId, [
          ['41', '🏛️ 불결한 사원 (1~20단계)'],
          ['42', '🪦 붉은 무덤 (1~20단계)'],
          ['43', '🕯️ 이교도 제단 (1~20단계)'],
          ['44', '👺 골칫덩어리 고블린 야영지 (1~20단계)'],
        ]);
      }
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
      ['stages', '스테이지·상점'],
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
        if (f.size && f.size !== 'all' && String(t.specs?.tileCnt || 4) !== f.size) return false;
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
    } else if (tab === 'stages') {
      const f = STATE.filters.stages;
      const pkgs = (DB.stagesAndShop && DB.stagesAndShop.shopPackages) || [];
      list = pkgs.filter(p => {
        if (f.shopCat !== 'all' && p.category !== f.shopCat) return false;
        return Search.matchEntry(p, tokens);
      });
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
  // Stage Renderers (Card Grid, Data Table, Simulator, Farming, Reference Views)
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

    if (tab === 'simulator') {
      if (Simulator && typeof Simulator.mount === 'function') {
        Simulator.mount(els.contentStage);
      } else {
        els.contentStage.innerHTML = `<div class="empty-state">배치 시뮬레이터 모듈을 불러오지 못했습니다.</div>`;
      }
      return;
    }

    if (tab === 'farming') {
      renderFarmingGuideStage();
      return;
    }

    if (tab === 'growth') {
      renderGrowthCalculatorStage();
      return;
    }

    // Handle specialized reference sub-views
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
    if (tab === 'stages') {
      let sv = STATE.filters.stages.subView || 'shopBox';
      if (STATE.query.trim() && (sv === 'shopBox' || sv === 'dungeon')) {
        STATE.filters.stages.subView = 'shopPkg';
        sv = 'shopPkg';
        renderContextToolbar();
      }
      if (sv === 'shopBox') {
        renderShopBoxStage();
        return;
      }
      if (sv === 'stageCalc') {
        renderMainStageExplorer();
        return;
      }
      if (sv === 'dungeon') {
        renderDungeonBalanceStage();
        return;
      }
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

  // =========================================================================
  // NEW: Farming Guide Renderer (Medusa & Abyss Sand Pit — Zero Sweep Comparison)
  // =========================================================================
  function renderFarmingGuideStage() {
    const fg = DB.farmingGuide || {};
    const f = STATE.filters.farming;
    const isBoosted = f.campBoost === 'boosted';

    if (f.dungeon === 'abyss') {
      renderAbyssFarmingView(fg.abyss || {}, isBoosted);
    } else {
      renderMedusaFarmingView(fg.medusa || {}, isBoosted);
    }
  }

  function renderMedusaFarmingView(medusa, isBoosted) {
    const targets = medusa.featuredTargets || [];
    const poolSummary = medusa.gradeDist || [];
    const poolItems = medusa.poolItems || [];
    const dropsPerRun = Math.max(1, Math.min(100, parseInt(STATE.filters.farming.dropsPerRun || 12, 10)));

    els.contentStage.innerHTML = `
      <div class="farming-stage-wrap">
        <!-- Hero Banner -->
        <div class="farming-hero-banner medusa-banner">
          <div class="farming-hero-top">
            <div class="farming-hero-title-group">
              <span class="badge badge-awk">던전 전용 신(God) 해금 파밍</span>
              <h2 class="farming-hero-title">🐍 메두사 — 『빛의 단검』 & 『감염된 신궁의 활』 확률 집중 정리</h2>
              <p class="farming-hero-sub">${escapeHtml(medusa.subtitle || '')}</p>
            </div>
            <div class="farming-mode-switch">
              <button type="button" class="btn-secondary ${!isBoosted ? 'active-mode-btn' : ''}" data-set-camp-boost="base">
                🎲 기본 부위 확률 (20.0%)
              </button>
              <button type="button" class="btn-primary ${isBoosted ? 'active-mode-btn' : ''}" data-set-camp-boost="boosted">
                ⛺ 야영지 부위 집중 세팅 (27.27%)
              </button>
            </div>
          </div>
          <div class="farming-overview-list">
            ${(medusa.overview || []).map(line => `<div class="farming-overview-item">• ${escapeHtml(line)}</div>`).join('')}
          </div>
          ${medusa.disclaimer ? `<div class="farming-disclaimer-banner" style="margin-top:12px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:0.85rem;color:var(--text-muted);">${escapeHtml(medusa.disclaimer)}</div>` : ''}
        </div>

        <!-- Featured 2 Target Cards: 빛의 단검 vs 감염된 신궁의 활 -->
        <div class="medusa-targets-grid">
          ${targets.map(t => {
            const probStr = isBoosted ? t.dropProbBoosted : t.dropProbBase;
            const oddsStr = isBoosted ? t.dropOddsBoosted : t.dropOddsBase;
            const d50 = isBoosted ? t.dropsFor50PctBoosted : t.dropsFor50PctBase;
            const d90 = isBoosted ? t.dropsFor90PctBoosted : t.dropsFor90PctBase;
            const partRate = isBoosted ? t.boostedPartRate : t.basePartRate;
            const pNum = parseFloat(String(probStr).replace('%', '')) / 100;
            const avgDrops = pNum > 0 ? Math.round(1 / pNum) : 0;
            const avgRuns = avgDrops > 0 ? Math.ceil(avgDrops / dropsPerRun) : 0;
            const runs50 = pNum > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - pNum) / dropsPerRun) : 0;

            return `
              <article class="medusa-target-card" data-open-id="${escapeHtml(t.id)}" data-open-tab="items">
                <div class="medusa-target-header">
                  <div class="medusa-target-icon">
                    ${t.img ? `<img src="${escapeHtml(t.img)}" alt="${escapeHtml(t.name)}" />` : '⚔️'}
                  </div>
                  <div class="medusa-target-titles">
                    <div class="card-badges">
                      <span class="badge badge-awk">${escapeHtml(t.part)} · ${escapeHtml(t.minGrade)}</span>
                      ${t.grade ? `<span class="badge ${tierBadgeClass(t.grade)}">티어 ${escapeHtml(t.grade)}</span>` : ''}
                    </div>
                    <h3 class="medusa-target-name">${escapeHtml(t.name)}</h3>
                    <div class="medusa-target-formula">
                      신 등급(<strong>${escapeHtml(t.godGradeRate)}</strong>) × 부위(<strong>${escapeHtml(partRate.split(' ')[0])}</strong>) × 후보 저격(<strong>${escapeHtml(t.inPartChance)}</strong>)
                    </div>
                  </div>
                  <div class="medusa-target-prob-box">
                    <div class="prob-label">${isBoosted ? '⛺ 야영지 집중 세팅' : '🎲 기본 세팅'} 단일 드랍률</div>
                    <div class="prob-big-val">${escapeHtml(probStr)}</div>
                    <div class="prob-odds-sub">${escapeHtml(oddsStr)}</div>
                  </div>
                </div>

                <div class="medusa-stats-strip">
                  <div class="m-stat-box">
                    <span class="m-stat-lbl">동일 부위 경쟁 후보</span>
                    <strong class="m-stat-val">${t.partPoolCount}종 (${escapeHtml(t.inPartChance)})</strong>
                  </div>
                  <div class="m-stat-box">
                    <span class="m-stat-lbl">50% 확률 누적 드랍수</span>
                    <strong class="m-stat-val" style="color:var(--accent-teal);">장비 ${escapeHtml(d50)}</strong>
                  </div>
                  <div class="m-stat-box">
                    <span class="m-stat-lbl">90% 확률 누적 드랍수</span>
                    <strong class="m-stat-val" style="color:var(--accent-amber);">장비 ${escapeHtml(d90)}</strong>
                  </div>
                  <div class="m-stat-box">
                    <span class="m-stat-lbl">판당 ${dropsPerRun}개 드랍 시</span>
                    <strong class="m-stat-val">50%까지 약 ${runs50.toLocaleString()}판 (평균 ${avgRuns.toLocaleString()}판)</strong>
                  </div>
                </div>

                <div class="medusa-summary-note">
                  💡 ${escapeHtml(t.summary)}
                </div>

                <div class="medusa-pool-chips">
                  <span class="pool-chip-title">📋 메두사 신 등급 [${escapeHtml(t.part)}] 후보 목록 (${t.partPoolCount}종):</span>
                  ${(t.partPoolItems || []).map(pName => {
                    const isMe = pName.includes(t.name);
                    return `<span class="badge ${isMe ? 'badge-awk' : 'badge-drop'}">${escapeHtml(pName)}</span>`;
                  }).join('')}
                </div>

                <div class="card-footer" style="margin-top:4px;">
                  <span style="display:inline-flex;align-items:center;gap:4px;">${COMMENT_ICON_HTML} ${escapeHtml(t.comment || '클릭하여 0~5각성 상세 옵션 및 주옵션 계산기 열기')}</span>
                  <span style="color:var(--accent-primary);font-weight:800;">0~5각성 상세 보기 ›</span>
                </div>
              </article>
            `;
          }).join('')}
        </div>

        <!-- Interactive Run Calculator -->
        <div class="modal-section">
          <div class="modal-sec-title" style="flex-wrap:wrap;gap:8px;">
            <span>🧮 메두사 파밍 기대 판수 시뮬레이터 (빛의 단검 vs 감염된 신궁의 활)</span>
            <span class="badge badge-level">${isBoosted ? '야영지 부위 집중 소품(+10%) 적용 중' : '기본 부위 확률(20%) 적용 중'}</span>
          </div>
          <div class="calc-grid" style="align-items:center;">
            <div class="calc-field">
              <label>1판당 평균 장비 획득 개수 (보스+일반몹 합산)</label>
              <input type="number" id="medusaDropsPerRunInput" class="ctrl-input" value="${dropsPerRun}" min="1" max="100" />
            </div>
            <div class="calc-field" style="grid-column:span 2;">
              <label>빠른 선택 (본인의 메두사 1판 평균 장비 드랍 수)</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${[8, 10, 12, 15, 20, 25].map(n => `
                  <button type="button" class="filter-chip ${dropsPerRun === n ? 'active' : ''}" data-set-drops-run="${n}">${n}개/판</button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="table-wrap" style="margin-top:8px;">
            <table class="db-table">
              <thead>
                <tr>
                  <th>목표 아이템</th>
                  <th style="text-align:center;">부위 (경쟁 후보)</th>
                  <th style="text-align:center;">기본 세팅 (20%) 확률</th>
                  <th style="text-align:center;">야영지 집중 세팅 (27.27%)</th>
                  <th style="text-align:center;">50% 획득 기대 판수 (${dropsPerRun}개/판)</th>
                  <th style="text-align:center;">평균(기댓값) 판수 (${dropsPerRun}개/판)</th>
                  <th style="text-align:center;">90% 획득 기대 판수 (${dropsPerRun}개/판)</th>
                </tr>
              </thead>
              <tbody>
                ${targets.map(t => {
                  const pStr = isBoosted ? t.dropProbBoosted : t.dropProbBase;
                  const p = parseFloat(String(pStr).replace('%', '')) / 100;
                  const r50 = p > 0 ? Math.ceil((Math.log(0.5) / Math.log(1 - p)) / dropsPerRun) : 0;
                  const rAvg = p > 0 ? Math.ceil((1 / p) / dropsPerRun) : 0;
                  const r90 = p > 0 ? Math.ceil((Math.log(0.1) / Math.log(1 - p)) / dropsPerRun) : 0;
                  return `
                    <tr data-open-id="${escapeHtml(t.id)}" data-open-tab="items">
                      <td>
                        <div class="tbl-item-cell">
                          ${t.img ? `<img class="tbl-icon" src="${escapeHtml(t.img)}" alt="" />` : ''}
                          <div>
                            <strong>${escapeHtml(t.name)}</strong>
                            <div class="card-id">공식ID #${t.officialId}</div>
                          </div>
                        </div>
                      </td>
                      <td style="text-align:center;"><span class="badge badge-rare">${escapeHtml(t.part)} (${t.partPoolCount}종)</span></td>
                      <td style="text-align:center;font-weight:700;">${escapeHtml(t.dropProbBase)} <span class="card-id">(1/${(100 / parseFloat(t.dropProbBase)).toLocaleString()})</span></td>
                      <td style="text-align:center;font-weight:800;color:var(--accent-teal);">${escapeHtml(t.dropProbBoosted)} <span class="card-id">(약 1/${Math.round(100 / parseFloat(t.dropProbBoosted)).toLocaleString()})</span></td>
                      <td style="text-align:center;"><strong style="color:var(--accent-primary);">약 ${r50.toLocaleString()}판</strong></td>
                      <td style="text-align:center;"><strong>약 ${rAvg.toLocaleString()}판</strong></td>
                      <td style="text-align:center;"><strong style="color:var(--accent-amber);">약 ${r90.toLocaleString()}판</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Medusa Grade & Part Distribution Table -->
        <div class="modal-section">
          <h3 class="modal-sec-title">📊 메두사 등급별 등장 확률 & 부위별 후보 장비 수</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th style="text-align:center;">드랍 등급</th>
                  <th style="text-align:center;">등급 당첨 확률</th>
                  <th style="text-align:center;">전체 후보 수</th>
                  <th style="text-align:center;">주무기 (20%)</th>
                  <th style="text-align:center;">보조무기 (20%)</th>
                  <th style="text-align:center;">기타 (20%)</th>
                  <th style="text-align:center;">투구 (20%)</th>
                  <th style="text-align:center;">반지 (20%)</th>
                </tr>
              </thead>
              <tbody>
                ${poolSummary.map(row => `
                  <tr>
                    <td style="text-align:center;"><span class="badge ${row.grade === '신' ? 'badge-awk' : (row.grade === '전설' ? 'badge-legend' : 'badge-rare')}">${escapeHtml(row.grade)}</span></td>
                    <td style="text-align:center;"><strong>${escapeHtml(row.rate)}</strong></td>
                    <td style="text-align:center;">${row.total}종</td>
                    <td style="text-align:center;${row.grade === '신' ? 'color:var(--accent-amber);font-weight:800;' : ''}">${row.weapon}종</td>
                    <td style="text-align:center;${row.grade === '신' ? 'color:var(--accent-teal);font-weight:800;' : ''}">${row.sub}종</td>
                    <td style="text-align:center;">${row.etc}종</td>
                    <td style="text-align:center;">${row.helmet}종</td>
                    <td style="text-align:center;">${row.ring}종</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Medusa Major Drop Pool Table -->
        <div class="modal-section">
          <h3 class="modal-sec-title">🗡️ 메두사 주요 드랍 장비 목록 (클릭 시 각성 옵션 · 계산기 열기)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th>장비명</th>
                  <th style="text-align:center;">부위</th>
                  <th style="text-align:center;">최소 등장 등급</th>
                  <th style="text-align:center;">티어/사용</th>
                  <th style="text-align:center;">단일 드랍 확률 (기본)</th>
                  <th>세부 확률 및 비고</th>
                </tr>
              </thead>
              <tbody>
                ${poolItems.map(it => `
                  <tr data-open-id="${escapeHtml(it.id)}" data-open-tab="items" style="${it.highlight ? 'background:rgba(244,63,94,0.09);' : ''}">
                    <td>
                      <div class="tbl-item-cell">
                        ${it.img ? `<img class="tbl-icon" src="${escapeHtml(it.img)}" alt="" />` : ''}
                        <div>
                          <strong>${escapeHtml(it.name)}</strong>
                          ${it.highlight ? `<span class="badge badge-awk" style="margin-left:4px;">핵심 목표</span>` : ''}
                        </div>
                      </div>
                    </td>
                    <td style="text-align:center;"><span class="badge">${escapeHtml(it.part)}</span></td>
                    <td style="text-align:center;"><span class="badge ${it.minGrade === '신' ? 'badge-awk' : (it.minGrade === '전설' ? 'badge-legend' : 'badge-rare')}">${escapeHtml(it.minGrade)}</span></td>
                    <td style="text-align:center;">
                      ${it.grade ? `<span class="badge ${tierBadgeClass(it.grade)}">${escapeHtml(it.grade)}</span>` : '-'}
                    </td>
                    <td style="text-align:center;"><strong style="color:${it.highlight ? 'var(--accent-amber)' : 'var(--text-main)'};">${escapeHtml(it.dropProb)}</strong></td>
                    <td style="font-size:12px;color:var(--text-secondary);">${escapeHtml(it.detail)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Bind Medusa interactive controls
    els.contentStage.querySelectorAll('[data-set-camp-boost]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.filters.farming.campBoost = btn.getAttribute('data-set-camp-boost');
        renderStage();
      });
    });
    els.contentStage.querySelectorAll('[data-set-drops-run]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.filters.farming.dropsPerRun = parseInt(btn.getAttribute('data-set-drops-run'), 10) || 12;
        renderStage();
      });
    });
    document.getElementById('medusaDropsPerRunInput')?.addEventListener('change', e => {
      STATE.filters.farming.dropsPerRun = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 12));
      renderStage();
    });
  }

  function renderAbyssFarmingView(abyss, isBoosted) {
    const mechanics = abyss.mechanicCards || [];
    const gradeDist = abyss.gradeDist || [];
    const highlights = abyss.highlights || [];
    const fullPool = abyss.fullPool || [];
    const boostMult = isBoosted ? (15 / 11) : 1.0;

    const scalePctStr = (str) => {
      if (!isBoosted || !str || str === '-') return str;
      return String(str).replace(/(\d+\.\d+)%/g, (_, num) => {
        const v = parseFloat(num) * boostMult;
        return `${v.toFixed(4)}%`;
      });
    };

    els.contentStage.innerHTML = `
      <div class="farming-stage-wrap">
        <!-- Hero Banner -->
        <div class="farming-hero-banner abyss-banner">
          <div class="farming-hero-top">
            <div class="farming-hero-title-group">
              <span class="badge badge-legend">심연 던전 파밍 가이드</span>
              <h2 class="farming-hero-title">🏜️ 심연의 모래 구멍 — 파밍 메커니즘 & 전 장비 드랍 확률표</h2>
              <p class="farming-hero-sub">${escapeHtml(abyss.subtitle || '')}</p>
            </div>
            <div class="farming-mode-switch">
              <button type="button" class="btn-secondary ${!isBoosted ? 'active-mode-btn' : ''}" data-set-camp-boost="base">
                🎲 기본 부위 확률 (20.0%)
              </button>
              <button type="button" class="btn-primary ${isBoosted ? 'active-mode-btn' : ''}" data-set-camp-boost="boosted">
                ⛺ 야영지 부위 집중 세팅 (27.27%)
              </button>
            </div>
          </div>
          ${abyss.disclaimer ? `<div class="farming-disclaimer-banner" style="margin-top:12px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:0.85rem;color:var(--text-muted);">${escapeHtml(abyss.disclaimer)}</div>` : ''}
        </div>

        <!-- 3 Core Mechanic Cards -->
        <div class="abyss-mechanic-grid">
          ${mechanics.map(mc => `
            <div class="modal-section abyss-mech-card">
              <div class="modal-sec-title">
                <span>${escapeHtml(mc.title)}</span>
                <span class="badge badge-tier-0">${escapeHtml(mc.badge)}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--text-secondary);">
                ${(mc.lines || []).map(l => `<div>• ${escapeHtml(l)}</div>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Highlight Target Items Table -->
        <div class="modal-section">
          <div class="modal-sec-title" style="flex-wrap:wrap;gap:8px;">
            <span>🌟 심연의 모래 구멍 핵심 파밍 목표 장비 확률표</span>
            <span class="badge badge-level">${isBoosted ? '⛺ 야영지 부위 집중 소품(27.27%) 반영 수치' : '🎲 기본 세팅(20.0%) 기준 수치'}</span>
          </div>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th>아이템명</th>
                  <th style="text-align:center;">부위</th>
                  <th style="text-align:center;">최소 등장 등급</th>
                  <th style="text-align:center;">에픽 확률</th>
                  <th style="text-align:center;">전설 확률</th>
                  <th style="text-align:center;">신 확률</th>
                  <th style="text-align:center;">합산 드랍 확률</th>
                  <th>기댓값 및 파밍 팁</th>
                </tr>
              </thead>
              <tbody>
                ${highlights.map(h => `
                  <tr data-open-id="${escapeHtml(h.id)}" data-open-tab="items">
                    <td>
                      <div class="tbl-item-cell">
                        ${h.img ? `<img class="tbl-icon" src="${escapeHtml(h.img)}" alt="" />` : ''}
                        <div>
                          <strong>${escapeHtml(h.name)}</strong>
                          ${h.grade ? `<span class="badge ${tierBadgeClass(h.grade)}" style="margin-left:4px;">${escapeHtml(h.grade)}</span>` : ''}
                        </div>
                      </div>
                    </td>
                    <td style="text-align:center;"><span class="badge">${escapeHtml(h.part)}</span></td>
                    <td style="text-align:center;"><span class="badge ${h.minGrade === '신' ? 'badge-awk' : (h.minGrade === '전설' ? 'badge-legend' : 'badge-rare')}">${escapeHtml(h.minGrade)}</span></td>
                    <td style="text-align:center;font-size:12px;">${escapeHtml(scalePctStr(h.epicProb))}</td>
                    <td style="text-align:center;font-size:12px;">${escapeHtml(scalePctStr(h.legendProb))}</td>
                    <td style="text-align:center;font-size:12px;color:var(--accent-amber);font-weight:700;">${escapeHtml(scalePctStr(h.godProb))}</td>
                    <td style="text-align:center;"><strong style="color:var(--accent-teal);font-size:13.5px;">${escapeHtml(scalePctStr(h.totalProb))}</strong></td>
                    <td style="font-size:12px;color:var(--text-secondary);">
                      <strong>${escapeHtml(h.expectedDrops)}</strong> · ${escapeHtml(h.note)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Abyss Grade & Part Distribution -->
        <div class="modal-section">
          <h3 class="modal-sec-title">📊 심연의 모래 구멍 등급별 드랍 확률 & 부위별 후보 수</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th style="text-align:center;">드랍 등급</th>
                  <th style="text-align:center;">등급 당첨 확률</th>
                  <th style="text-align:center;">전체 후보 수</th>
                  <th style="text-align:center;">주무기</th>
                  <th style="text-align:center;">보조무기</th>
                  <th style="text-align:center;">기타</th>
                  <th style="text-align:center;">투구</th>
                  <th style="text-align:center;">반지</th>
                </tr>
              </thead>
              <tbody>
                ${gradeDist.map(r => `
                  <tr>
                    <td style="text-align:center;"><span class="badge ${r.grade === '신' ? 'badge-awk' : (r.grade === '전설' ? 'badge-legend' : 'badge-rare')}">${escapeHtml(r.grade)}</span></td>
                    <td style="text-align:center;"><strong>${escapeHtml(r.rate)}</strong></td>
                    <td style="text-align:center;">${r.total}종</td>
                    <td style="text-align:center;">${r.weapon}종</td>
                    <td style="text-align:center;">${r.sub}종</td>
                    <td style="text-align:center;">${r.etc}종</td>
                    <td style="text-align:center;">${r.helmet > 0 ? `${r.helmet}종` : '<span style="color:var(--text-muted);">0 (미등장)</span>'}</td>
                    <td style="text-align:center;">${r.ring > 0 ? `${r.ring}종` : '<span style="color:var(--text-muted);">0 (미등장)</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Full 26 Items Drop Pool Table -->
        <div class="modal-section">
          <h3 class="modal-sec-title">📋 심연의 모래 구멍 전체 드랍 장비 26종 일람표 (클릭 시 상세 모달)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th>아이템명</th>
                  <th style="text-align:center;">구분</th>
                  <th style="text-align:center;">부위</th>
                  <th style="text-align:center;">최소 등급</th>
                  <th style="text-align:center;">티어</th>
                  <th style="text-align:center;">단일 드랍 확률</th>
                  <th>등급별 세부 확률</th>
                </tr>
              </thead>
              <tbody>
                ${fullPool.map(it => `
                  <tr data-open-id="${escapeHtml(it.id)}" data-open-tab="items">
                    <td>
                      <div class="tbl-item-cell">
                        ${it.img ? `<img class="tbl-icon" src="${escapeHtml(it.img)}" alt="" />` : ''}
                        <div>
                          <strong>${escapeHtml(it.name)}</strong>
                        </div>
                      </div>
                    </td>
                    <td style="text-align:center;">
                      <span class="badge ${it.exclusive ? 'badge-tier-0' : ''}">${it.exclusive ? '사막 고유 (18종)' : '일반 공용 (8종)'}</span>
                    </td>
                    <td style="text-align:center;"><span class="badge">${escapeHtml(it.part)}</span></td>
                    <td style="text-align:center;"><span class="badge ${it.minGrade === '신' ? 'badge-awk' : (it.minGrade === '전설' ? 'badge-legend' : 'badge-rare')}">${escapeHtml(it.minGrade)}</span></td>
                    <td style="text-align:center;">${it.grade ? `<span class="badge ${tierBadgeClass(it.grade)}">${escapeHtml(it.grade)}</span>` : '-'}</td>
                    <td style="text-align:center;"><strong style="color:var(--accent-teal);">${escapeHtml(scalePctStr(it.dropProb))}</strong></td>
                    <td style="font-size:12px;color:var(--text-secondary);">${escapeHtml(scalePctStr(it.detail))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    els.contentStage.querySelectorAll('[data-set-camp-boost]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.filters.farming.campBoost = btn.getAttribute('data-set-camp-boost');
        renderStage();
      });
    });
  }

  // =========================================================================
  // Encyclopedia Card & Table Renderers
  // =========================================================================
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
      if (tab === 'stages') return renderShopPackageCard(entry);
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
    const usageStr = Array.isArray(it.usage) && it.usage.length ? it.usage.join('/') : String(it.usage || '');
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
              ${it.weaponCategory ? `<span class="badge badge-level">${escapeHtml(it.weaponCategory)}</span>` : ''}
              ${it.rangeVal !== null && it.rangeVal !== undefined
                ? `<span class="badge badge-rare" title="${escapeHtml(it.attackType || '')}">사거리 ${it.rangeVal}</span>`
                : (it.range ? `<span class="badge">${escapeHtml(it.range)}</span>` : '')}
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

        ${renderCardComment(it.comment)}

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
        ${renderCardComment(h.comment)}
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
    const tw = t.specs?.tileW || 2;
    const th = t.specs?.tileH || 2;
    const tcnt = t.specs?.tileCnt || (tw * th);
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
              <span class="badge badge-rare">크기 ${tw}×${th} (${tcnt}칸)</span>
              ${t.specs?.range ? `<span class="badge">사거리 ${t.specs.range}</span>` : ''}
              ${t.heroDeckRec ? `<span class="badge ${tierBadgeClass(t.heroDeckRec)}">추천: ${escapeHtml(t.heroDeckRec)}</span>` : ''}
              <span class="badge badge-level">추가버프 ${t.waveBuffs?.length || 0}종</span>
            </div>
          </div>
        </div>
        <div class="card-abilities">
          <div class="ability-line">${escapeHtml(t.ability)}</div>
        </div>
        ${renderCardComment(t.comment)}
        <div class="card-footer">
          <span>공격력 ${t.specs?.atk} · 공속 ${t.specs?.aspd} · 사거리 ${t.specs?.range} · 최대 ${t.specs?.maxCount || 10}기</span>
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
        ${renderCardComment(m.comment)}
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
        ${renderCardComment(c.comment)}
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
        ${renderCardComment(e.comment)}
      </article>
    `;
  }

  function renderShopPackageCard(p) {
    const rewards = p.rewards || [];
    return `
      <article class="db-card" data-open-id="${escapeHtml(p.id)}" data-open-tab="stages">
        <div class="card-top">
          <div class="card-icon-box">
            <img src="assets/icons/InGameUI/Bag_28.webp" alt="" loading="lazy" />
          </div>
          <div class="card-head-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(p.name)}</h3>
              <span class="card-id">#${p.officialId}</span>
            </div>
            <div class="card-badges">
              <span class="badge badge-rare">${escapeHtml(p.category)}</span>
              <span class="badge ${p.krw > 0 ? 'badge-legend' : 'badge-level'}">${escapeHtml(p.priceText)}</span>
              ${p.packValue ? `<span class="badge badge-tier-0">🔥 ${escapeHtml(p.packValue)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="card-abilities">
          ${rewards.length
            ? rewards.map(r => `<div class="ability-line">🎁 <strong>${escapeHtml(r)}</strong></div>`).join('')
            : `<div class="ability-line" style="color:var(--text-muted);">• 인게임 패스/기능 해금 상품</div>`}
        </div>
        <div class="card-footer">
          <span>${escapeHtml(p.priceType)}${p.usd ? ` ($${escapeHtml(p.usd)})` : ''}</span>
          <span>구성품 상세 ›</span>
        </div>
      </article>
    `;
  }

  // =========================================================================
  // High-Density Table Renderer
  // =========================================================================
  const COMMENT_TH_HTML = `${COMMENT_ICON_HTML} 코멘트`;

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
          <th style="width:75px;text-align:center;">사거리</th>
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
        const usageStr = Array.isArray(it.usage) && it.usage.length ? it.usage.join('/') : (it.usage || '-');
        const tags = it.tags || [];
        const rangeBadge = (it.rangeVal !== null && it.rangeVal !== undefined)
          ? `<span class="badge badge-rare" title="${escapeHtml(it.attackType || '')}"><strong>${it.rangeVal}</strong></span>`
          : '<span style="color:var(--text-muted);">-</span>';
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
              ${it.weaponCategory ? `<span class="badge badge-level" style="margin-top:2px;">${escapeHtml(it.weaponCategory)}</span>` : ''}
            </td>
            <td style="text-align:center;">
              ${rangeBadge}
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
            <td style="max-width:240px;">
              ${renderInlineComment(it.comment)}
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
            <td>${renderInlineComment(e.comment)}</td>
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
              <td style="max-width:270px;white-space:pre-line;">${renderInlineComment(h.comment)}</td>
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
          <th style="width:110px;text-align:center;">크기 · 사거리</th>
          <th>능력</th>
          <th>레벨별 추가 버프 선택 (Lv.0 / 1 / 4 / 8 / 12 / 16 & 횟수)</th>
          <th style="width:85px;text-align:center;">추천</th>
          <th>${COMMENT_TH_HTML}</th>
        </tr>
      `;
      rowsHtml = entries.map(t => {
        const wBuffs = t.waveBuffs || [];
        const tw = t.specs?.tileW || 2;
        const th = t.specs?.tileH || 2;
        const tcnt = t.specs?.tileCnt || (tw * th);
        const rng = t.specs?.range || 0;
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
            <td style="text-align:center;">
              <span class="badge badge-rare">${tw}×${th} (${tcnt}칸)</span>
              ${rng > 0 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">사거리 <strong>${rng}</strong></div>` : '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">버프/설치</div>'}
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
            <td style="max-width:240px;">${renderInlineComment(t.comment)}</td>
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
          <td>${renderInlineComment(m.comment)}</td>
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
          <td>${renderInlineComment(c.comment)}</td>
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
            <td>${renderInlineComment(e.comment)}</td>
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
            <td>${renderInlineComment(e.comment)}</td>
          </tr>
        `).join('');
      }
    } else if (tab === 'stages') {
      headHtml = `
        <tr>
          <th style="width:80px;text-align:center;">상품ID</th>
          <th style="width:130px;text-align:center;">분류</th>
          <th>패키지 / 상품명</th>
          <th style="width:130px;text-align:center;">가격</th>
          <th style="width:95px;text-align:center;">효율 배수</th>
          <th>지급 보상 목록 (Reward 1~5)</th>
        </tr>
      `;
      rowsHtml = entries.map(p => `
        <tr data-open-id="${escapeHtml(p.id)}" data-open-tab="stages">
          <td style="text-align:center;color:var(--text-muted);font-weight:700;">#${p.officialId}</td>
          <td style="text-align:center;"><span class="badge badge-rare">${escapeHtml(p.category)}</span></td>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
          </td>
          <td style="text-align:center;">
            <span class="badge ${p.krw > 0 ? 'badge-legend' : 'badge-level'}">${escapeHtml(p.priceText)}</span>
          </td>
          <td style="text-align:center;">
            ${p.packValue ? `<span class="badge badge-tier-0">${escapeHtml(p.packValue)}</span>` : '-'}
          </td>
          <td>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${(p.rewards && p.rewards.length)
                ? p.rewards.map(r => `<span class="badge badge-drop">🎁 ${escapeHtml(r)}</span>`).join('')
                : '<span style="color:var(--text-muted);font-size:12px;">인게임 패스/기능 상품</span>'}
            </div>
          </td>
        </tr>
      `).join('');
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
  // Reference Sub-Views (Mount Upgrade, Pet Guide, Camp Common, Growth)
  // =========================================================================
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
              <thead><tr><th>주옵션 (기본 옵션)</th><th>${COMMENT_ICON_HTML} 추천 세팅 / 코멘트</th><th>중요도</th></tr></thead>
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
              <thead><tr><th>부옵션 (랜덤 옵션)</th><th>${COMMENT_ICON_HTML} 추천 대상 / 코멘트</th><th>중요도</th></tr></thead>
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

  // =========================================================================
  // Stages & Shop Specialized Renderers
  // =========================================================================
  const GRADE_COLORS_8 = [
    '#94a3b8', // 일반
    '#38bdf8', // 레어
    '#a78bfa', // 유니크
    '#34d399', // 엘리트
    '#f472b6', // 미스테리
    '#fb923c', // 에픽
    '#fbbf24', // 전설
    '#f43f5e', // 신
  ];

  function renderShopBoxStage() {
    const ss = DB.stagesAndShop || {};
    const boxes = ss.boxTable || [];
    const daily = ss.dailyShop || [];
    const activeBoxId = STATE.filters.stages.boxId || 'all';
    const visibleBoxes = activeBoxId === 'all' ? boxes : boxes.filter(b => b.id === activeBoxId);

    const itemBox = boxes.find(b => b.id === '110') || { prices: [300] };
    const stepPrices = itemBox.prices || [300];
    let cumSum = 0;
    const priceRows = stepPrices.map((p, i) => {
      cumSum += p;
      return { step: i + 1, cost: p, cum: cumSum };
    });

    els.resultsCountBadge.textContent = `상자 ${boxes.length}종 · 일일상점 ${daily.length}종`;
    els.activeFilterSummary.textContent = '공식 뽑기 상자 레벨별 확률 & 일일 상점';

    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="modal-section">
          <h3 class="modal-sec-title">💎 상점 뽑기 상자 재화 소모량 & 누적 붉은 보석 계산기</h3>
          <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px;">
            • <strong>아이템 상자 (#110)</strong>: 뽑기 횟수에 따라 1회당 <strong>붉은 보석 300개 → 최대 8,200개(25회차 이상 고정)</strong>로 단계별 증가합니다.<br/>
            • <strong>타워 & 영웅 상자 (#120) / 펫 & 오브젝트 상자 (#130)</strong>: 횟수 무관 1회당 <strong style="color:var(--accent-teal);">푸른 다이아 300개 고정</strong> (10연차 3,000 다이아)
          </p>
          <div class="calc-grid" style="margin-bottom:12px;">
            <div class="calc-field">
              <label>현재 진행 회차 (1~25회차)</label>
              <input type="number" id="boxStartStep" class="ctrl-input" value="1" min="1" max="25" />
            </div>
            <div class="calc-field">
              <label>뽑을 횟수 (1~200회)</label>
              <input type="number" id="boxPullCount" class="ctrl-input" value="25" min="1" max="200" />
            </div>
            <div class="calc-result-box" id="boxCostResultBox" style="grid-column:span 2;margin-top:0;"></div>
          </div>

          <details style="margin-top:8px;">
            <summary style="cursor:pointer;font-weight:800;font-size:13px;color:var(--accent-amber);">
              📋 아이템 상자 1회차 ~ 25회차+ 단계별 붉은 보석 소모량 & 누적표 펼치기 (클릭)
            </summary>
            <div class="table-wrap" style="margin-top:10px;">
              <table class="db-table">
                <thead>
                  <tr>
                    <th style="text-align:center;">뽑기 회차</th>
                    <th style="text-align:center;">해당 회차 소모 붉은 보석</th>
                    <th style="text-align:center;">1회차부터 누적 소모량</th>
                    <th style="text-align:center;">비고</th>
                  </tr>
                </thead>
                <tbody>
                  ${priceRows.map(r => `
                    <tr>
                      <td style="text-align:center;"><strong>${r.step}회차${r.step === 25 ? ' 이상' : ''}</strong></td>
                      <td style="text-align:center;"><span class="badge badge-rare">💎 ${r.cost.toLocaleString()}</span></td>
                      <td style="text-align:center;"><strong style="color:var(--accent-amber);">${r.cum.toLocaleString()} 보석</strong></td>
                      <td style="text-align:center;font-size:12px;color:var(--text-muted);">${r.step === 1 ? '첫 뽑기 (광고 무료 가능)' : (r.step === 25 ? '25회차 이후 8,200 보석 고정' : '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        ${visibleBoxes.map(b => `
          <div class="modal-section">
            <div class="modal-sec-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span>🎲 ${escapeHtml(b.name)} 레벨별 (Lv.1 ~ Lv.18) 등급 등장 확률표</span>
              <span class="badge badge-level">소모 재화: ${escapeHtml(b.currency)}</span>
            </div>
            <div class="table-wrap">
              <table class="db-table">
                <thead>
                  <tr>
                    <th style="width:75px;text-align:center;">상자 레벨</th>
                    <th style="width:95px;text-align:center;">다음 레벨 경험치</th>
                    ${b.gradeHeaders.map((gh, gi) => `
                      <th style="text-align:center;color:${GRADE_COLORS_8[gi] || 'inherit'};">${escapeHtml(gh)}</th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${b.levels.map(lv => `
                    <tr>
                      <td style="text-align:center;"><strong>Lv.${lv.level}</strong></td>
                      <td style="text-align:center;color:var(--text-muted);font-size:12px;">${lv.reqExp ? `${lv.reqExp.toLocaleString()}회` : 'MAX'}</td>
                      ${lv.probs.map((pv, pi) => `
                        <td style="text-align:center;font-weight:${pv > 0 ? '800' : '400'};color:${pv > 0 ? (GRADE_COLORS_8[pi] || 'var(--text-primary)') : 'var(--text-muted)'};">
                          ${pv > 0 ? `${pv}%` : '-'}
                        </td>
                      `).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}

        <div class="modal-section">
          <h3 class="modal-sec-title">🏪 일일 상점 품목별 가격 & 등장 확률표 (${daily.length}종)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th style="width:70px;text-align:center;">ID</th>
                  <th>품목명</th>
                  <th style="text-align:center;">지급 수량</th>
                  <th style="text-align:center;">구매 재화</th>
                  <th style="text-align:center;">가격</th>
                  <th style="text-align:center;">출현 비중</th>
                  <th style="text-align:center;">슬롯 등장 확률</th>
                </tr>
              </thead>
              <tbody>
                ${daily.map(d => `
                  <tr>
                    <td style="text-align:center;color:var(--text-muted);">#${d.id}</td>
                    <td><strong>${escapeHtml(d.name)}</strong></td>
                    <td style="text-align:center;">x${escapeHtml(d.count)}</td>
                    <td style="text-align:center;">
                      <span class="badge ${d.currency === '푸른 다이아' ? 'badge-rare' : (d.currency === '무료' ? 'badge-tier-0' : 'badge-level')}">${escapeHtml(d.currency)}</span>
                    </td>
                    <td style="text-align:center;"><strong>${d.price > 0 ? d.price.toLocaleString() : '무료'}</strong></td>
                    <td style="text-align:center;color:var(--text-muted);">${d.weight}</td>
                    <td style="text-align:center;">
                      ${d.probPct > 0 ? `<strong style="color:var(--accent-teal);">${d.probPct}%</strong>` : '<span style="color:var(--text-muted);">고정 슬롯</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const updateBoxCalc = () => {
      const startStep = Math.min(25, Math.max(1, parseInt(document.getElementById('boxStartStep')?.value || '1', 10)));
      const pullCnt = Math.min(500, Math.max(1, parseInt(document.getElementById('boxPullCount')?.value || '25', 10)));
      let totalRedGems = 0;
      for (let i = 0; i < pullCnt; i++) {
        const idx = Math.min(stepPrices.length - 1, (startStep - 1) + i);
        totalRedGems += stepPrices[idx];
      }
      const resBox = document.getElementById('boxCostResultBox');
      if (resBox) {
        resBox.innerHTML = `
          <div>
            <div style="font-size:12px;color:var(--text-muted);">${startStep}회차부터 연속 ${pullCnt}회 뽑기 시</div>
            <div style="font-weight:700;">필요한 총 붉은 보석 (타워·펫 상자는 다이아 ${(pullCnt * 300).toLocaleString()}개)</div>
          </div>
          <div class="calc-result-val">💎 ${totalRedGems.toLocaleString()}개</div>
        `;
      }
    };
    document.getElementById('boxStartStep')?.addEventListener('input', updateBoxCalc);
    document.getElementById('boxPullCount')?.addEventListener('input', updateBoxCalc);
    updateBoxCalc();
  }

  function renderMainStageExplorer() {
    const ss = DB.stagesAndShop || {};
    const stages = ss.mainStages || [];
    const curseCards = ss.curseCards || [];
    const cursedTowers = ss.cursedTowers || [];
    const rangeMode = STATE.filters.stages.stageRange || 'milestone';

    if (rangeMode === 'curses') {
      els.resultsCountBadge.textContent = `저주 타워 ${cursedTowers.length}종 · 저주 카드 ${curseCards.length}종`;
      els.contentStage.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
          <div class="modal-section">
            <h3 class="modal-sec-title">🗼 스테이지 시작 저주 타워 도감 (801~805)</h3>
            <div class="card-grid">
              ${cursedTowers.map(ct => `
                <article class="db-card" style="cursor:default;">
                  <div class="card-top">
                    <div class="card-icon-box">
                      ${ct.img ? `<img src="${escapeHtml(ct.img)}" alt="${escapeHtml(ct.name)}" />` : '🗼'}
                    </div>
                    <div class="card-head-info">
                      <div class="card-title-row">
                        <h3 class="card-title">${escapeHtml(ct.name)}</h3>
                        <span class="card-id">#${ct.id}</span>
                      </div>
                      <div class="card-badges">
                        <span class="badge badge-tier-0">${escapeHtml(ct.summary)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="card-abilities">
                    <div class="ability-line">${escapeHtml(ct.desc)}</div>
                  </div>
                </article>
              `).join('')}
            </div>
          </div>

          <div class="modal-section">
            <h3 class="modal-sec-title">☠️ 인게임 스테이지 저주 카드 도감 (${curseCards.length}종)</h3>
            <div class="table-wrap">
              <table class="db-table">
                <thead>
                  <tr><th style="width:80px;text-align:center;">저주ID</th><th style="width:180px;">저주 카드명</th><th>공식 효과 설명</th></tr>
                </thead>
                <tbody>
                  ${curseCards.map(cc => `
                    <tr>
                      <td style="text-align:center;color:var(--text-muted);font-weight:700;">#${cc.id}</td>
                      <td><strong style="color:var(--accent-amber);">☠️ ${escapeHtml(cc.name)}</strong></td>
                      <td>${escapeHtml(cc.desc)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const q = STATE.query.trim().toLowerCase();
    let filteredStages = stages;
    if (q) {
      filteredStages = stages.filter(s =>
        String(s.no) === q.replace('#', '') ||
        s.name.toLowerCase().includes(q) ||
        s.nerfs.some(n => n.toLowerCase().includes(q)) ||
        s.nerfTowers.some(t => t.toLowerCase().includes(q)) ||
        s.rewards.some(r => r.toLowerCase().includes(q))
      );
    } else if (rangeMode === 'milestone') {
      filteredStages = stages.filter(s => s.no === 1 || s.no === 5 || s.no % 10 === 0 || s.no === 1010);
    } else {
      const [sMin, sMax] = rangeMode.split('_').map(Number);
      filteredStages = stages.filter(s => s.no >= sMin && s.no <= sMax);
    }

    const selNo = Math.min(1010, Math.max(1, parseInt(STATE.filters.stages.selectedStage || 100, 10)));
    const curStage = stages.find(s => s.no === selNo) || stages[0] || {};
    const gradeLabels = ['일반', '레어', '유니크', '엘리트', '미스테리', '에픽', '전설', '신'];

    els.resultsCountBadge.textContent = `표시 ${filteredStages.length}개 / 전체 ${stages.length}스테이지`;
    els.activeFilterSummary.textContent = `선택된 스테이지: #${curStage.no} ${curStage.name}`;

    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="modal-section">
          <div class="modal-sec-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span>🗺️ 메인 스테이지(1 ~ 1,010) 상세 밸런스 · 드랍 확률 · 저주 조회기</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${[1, 50, 100, 200, 300, 500, 700, 900, 1010].map(n => `
                <button type="button" class="filter-chip ${selNo === n ? 'active' : ''}" data-jump-stage="${n}" style="padding:3px 9px;font-size:11.5px;">${n}스테이지</button>
              `).join('')}
            </div>
          </div>

          <div class="calc-grid" style="align-items:center;margin-bottom:14px;">
            <div class="calc-field">
              <label>스테이지 번호 입력 (1 ~ 1,010)</label>
              <input type="number" id="stageNumInput" class="ctrl-input" value="${curStage.no}" min="1" max="1010" />
            </div>
            <div class="calc-field" style="grid-column:span 3;">
              <label>스테이지 슬라이더 (좌우로 드래그하여 비교)</label>
              <input type="range" id="stageRangeSlider" min="1" max="1010" value="${curStage.no}" style="width:100%;accent-color:var(--accent-teal);cursor:pointer;" />
            </div>
          </div>

          <div id="stageDetailDashboard" style="padding:14px;border-radius:12px;background:var(--bg-elevated);border:1px solid var(--border-subtle);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
              <div>
                <span class="badge badge-legend" style="font-size:13px;">STAGE ${curStage.no}</span>
                <strong style="font-size:18px;margin-left:8px;">${escapeHtml(curStage.name)}</strong>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <span class="badge badge-tier-0">몬스터 체력 ×${escapeHtml(curStage.hpMult)}</span>
                <span class="badge badge-rare">몬스터 공격력 ×${escapeHtml(curStage.atkMult)}</span>
                <span class="badge badge-level">클리어 보석 +${(curStage.gold || 0).toLocaleString()} · 경험치 +${(curStage.exp || 0).toLocaleString()}</span>
                ${curStage.bossImmune ? `<span class="badge badge-awk">보스 제어 면역 ${curStage.bossImmune}%</span>` : ''}
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:12px;">
              <div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-subtle);">
                <div style="font-weight:800;font-size:12.5px;color:var(--text-secondary);margin-bottom:6px;">🎁 최초 클리어 웨이브 보상 (1·2·3단계)</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${(curStage.rewards || []).map((r, ri) => `<span class="badge badge-drop">${ri + 1}단계: <strong>${escapeHtml(r)}</strong></span>`).join('')}
                </div>
              </div>
              <div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-subtle);">
                <div style="font-weight:800;font-size:12.5px;color:var(--text-secondary);margin-bottom:6px;">☠️ 등장 저주 타워 & 저주 카드 (${curStage.nerfCnt || 0}개 부여)</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${(curStage.nerfTowers || []).map(nt => `<span class="badge badge-tier-0">🗼 시작 타워: ${escapeHtml(nt)}</span>`).join('')}
                  ${(curStage.nerfs || []).length
                    ? curStage.nerfs.map(nf => `<span class="badge">☠️ ${escapeHtml(nf)}</span>`).join('')
                    : '<span style="color:var(--text-muted);font-size:12px;">저주 없음</span>'}
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">
              <div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-subtle);">
                <div style="font-weight:800;font-size:12.5px;margin-bottom:6px;">⚔️ 스테이지 장비 드랍 등급 확률</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${(curStage.itemGrades || []).map((p, idx) => p > 0 ? `
                    <span class="badge" style="border-color:${GRADE_COLORS_8[idx]};color:${GRADE_COLORS_8[idx]};font-weight:800;">
                      ${gradeLabels[idx]} ${p}%
                    </span>
                  ` : '').join('')}
                </div>
              </div>
              <div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-subtle);">
                <div style="font-weight:800;font-size:12.5px;margin-bottom:6px;">🐾 스테이지 펫 드랍 등급 확률</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${(curStage.petGrades || []).map((p, idx) => p > 0 ? `
                    <span class="badge" style="border-color:${GRADE_COLORS_8[idx]};color:${GRADE_COLORS_8[idx]};font-weight:800;">
                      ${gradeLabels[idx]} ${p}%
                    </span>
                  ` : '').join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-sec-title">📊 스테이지 일람표 (행을 클릭하면 상단 상세 시뮬레이터에 즉시 표시됩니다)</h3>
          <div class="table-wrap">
            <table class="db-table">
              <thead>
                <tr>
                  <th style="width:75px;text-align:center;">스테이지</th>
                  <th style="width:145px;">맵 이름</th>
                  <th style="text-align:center;">몬스터 HP 배율</th>
                  <th style="text-align:center;">몬스터 공격력</th>
                  <th style="text-align:center;">클리어 보석/경험치</th>
                  <th>장비 드랍 확률 (일반~신)</th>
                  <th>펫 드랍 확률 (일반~신)</th>
                  <th>시작 저주타워 · 저주수</th>
                  <th>최초 클리어 보상</th>
                </tr>
              </thead>
              <tbody>
                ${filteredStages.map(s => `
                  <tr data-select-stage="${s.no}" style="cursor:pointer;${s.no === curStage.no ? 'background:rgba(20,184,166,0.12);' : ''}">
                    <td style="text-align:center;"><strong>#${s.no}</strong></td>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td style="text-align:center;color:var(--accent-amber);font-weight:700;">×${escapeHtml(s.hpMult)}</td>
                    <td style="text-align:center;">×${escapeHtml(s.atkMult)}</td>
                    <td style="text-align:center;font-size:12px;">💎${s.gold.toLocaleString()} / EXP ${s.exp.toLocaleString()}</td>
                    <td style="font-size:11.5px;">
                      ${s.itemGrades.map((p, idx) => p > 0 ? `<span style="color:${GRADE_COLORS_8[idx]};font-weight:700;margin-right:4px;">${gradeLabels[idx]}:${p}%</span>` : '').join('')}
                    </td>
                    <td style="font-size:11.5px;">
                      ${s.petGrades.map((p, idx) => p > 0 ? `<span style="color:${GRADE_COLORS_8[idx]};font-weight:700;margin-right:4px;">${gradeLabels[idx]}:${p}%</span>` : '').join('')}
                    </td>
                    <td style="font-size:12px;">
                      ${s.nerfTowers.length ? `<span class="badge badge-tier-0">${escapeHtml(s.nerfTowers.join(', '))}</span>` : ''}
                      ${s.nerfCnt > 0 ? `<span class="badge">저주 ${s.nerfCnt}</span>` : '-'}
                    </td>
                    <td style="font-size:11.5px;">${escapeHtml(s.rewards.join(' · '))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const setStageNo = (newNo) => {
      const clamped = Math.min(1010, Math.max(1, parseInt(newNo || 1, 10)));
      STATE.filters.stages.selectedStage = clamped;
      renderMainStageExplorer();
    };

    document.getElementById('stageNumInput')?.addEventListener('change', e => setStageNo(e.target.value));
    document.getElementById('stageRangeSlider')?.addEventListener('change', e => setStageNo(e.target.value));
    els.contentStage.querySelectorAll('[data-jump-stage]').forEach(btn => {
      btn.addEventListener('click', () => setStageNo(btn.getAttribute('data-jump-stage')));
    });
    els.contentStage.querySelectorAll('[data-select-stage]').forEach(row => {
      row.addEventListener('click', () => setStageNo(row.getAttribute('data-select-stage')));
    });
  }

  function renderDungeonBalanceStage() {
    const ss = DB.stagesAndShop || {};
    const dungeons = ss.dungeons || {};
    const did = STATE.filters.stages.dungeonId || '41';
    const dObj = dungeons[did] || Object.values(dungeons)[0];
    if (!dObj) return;

    const gradeLabels = ['일반', '레어', '유니크', '엘리트', '미스테리', '에픽', '전설', '신'];
    els.resultsCountBadge.textContent = `${dObj.steps.length}단계 (1~20단계)`;
    els.activeFilterSummary.textContent = dObj.desc;

    els.contentStage.innerHTML = `
      <div class="modal-section">
        <div class="modal-sec-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span>⛩️ ${escapeHtml(dObj.name)} — 단계별(1~20단계) 몬스터 배율 · 보상 · 드랍 확률표</span>
          <span class="badge badge-legend">공식 던전 밸런스 기준</span>
        </div>
        <div class="table-wrap">
          <table class="db-table">
            <thead>
              <tr>
                <th style="width:75px;text-align:center;">단계</th>
                <th style="text-align:center;">몬스터 HP 배율</th>
                <th style="text-align:center;">몬스터 공격력</th>
                <th style="text-align:center;">클리어 보상</th>
                <th style="text-align:center;">기본 보석/다이아/EXP</th>
                <th>장비 등급 확률 (일반~신)</th>
                <th>펫 등급 확률 (일반~신)</th>
                <th>유물 등급 확률</th>
              </tr>
            </thead>
            <tbody>
              ${dObj.steps.map(st => `
                <tr>
                  <td style="text-align:center;"><strong>${st.step}단계</strong></td>
                  <td style="text-align:center;color:var(--accent-amber);font-weight:700;">×${escapeHtml(String(Number(st.hpMult).toLocaleString()))}</td>
                  <td style="text-align:center;">×${escapeHtml(st.atkMult)}</td>
                  <td style="text-align:center;"><span class="badge badge-rare">🎁 ${escapeHtml(st.clearReward)}</span></td>
                  <td style="text-align:center;font-size:12px;">💎${st.gold} / 다이아 ${st.dia} / EXP ${st.exp}</td>
                  <td style="font-size:11.5px;">
                    ${st.itemGrades.map((p, idx) => p > 0 ? `<span style="color:${GRADE_COLORS_8[idx]};font-weight:700;margin-right:5px;">${gradeLabels[idx]}:${p}%</span>` : '').join('')}
                  </td>
                  <td style="font-size:11.5px;">
                    ${st.petGrades.map((p, idx) => p > 0 ? `<span style="color:${GRADE_COLORS_8[idx]};font-weight:700;margin-right:5px;">${gradeLabels[idx]}:${p}%</span>` : '').join('')}
                  </td>
                  <td style="font-size:11.5px;">
                    ${st.relicGrades.map((p, idx) => p > 0 ? `<span style="color:${GRADE_COLORS_8[idx]};font-weight:700;margin-right:5px;">${gradeLabels[idx]}:${p}%</span>` : '').join('')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderGrowthCalculatorStage() {
    const costs = (DB.growth && DB.growth.heroTowerCosts) || [];
    els.contentStage.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="modal-section">
          <h3 class="modal-sec-title">🧮 공식 장비 주옵션 & 각성 시뮬레이터</h3>
          <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">
            공식 수식: <code>q = 0.9 + 0.2*(품질/100)</code>, <code>s = q * (등급기본 + 레벨당증가*(레벨-1))</code> (반지는 <code>s*0.3</code>, 신등급 각성 보너스 0~400% 적용)
          </p>
          <div class="calc-grid">
            <div class="calc-field">
              <label>장비 부위/종류</label>
              <select id="simPart" class="ctrl-select">
                <option value="weapon_4">주 무기 (무기 공격력%)</option>
                <option value="sub_10">보조 무기 - 영웅 체력% (기본/생존)</option>
                <option value="sub_1">보조 무기 - 모든 타워 공격력% (타워 빌드)</option>
                <option value="sub_3">보조 무기 - 모든 공격력% (딜러 빌드)</option>
                <option value="helmet_10">투구 (영웅 체력%)</option>
                <option value="ring_3">반지 (모든 공격력% × 0.3)</option>
                <option value="other_1">가방/기타 (모든 타워 공격력%)</option>
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
          <h3 class="modal-sec-title">📊 영웅 · 타워 레벨업 필요 조각 수</h3>
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

      const [partCat, statCode] = partVal.split('_');
      const dummyItem = {
        cat: partCat === 'weapon' ? 'weapon' : (partCat === 'ring' ? 'ring' : (partCat === 'sub' ? 'sub' : 'etc')),
        basicStat: {
          statCode: statCode,
          isRing: partCat === 'ring',
        },
        weaponSpecs: partCat === 'weapon' ? { atk: 50 } : null,
      };
      const res = calculateItemMainStat(dummyItem, gradeIdx, lv, qualityPct, awkLv, statCode);
      const box = document.getElementById('simResultBox');
      if (box) {
        box.innerHTML = `
          <div>
            <div style="font-size:12px;color:var(--text-muted);">${res.statName} · 품질 ${(qualityPct).toFixed(1)}% (난수 ${rand}) · 각성 보너스 +${res.bonus}%</div>
            <div style="font-weight:700;font-size:13.5px;">${res.statName}: <span style="color:var(--accent-primary);">+${res.mainPct.toLocaleString()}%</span></div>
            ${res.weaponFinalAtk ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">🗡️ 무기 최종 공격력: <strong>${res.weaponFinalAtk.toLocaleString()}</strong> (가상 기본공 50 기준)</div>` : ''}
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
  // Detail Modal / Mobile Bottom Sheet
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
    } else if (tab === 'stages') {
      entry = ((DB.stagesAndShop && DB.stagesAndShop.shopPackages) || []).find(x => x.id === id);
    }

    if (!entry) return;

    const isSkin = entry._kind === 'skin' || String(entry.id).startsWith('skin_');
    const usageStr = Array.isArray(entry.usage) ? entry.usage.join('/') : String(entry.usage || '').trim();

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
            ${entry.weaponCategory ? `<span class="badge badge-level">${escapeHtml(entry.weaponCategory)}</span>` : ''}
            ${entry.rangeVal !== null && entry.rangeVal !== undefined
              ? `<span class="badge badge-rare" title="${escapeHtml(entry.attackType || '')}">사거리 ${entry.rangeVal} (${escapeHtml(entry.range || '')})</span>`
              : (entry.range ? `<span class="badge">${escapeHtml(entry.range)}</span>` : '')}
            ${entry.attackType ? `<span class="badge">${escapeHtml(entry.attackType)}</span>` : ''}
            ${entry.grade ? `<span class="badge ${tierBadgeClass(entry.grade)}">${escapeHtml(entry.grade)}</span>` : ''}
            ${entry.tier ? `<span class="badge ${tierBadgeClass(entry.tier)}">${escapeHtml(entry.tier)}</span>` : ''}
            ${entry.recommend ? `<span class="badge ${tierBadgeClass(entry.recommend)}">추천 ${escapeHtml(entry.recommend)}</span>` : ''}
            ${entry.heroName ? `<span class="badge badge-level">${escapeHtml(entry.heroName)} 전용</span>` : ''}
            ${entry.purchaseType ? `<span class="badge">${escapeHtml(entry.purchaseType)}</span>` : ''}
            ${usageStr ? `<span class="badge ${tierBadgeClass(usageStr)}">사용 ${escapeHtml(usageStr)}</span>` : ''}
            ${entry.level ? `<span class="badge badge-level">${escapeHtml(entry.level)}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    let bodyHtml = '';

    if (tab === 'items') {
      const isSubWeapon = entry.cat === 'sub' || (entry.basicStat && entry.basicStat.options && entry.basicStat.options.length > 1);
      const awkLevels = [0, 1, 2, 3, 4, 5];
      bodyHtml += `
        ${renderCardComment(entry.comment, '유저 코멘트: ')}
        <div class="modal-section">
          <div class="modal-sec-title">
            <span>🌟 공식 0성 ~ 5성 각성 단계별 옵션 비교</span>
            <span style="font-size:11.5px;color:var(--text-muted);">신(Grade 7) 등급에서 각성 가능</span>
          </div>
          <div class="table-wrap">
            <table class="db-table" style="min-width:100%;">
              <thead><tr><th style="width:85px;">각성 단계</th><th>주옵션 배율</th><th>적용 효과</th></tr></thead>
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
            <span>🧮 ${isSubWeapon ? '보조무기 3대 주옵션 & 최상급 수치 계산기' : `이 장비의 주옵션(${escapeHtml(entry.basicStat?.name || '공격력')}) 계산기`}</span>
          </div>

          ${isSubWeapon ? `
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">
                🎲 보조무기 주옵션 선택 (인게임 드랍/제작 시 3종 중 1개 무작위 부여):
              </label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="ctrl-btn active" data-sub-stat="10" id="btnSubStat10">💚 영웅 체력 (기본/생존)</button>
                <button type="button" class="ctrl-btn" data-sub-stat="1" id="btnSubStat1">🏰 모든 타워 공격력 (타워 빌드)</button>
                <button type="button" class="ctrl-btn" data-sub-stat="3" id="btnSubStat3">⚔️ 모든 공격력 (딜러 빌드)</button>
              </div>
            </div>
          ` : ''}

          <div class="calc-grid">
            <div class="calc-field">
              <label>등급</label>
              <select id="mCalcGrade" class="ctrl-select">
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
              <input type="number" id="mCalcLv" class="ctrl-input" value="200" min="1" max="400" />
            </div>
            <div class="calc-field">
              <label>각성 (신등급 전용 0~5성)</label>
              <select id="mCalcAwk" class="ctrl-select">
                <option value="0">0성 (보너스 0%)</option>
                <option value="1">1성 (+50%)</option>
                <option value="2">2성 (+120%)</option>
                <option value="3">3성 (+200%)</option>
                <option value="4">4성 (+300%)</option>
                <option value="5" selected>★5성 (+400%)</option>
              </select>
            </div>
            <div class="calc-field">
              <label>품질 (90.2% ~ 110.0%)</label>
              <div style="display:flex;gap:6px;align-items:center;">
                <input type="number" id="mCalcQuality" class="ctrl-input" value="110" min="90.2" max="110" step="0.1" style="width:80px;" />
                <span style="font-size:12px;color:var(--text-muted);">%</span>
              </div>
              <div class="quality-quick-btns">
                <button type="button" class="quality-quick-btn active" data-q="110">최상급 110%</button>
                <button type="button" class="quality-quick-btn" data-q="105">상급 105%</button>
                <button type="button" class="quality-quick-btn" data-q="100">기본 100%</button>
                <button type="button" class="quality-quick-btn" data-q="90.2">최하급 90.2%</button>
              </div>
            </div>
          </div>

          <div class="calc-result-box" id="mCalcResult" style="margin-top:10px;"></div>

          ${isSubWeapon ? `
            <div style="margin-top:14px;">
              <div style="font-size:12px;font-weight:800;color:var(--text-muted);margin-bottom:6px;">📊 보조무기 3대 옵션 동시 비교표 (클릭 시 선택 변경):</div>
              <div class="sub-weapon-all-stats-grid" id="mCalcSubGrid"></div>
            </div>
          ` : ''}

          <div class="calc-formula-breakdown" id="mCalcFormula"></div>
        </div>

        <div class="modal-section">
          <div class="modal-sec-title">📍 획득처 및 부가 정보</div>
          ${entry.weaponCategory || entry.rangeVal !== null ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              ${entry.weaponCategory ? `<span class="badge badge-level">분류: ${escapeHtml(entry.weaponCategory)}</span>` : ''}
              ${entry.rangeVal !== null && entry.rangeVal !== undefined ? `<span class="badge badge-rare">공식 사거리: ${entry.rangeVal}</span>` : ''}
              ${entry.attackType ? `<span class="badge">공격 유형: ${escapeHtml(entry.attackType)}</span>` : ''}
              ${entry.weaponSpecs ? `<span class="badge">기본 공격력: ${entry.weaponSpecs.atk} · 공속: ${entry.weaponSpecs.aspd}</span>` : ''}
            </div>
          ` : ''}
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
        ${renderCardComment(entry.comment)}
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
                    ${sk.comment ? `<div style="font-size:11.5px;color:var(--accent-amber);margin-top:4px;display:flex;align-items:flex-start;gap:4px;">${COMMENT_ICON_HTML}<span>${escapeHtml(sk.comment)}</span></div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    } else if (tab === 'heroes' && String(entry.id).startsWith('skin_')) {
      bodyHtml += `
        ${renderCardComment(entry.comment)}
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
        ${renderCardComment(entry.comment)}
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
        ${renderCardComment(entry.comment)}
        <div class="modal-section">
          <div class="modal-sec-title">
            <span>🏰 타워 기본 설명 및 스펙</span>
            <button type="button" class="btn-primary" id="openTowerInSimBtn" style="padding:4px 10px;font-size:11.5px;">🔥 배치 시뮬레이터에서 놓아보기</button>
          </div>
          <p style="margin-bottom:8px;">${escapeHtml(entry.ability)}</p>
          <div class="card-badges">
            <span class="badge">기본 공격력 ${entry.specs?.atk}</span>
            <span class="badge">공격속도 ${entry.specs?.aspd}</span>
            <span class="badge">사거리 ${entry.specs?.range}</span>
            <span class="badge">타일크기 ${entry.specs?.tileW || 2}×${entry.specs?.tileH || 2} (${entry.specs?.tileCnt || 4}칸)</span>
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
    } else if (tab === 'stages') {
      bodyHtml += `
        <div class="modal-section">
          <div class="modal-sec-title">🛒 상점 패키지 상세 구성 (#${entry.officialId})</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <span class="badge badge-rare">분류: ${escapeHtml(entry.category)}</span>
            <span class="badge badge-legend">가격: ${escapeHtml(entry.priceText)}${entry.usd ? ` ($${escapeHtml(entry.usd)})` : ''}</span>
            ${entry.packValue ? `<span class="badge badge-tier-0">🔥 효율: ${escapeHtml(entry.packValue)}</span>` : ''}
            ${entry.limit ? `<span class="badge">구매 제한: ${escapeHtml(entry.limit)}회</span>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${(entry.rewards && entry.rewards.length)
              ? entry.rewards.map((r, idx) => `
                  <div style="padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-subtle);display:flex;align-items:center;gap:10px;">
                    <span class="badge badge-level">보상 ${idx + 1}</span>
                    <strong style="font-size:14px;">🎁 ${escapeHtml(r)}</strong>
                  </div>
                `).join('')
              : `<div style="color:var(--text-muted);">• 인게임 패스/기능 해금 상품입니다.</div>`}
          </div>
        </div>
      `;
    } else {
      bodyHtml += `
        ${renderCardComment(entry.comment)}
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
    setModalLock(true);

    document.getElementById('openTowerInSimBtn')?.addEventListener('click', () => {
      closeAllModals();
      switchTab('simulator');
    });

    if (tab === 'items') {
      const isSubWeapon = entry.cat === 'sub' || (entry.basicStat && entry.basicStat.options && entry.basicStat.options.length > 1);
      let currentSubStat = '10';

      const updateModalCalc = () => {
        const g = parseInt(document.getElementById('mCalcGrade')?.value || '7', 10);
        const lv = parseInt(document.getElementById('mCalcLv')?.value || '200', 10);
        const awk = parseInt(document.getElementById('mCalcAwk')?.value || '5', 10);
        const qVal = parseFloat(document.getElementById('mCalcQuality')?.value || '110');

        const activeStatCode = isSubWeapon ? currentSubStat : (entry.basicStat?.statCode || '4');
        const res = calculateItemMainStat(entry, g, lv, qVal, awk, activeStatCode);

        if (isSubWeapon) {
          ['10', '1', '3'].forEach(code => {
            const btn = document.getElementById(`btnSubStat${code}`);
            if (btn) btn.classList.toggle('active', code === currentSubStat);
          });

          const gridBox = document.getElementById('mCalcSubGrid');
          if (gridBox) {
            const statDefs = [
              { code: '10', icon: '💚', name: '영웅 체력' },
              { code: '1', icon: '🏰', name: '모든 타워 공격력' },
              { code: '3', icon: '⚔️', name: '모든 공격력' },
            ];
            gridBox.innerHTML = statDefs.map(def => {
              const curRes = calculateItemMainStat(entry, g, lv, qVal, awk, def.code);
              const minRes = calculateItemMainStat(entry, g, lv, 90.2, awk, def.code);
              const maxRes = calculateItemMainStat(entry, g, lv, 110, awk, def.code);
              const isActive = def.code === currentSubStat;
              return `
                <div class="sub-stat-card ${isActive ? 'active' : ''}" data-sub-stat-card="${def.code}">
                  <div class="sub-stat-title">${def.icon} ${def.name} ${isActive ? '★선택중' : ''}</div>
                  <div class="sub-stat-val">+${curRes.mainPct.toLocaleString()}%</div>
                  <div class="sub-stat-range">품질범위: +${minRes.mainPct.toLocaleString()}% ~ +${maxRes.mainPct.toLocaleString()}%</div>
                </div>
              `;
            }).join('');

            gridBox.querySelectorAll('[data-sub-stat-card]').forEach(card => {
              card.addEventListener('click', () => {
                currentSubStat = card.getAttribute('data-sub-stat-card');
                updateModalCalc();
              });
            });
          }
        }

        const box = document.getElementById('mCalcResult');
        if (box) {
          box.innerHTML = `
            <div>
              <div style="font-size:12px;color:var(--text-muted);">${escapeHtml(res.statName)} · 품질 ${qVal.toFixed(1)}% 기준 · 각성 보너스 +${res.bonus}%</div>
              <div style="font-size:14px;font-weight:700;">
                ${escapeHtml(res.statName)}: <span style="color:var(--accent-primary);">+${res.mainPct.toLocaleString()}%</span>
              </div>
              ${res.weaponFinalAtk ? `
                <div style="font-size:12.5px;margin-top:2px;">
                  🗡️ 무기 최종 공격력: <strong style="color:var(--accent-amber);">${res.weaponFinalAtk.toLocaleString()}</strong> (기본 공격력 ${entry.weaponSpecs.atk})
                </div>
              ` : ''}
            </div>
            <div class="calc-result-val">+${res.mainPct.toLocaleString()}%</div>
          `;
        }

        const fBox = document.getElementById('mCalcFormula');
        if (fBox) {
          fBox.innerHTML = `
            <div style="font-weight:700;margin-bottom:4px;color:var(--accent-primary);">📐 공식 산출 과정 (${escapeHtml(res.statName)})</div>
            <div>• <strong>1단계 (레벨 기본치):</strong> 기본 <code>${res.basic}</code> + 레벨성장 <code>${res.lvUp} × (${res.effLv} - 1)</code> = <strong>${res.baseVal.toLocaleString()}</strong>${res.isRing ? ' (반지 계수 ×0.3 적용)' : ''}</div>
            <div>• <strong>2단계 (품질 난수):</strong> <code>${res.baseVal.toLocaleString()} × ${(qVal / 100).toFixed(3)}</code> = <strong>${Math.round(res.baseVal * res.q).toLocaleString()}%</strong></div>
            <div>• <strong>3단계 (신등급 각성):</strong> ${res.bonus > 0 ? `신등급 각성 보너스 <code>+${res.bonus}%</code> 적용 → <strong>+${res.mainPct.toLocaleString()}%</strong>` : '신등급 각성 보너스 없음 (0%)'}</div>
            ${res.weaponFinalAtk ? `<div>• <strong>4단계 (무기 최종 공격력):</strong> <code>Round(${entry.weaponSpecs.atk} × (1 + ${res.mainPct} / 100))</code> = <strong style="color:var(--accent-amber);">${res.weaponFinalAtk.toLocaleString()}</strong></div>` : ''}
          `;
        }
      };

      document.querySelectorAll('.quality-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.quality-quick-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const q = btn.getAttribute('data-q');
          const qInput = document.getElementById('mCalcQuality');
          if (qInput) qInput.value = q;
          updateModalCalc();
        });
      });

      if (isSubWeapon) {
        ['10', '1', '3'].forEach(code => {
          document.getElementById(`btnSubStat${code}`)?.addEventListener('click', () => {
            currentSubStat = code;
            updateModalCalc();
          });
        });
      }

      ['mCalcGrade', 'mCalcLv', 'mCalcAwk', 'mCalcQuality'].forEach(cid => {
        document.getElementById(cid)?.addEventListener('input', () => {
          if (cid === 'mCalcQuality') {
            const curVal = document.getElementById('mCalcQuality')?.value;
            document.querySelectorAll('.quality-quick-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-q') === curVal);
            });
          }
          updateModalCalc();
        });
        document.getElementById(cid)?.addEventListener('change', updateModalCalc);
      });
      updateModalCalc();
    }
  }

  // =========================================================================
  // In-Game Patch Notes Modal (Google Sheet '패치노트' Tab Live Sync)
  // =========================================================================
  const PATCH_SEEN_STORAGE_KEY = 'ara_db_v3_seen_patch_sig_v1';

  const DEFAULT_PATCH_NOTES = [
    {
      id: 'default_1',
      version: '최신 업데이트',
      date: '2026-11-15',
      category: '신규 출시',
      title: '신규 영웅 · 스킨 · 타워 · 펫 데이터 반영',
      content: '인게임 최신 버전 기준 영웅(35종), 영웅 스킨(74종), 타워(46종), 탈것(57종), 펫(26종), 야영지(55종) 마스터 데이터가 반영되었습니다.\n구글 마스터 시트에 [패치노트] 탭을 추가하면 인게임 패치 내역이 이곳에 실시간으로 표시됩니다.',
      pinned: true,
    },
  ];

  const patchFilterState = {
    category: 'all',
    query: '',
  };

  function getPatchNotesList() {
    if (Array.isArray(DB.patchNotes) && DB.patchNotes.length > 0) {
      return DB.patchNotes;
    }
    return DEFAULT_PATCH_NOTES;
  }

  function getPatchSignature(notes) {
    if (!notes || !notes.length) return '';
    const first = notes[0];
    return `${first.version || ''}|${first.date || ''}|${first.title || ''}|${notes.length}`;
  }

  function updatePatchNewBadge() {
    if (!els.patchNewBadge) return;
    const notes = getPatchNotesList();
    if (!Array.isArray(DB.patchNotes) || DB.patchNotes.length === 0) {
      els.patchNewBadge.hidden = true;
      return;
    }
    const sig = getPatchSignature(notes);
    let seenSig = '';
    try {
      seenSig = localStorage.getItem(PATCH_SEEN_STORAGE_KEY) || '';
    } catch (e) {}
    els.patchNewBadge.hidden = !sig || sig === seenSig;
  }

  function patchCatBadgeClass(catStr) {
    const s = String(catStr || '').trim();
    if (/신규|출시|추가|영웅|타워|스킨|장비|펫|탈것/.test(s)) return 'patch-cat-new';
    if (/밸런스|상향|하향|조정|리워크|너프|버프/.test(s)) return 'patch-cat-balance';
    if (/컨텐츠|콘텐츠|던전|스테이지|길드|보스/.test(s)) return 'patch-cat-content';
    if (/이벤트|보상|출석|패스|패키지/.test(s)) return 'patch-cat-event';
    if (/버그|수정|오류|개선|편의|최적화|시스템/.test(s)) return 'patch-cat-fix';
    return 'patch-cat-default';
  }

  function highlightPatchNumbers(text) {
    let out = escapeHtml(text);
    // +숫자% 또는 +숫자%p
    out = out.replace(/(\+\d+(?:\.\d+)?(?:%p?|배|점|개|회|마리|단계)?)/g, '<strong class="patch-val-up">$1</strong>');
    // -숫자% 또는 감소
    out = out.replace(/((?:-|▲|▼)\d+(?:\.\d+)?(?:%p?|배|점|개|회)?)/g, '<strong class="patch-val-down">$1</strong>');
    // A에서 B로 단축 / 변경
    out = out.replace(/(\d+회?에서\s*\d+회?로\s*(?:단축|감소|증가|확장|개편))/g, '<strong class="patch-val-change">$1</strong>');
    // 괄호 보조 설명
    out = out.replace(/(\([^)]+\))/g, '<span class="patch-sub-note">$1</span>');
    return out;
  }

  function formatPatchContentLines(rawContent) {
    const rawLines = String(rawContent || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (!rawLines.length) return '';

    return `
      <div class="patch-content-blocks">
        ${rawLines.map(line => {
          const clean = line.replace(/^[-•*·]\s*/, '').trim();

          // 1) Lv.X 또는 Lv.X~Y 패턴 (인게임 특성 / 스킬)
          const lvMatch = clean.match(/^(Lv\.?\s*[\d~]+(?:Lv)?)(?:\s*[:：]?\s*)(.*)$/i);
          if (lvMatch) {
            const lvBadge = lvMatch[1].replace(/\s+/g, '');
            const rest = lvMatch[2];
            const subKeyMatch = rest.match(/^([^:：\n]{2,16}?)\s*[:：]\s*(.*)$/);
            if (subKeyMatch) {
              return `
                <div class="patch-stat-row">
                  <div class="patch-stat-left">
                    <span class="patch-lv-badge">${escapeHtml(lvBadge)}</span>
                    <strong class="patch-stat-label">${escapeHtml(subKeyMatch[1])}</strong>
                  </div>
                  <div class="patch-stat-val">${highlightPatchNumbers(subKeyMatch[2])}</div>
                </div>
              `;
            }
            return `
              <div class="patch-stat-row">
                <div class="patch-stat-left">
                  <span class="patch-lv-badge">${escapeHtml(lvBadge)}</span>
                </div>
                <div class="patch-stat-val">${highlightPatchNumbers(rest)}</div>
              </div>
            `;
          }

          // 2) 일반 키: 값 패턴 (예: "공격력 증가: ...", "순위 결정: ...")
          const kvMatch = clean.match(/^([^:：\n]{2,16}?)\s*[:：]\s*(.*)$/);
          if (kvMatch) {
            return `
              <div class="patch-stat-row patch-kv-row">
                <div class="patch-stat-left">
                  <span class="patch-spec-chip">${escapeHtml(kvMatch[1])}</span>
                </div>
                <div class="patch-stat-val">${highlightPatchNumbers(kvMatch[2])}</div>
              </div>
            `;
          }

          // 3) 단순 설명/문장
          return `
            <div class="patch-desc-row">
              <span class="patch-bullet-dot">▸</span>
              <div class="patch-desc-text">${highlightPatchNumbers(clean)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPatchNoteModal() {
    if (!els.patchModalBody || !els.patchCategoryPills) return;
    const allNotes = getPatchNotesList();
    const isCustomSheetLoaded = Array.isArray(DB.patchNotes) && DB.patchNotes.length > 0;

    // Build category count map
    const catCounts = new Map();
    allNotes.forEach(n => {
      const c = String(n.category || '업데이트').trim();
      catCounts.set(c, (catCounts.get(c) || 0) + 1);
    });

    if (patchFilterState.category !== 'all' && !catCounts.has(patchFilterState.category)) {
      patchFilterState.category = 'all';
    }

    let pillsHtml = `
      <button type="button" class="patch-cat-pill ${patchFilterState.category === 'all' ? 'active' : ''}" data-patch-cat="all">
        전체 <span class="patch-pill-cnt">${allNotes.length}</span>
      </button>
    `;
    catCounts.forEach((cnt, catName) => {
      const isAct = patchFilterState.category === catName;
      pillsHtml += `
        <button type="button" class="patch-cat-pill ${isAct ? 'active' : ''}" data-patch-cat="${escapeHtml(catName)}">
          ${escapeHtml(catName)} <span class="patch-pill-cnt">${cnt}</span>
        </button>
      `;
    });
    els.patchCategoryPills.innerHTML = pillsHtml;

    // Filter notes by category & search query
    const q = patchFilterState.query.trim().toLowerCase();
    const filtered = allNotes.filter(n => {
      if (patchFilterState.category !== 'all' && String(n.category || '업데이트').trim() !== patchFilterState.category) {
        return false;
      }
      if (q) {
        const hay = `${n.version || ''} ${n.date || ''} ${n.category || ''} ${n.title || ''} ${n.content || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      els.patchModalBody.innerHTML = `
        <div class="empty-state" style="padding:36px 16px;">
          <div style="font-size:32px;margin-bottom:8px;">🔍</div>
          <div>조건에 맞는 인게임 패치노트 내역이 없습니다.</div>
        </div>
      `;
      return;
    }

    // Group filtered items by (version + date)
    const groupMap = new Map();
    filtered.forEach(item => {
      const gKey = `${item.version || '업데이트'}__${item.date || ''}`;
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          version: item.version || '인게임 업데이트',
          date: item.date || '',
          pinned: Boolean(item.pinned),
          items: [],
        });
      }
      const g = groupMap.get(gKey);
      if (item.pinned) g.pinned = true;
      g.items.push(item);
    });

    const groups = Array.from(groupMap.values());
    // Sort pinned groups first while keeping sheet order
    groups.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    let bodyHtml = `
      <div class="patch-timeline-wrap">
        ${groups.map((g, idx) => {
          const isLatest = idx === 0 && patchFilterState.category === 'all' && !q;
          return `
            <article class="patch-version-card ${g.pinned ? 'is-pinned' : ''} ${isLatest ? 'is-latest' : ''}">
              <div class="patch-version-header">
                <div class="patch-version-title-row">
                  ${g.pinned ? `<span class="patch-pin-badge">📌 중요</span>` : ''}
                  ${isLatest ? `<span class="patch-latest-badge">LATEST</span>` : ''}
                  <h3 class="patch-version-title">${escapeHtml(g.version)}</h3>
                </div>
                <div class="patch-version-meta">
                  ${g.date ? `<span class="patch-date-badge">📅 ${escapeHtml(g.date)}</span>` : ''}
                  <span class="patch-count-badge">${g.items.length}개 항목</span>
                </div>
              </div>
              <div class="patch-version-items">
                ${g.items.map(it => {
                  const rawTitle = String(it.title || '').trim();
                  // 앞머리 이모지 및 순번(1. 2. 등) 추출
                  const emojiMatch = rawTitle.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u2600-\u27BF])\s*(.*)$/u);
                  let iconAvatar = '';
                  let cleanTitle = rawTitle;
                  if (emojiMatch) {
                    iconAvatar = emojiMatch[1];
                    cleanTitle = emojiMatch[2].replace(/^\d+[\.\)]\s*/, '');
                  } else {
                    cleanTitle = rawTitle.replace(/^\d+[\.\)]\s*/, '');
                  }

                  return `
                    <div class="patch-entry-row">
                      <div class="patch-entry-head">
                        ${iconAvatar ? `<div class="patch-entry-avatar">${iconAvatar}</div>` : ''}
                        <div class="patch-entry-title-wrap">
                          <div class="patch-entry-tags">
                            <span class="patch-cat-badge ${patchCatBadgeClass(it.category)}">${escapeHtml(it.category || '업데이트')}</span>
                          </div>
                          ${cleanTitle ? `<h4 class="patch-entry-title">${escapeHtml(cleanTitle)}</h4>` : ''}
                        </div>
                      </div>
                      ${it.content ? `<div class="patch-entry-body">${formatPatchContentLines(it.content)}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    if (!isCustomSheetLoaded) {
      bodyHtml += `
        <div class="patch-sheet-tip-box">
          <div style="font-weight:800;margin-bottom:4px;color:var(--accent-primary);">💡 구글 마스터 시트 연동 안내</div>
          <div>현재 마스터 시트에 <strong><code>패치노트</code></strong> 탭을 추가하고 <code>버전 | 날짜 | 구분 | 제목 | 내용 | 고정</code> 열을 입력하시면, 재배포 없이 인게임 업데이트 내역이 실시간으로 반영됩니다.</div>
        </div>
      `;
    }

    els.patchModalBody.innerHTML = bodyHtml;
  }

  function openPatchNoteModal() {
    if (!els.patchNoteBackdrop) return;
    closeAllModals();
    els.patchNoteBackdrop.hidden = false;
    setModalLock(true);

    // Mark current patch notes as seen
    const notes = getPatchNotesList();
    const sig = getPatchSignature(notes);
    if (sig && Array.isArray(DB.patchNotes) && DB.patchNotes.length > 0) {
      try {
        localStorage.setItem(PATCH_SEEN_STORAGE_KEY, sig);
      } catch (e) {}
    }
    if (els.patchNewBadge) els.patchNewBadge.hidden = true;

    renderPatchNoteModal();
  }

  // =========================================================================
  // Event Bindings & Initialization
  // =========================================================================
  function switchTab(newTab) {
    if (newTab === 'farming') newTab = 'items';
    if (!TAB_TITLES[newTab]) return;
    STATE.tab = newTab;
    STATE.mobileFilterOpen = false;

    document.querySelectorAll('.primary-nav [data-tab]').forEach(btn => {
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
      if (STATE.tab === 'simulator' || STATE.tab === 'farming' || STATE.tab === 'growth') {
        if (STATE.query.trim()) {
          switchTab('items');
          return;
        }
      }
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

    // Header simulator shortcut button (legacy fallback)
    els.headerSimBtn?.addEventListener('click', () => {
      switchTab('simulator');
    });

    // Header In-Game Patch Notes button
    els.headerPatchBtn?.addEventListener('click', () => {
      openPatchNoteModal();
    });

    els.closePatchModalBtn?.addEventListener('click', closeAllModals);
    els.patchNoteBackdrop?.addEventListener('click', e => {
      if (e.target === els.patchNoteBackdrop) closeAllModals();
    });

    let patchTouchStartY = 0;
    els.patchModalDragHandle?.addEventListener('touchstart', e => {
      patchTouchStartY = e.touches[0]?.clientY || 0;
    }, { passive: true });
    els.patchModalDragHandle?.addEventListener('touchend', e => {
      const endY = e.changedTouches[0]?.clientY || 0;
      if (endY - patchTouchStartY > 45) closeAllModals();
    }, { passive: true });

    els.patchSearchInput?.addEventListener('input', e => {
      patchFilterState.query = e.target.value || '';
      renderPatchNoteModal();
    });

    els.patchCategoryPills?.addEventListener('click', e => {
      const btn = e.target.closest('[data-patch-cat]');
      if (!btn) return;
      patchFilterState.category = btn.getAttribute('data-patch-cat') || 'all';
      renderPatchNoteModal();
    });

    els.refreshPatchNotesBtn?.addEventListener('click', async () => {
      if (!SheetsSync || !SheetsSync.syncPatchNotesOnly) return;
      const origHtml = els.refreshPatchNotesBtn.innerHTML;
      els.refreshPatchNotesBtn.disabled = true;
      els.refreshPatchNotesBtn.innerHTML = '<span>⏳ 동기화중…</span>';
      try {
        const res = await SheetsSync.syncPatchNotesOnly(DB);
        if (res && res.ok) {
          renderPatchNoteModal();
          els.refreshPatchNotesBtn.innerHTML = '<span>✅ 최신화됨</span>';
        } else {
          els.refreshPatchNotesBtn.innerHTML = '<span>⚠️ 시트 확인</span>';
        }
      } catch (e) {
        els.refreshPatchNotesBtn.innerHTML = '<span>⚠️ 오류</span>';
      }
      setTimeout(() => {
        if (els.refreshPatchNotesBtn) {
          els.refreshPatchNotesBtn.disabled = false;
          els.refreshPatchNotesBtn.innerHTML = origHtml;
        }
      }, 1500);
    });

    // Primary Desktop Nav
    els.primaryNav.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });

    // Mobile 5-Group Bottom Nav
    els.mobileBottomNav.addEventListener('click', e => {
      const btn = e.target.closest('[data-mgroup]');
      if (!btn) return;
      const gKey = btn.getAttribute('data-mgroup');
      const defTab = btn.getAttribute('data-default-tab');
      const gObj = MOBILE_GROUPS[gKey];
      if (!gObj) return;
      // If already in this group, cycle to next sub-tab in group; otherwise open default tab
      const curIdx = gObj.tabs.findIndex(t => t.tab === STATE.tab);
      if (curIdx >= 0 && gObj.tabs.length > 1) {
        const nextTab = gObj.tabs[(curIdx + 1) % gObj.tabs.length].tab;
        switchTab(nextTab);
      } else {
        switchTab(defTab || gObj.tabs[0].tab);
      }
    });

    // Mobile Sub-Nav Bar
    els.mobileSubnavBar?.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });

    // Mobile Filter Collapse Toggle
    els.mobileFilterToggleBtn?.addEventListener('click', () => {
      STATE.mobileFilterOpen = !STATE.mobileFilterOpen;
      updateMobileFilterBadge();
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

    els.closeDetailModalBtn.addEventListener('click', closeAllModals);
    els.detailModalBackdrop.addEventListener('click', e => {
      if (e.target === els.detailModalBackdrop) closeAllModals();
    });

    // Touch swipe-down on mobile bottom-sheet drag handle to close modal
    let touchStartY = 0;
    els.detailModalDragHandle?.addEventListener('touchstart', e => {
      touchStartY = e.touches[0]?.clientY || 0;
    }, { passive: true });
    els.detailModalDragHandle?.addEventListener('touchend', e => {
      const endY = e.changedTouches[0]?.clientY || 0;
      if (endY - touchStartY > 45) closeAllModals();
    }, { passive: true });

    // Google Sheet Modal
    els.openSheetModalBtn.addEventListener('click', () => {
      els.sheetIdInput.value = SheetsSync.getActiveSheetId();
      els.sheetSyncLog.textContent = '';
      els.sheetConfigBackdrop.hidden = false;
      setModalLock(true);
    });
    els.closeSheetModalBtn.addEventListener('click', closeAllModals);
    els.sheetConfigBackdrop.addEventListener('click', e => {
      if (e.target === els.sheetConfigBackdrop) closeAllModals();
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
      els.sheetSyncLog.textContent = '기본 마스터 DB V3 시트 ID로 복원되었습니다.';
    });

    // Theme toggle
    els.themeToggleBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      els.themeIcon.textContent = next === 'light' ? '☀️' : '🌙';
      try { localStorage.setItem('ara_db_v3_theme', next); } catch (e) {}
    });

    // Brand Home reset
    els.brandHomeBtn.addEventListener('click', () => {
      STATE.query = '';
      els.searchInput.value = '';
      els.clearSearchBtn.hidden = true;
      switchTab('items');
    });

    // URL Hash (#sim=...) listener for shared Daily Dungeon layouts
    window.addEventListener('hashchange', () => {
      if (Simulator && Simulator.checkUrlHashAndLoad()) {
        switchTab('simulator');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAllModals();
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
      const savedTheme = localStorage.getItem('ara_db_v3_theme') || localStorage.getItem('ara_db_v2_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', savedTheme);
        els.themeIcon.textContent = savedTheme === 'light' ? '☀️' : '🌙';
      }
    } catch (e) {}

    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-view') === STATE.viewMode);
    });

    bindEvents();
    updatePatchNewBadge();

    // If URL has a shared layout (#sim=...), open simulator tab automatically
    if (Simulator && Simulator.checkUrlHashAndLoad()) {
      switchTab('simulator');
    } else {
      renderStage();
    }

    // Trigger live Google Sheets sync in background
    if (SheetsSync) {
      SheetsSync.syncFromGoogleSheets(DB, updateSyncBadge).then(res => {
        updatePatchNewBadge();
        if (els.patchNoteBackdrop && !els.patchNoteBackdrop.hidden) {
          renderPatchNoteModal();
        }
        if (res && res.ok && STATE.tab !== 'simulator') renderStage();
      });
    }
  }

  init();
})();

/**
 * Underdark Web - Main Application Controller
 * Handles Items, Heroes, Mercenaries, and Mounts
 */

(function () {
  'use strict';

  let rawItemData = null;
  let expansionData = null; // heroes, mercenaries, mounts
  let searchEngine = null;

  // Active Tab: 'items' | 'heroes' | 'mercenaries' | 'mounts' | 'pets'
  let currentTab = 'items';

  // State
  const state = {
    // Items
    query: '',
    category: 'all',
    range: 'all',
    tier: 'all',
    usage: 'all',
    tags: [],
    drop: 'all',
    awakeningLevel: 0,
    sortBy: 'default',

    // Heroes
    heroTier: 'all',
    heroGrade: 'all',
    heroLevel: 'base', // 'base' | '3' | '6' | '9' | '12' | '15'

    // Mercenaries
    mercGrade: 'all',
    mercRec: 'all',
    mercTier: 'SSS', // 'B' | 'A' | 'S' | 'SS' | 'SSS'

    // Pets
    petTier: 'all',
    petDrop: 'all',

    // Camp (구조물 / 소품)
    campType: 'all', // 'all' | 'structure' | 'prop'
    campCommonExpanded: true,
  };

  // -------------------------------------------------------------
  // Data Grid Table Sorting State & Ranking Definitions
  // -------------------------------------------------------------
  const tabSortState = {
    items: { col: null, dir: 'desc' },
    heroes: { col: null, dir: 'desc' },
    mercenaries: { col: null, dir: 'desc' },
    mounts: { col: 'no', dir: 'asc' },
    pets: { col: 'no', dir: 'asc' },
    camp: { col: 'no', dir: 'asc' },
  };

  const GRADE_RANKS = {
    '신화': 60,
    '전설': 50,
    '영웅': 40,
    '희귀': 30,
    '고급': 20,
    '일반': 10
  };

  function parseTierRank(tier) {
    if (!tier) return 0;
    const baseMap = { SSS: 100, SS: 85, S: 70, A: 55, B: 40, C: 30, D: 20, E: 10, F: 0 };
    for (const [key, base] of Object.entries(baseMap)) {
      if (tier.startsWith(key)) {
        if (tier.endsWith('+')) return base + 4;
        if (tier.endsWith('-')) return base - 4;
        return base;
      }
    }
    return 0;
  }

  const REC_RANKS = {
    'SSS': 100,
    'SS': 90,
    'S': 80,
    'A': 70,
    'B': 60,
    'J': 55,
    'C': 50,
    'X': 10
  };

  const USAGE_RANKS = {
    'O': 40,
    '△': 30,
    'X': 20,
    'XX': 10
  };

  function renderTh(colKey, label, style = '', isCenter = false) {
    const cur = tabSortState[currentTab] || {};
    const isActive = cur.col === colKey;
    const dir = cur.dir || 'desc';
    const alignClass = isCenter ? 'text-center' : '';
    const sortedClass = isActive ? `is-sorted sort-${dir}` : '';
    const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : '↕';
    const sortTitle = isActive
      ? (dir === 'asc' ? `${label} (현재 오름차순, 클릭 시 내림차순)` : `${label} (현재 내림차순, 클릭 시 오름차순)`)
      : `${label} (클릭하여 정렬)`;

    return `
      <th class="sortable-th ${alignClass} ${sortedClass}" data-sort-col="${colKey}" style="${style}" title="${sortTitle}" role="button" tabindex="0">
        <div class="th-inner">
          <span class="th-label">${label}</span>
          <span class="sort-indicator" aria-hidden="true">${arrow}</span>
        </div>
      </th>
    `;
  }

  function handleTableSortClick(colKey) {
    const cur = tabSortState[currentTab];
    if (!cur) return;

    if (cur.col === colKey) {
      cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
    } else {
      cur.col = colKey;
      if (['tier', 'grade', 'stars', 'recommend', 'usage', 'buff'].includes(colKey)) {
        cur.dir = 'desc';
      } else {
        cur.dir = 'asc';
      }
    }

    syncSortSelectValue();
    renderActiveView();
  }

  function getHeroStarsCount(hero, hl) {
    if (hl && hl !== 'base') {
      const lvInfo = hero.levels ? (hero.levels[hl] || (hl === '15' ? (hero.levels['16'] || hero.levels['17'] || hero.levels['18']) : null)) : null;
      if (lvInfo && lvInfo.stars) {
        return (lvInfo.stars.match(/★/g) || []).length;
      }
      return 0;
    }
    let total = 0;
    if (hero.levels) {
      Object.values(hero.levels).forEach(lv => {
        if (lv && lv.stars) total += (lv.stars.match(/★/g) || []).length;
      });
    }
    return total;
  }

  function sortItemsList(items, col, dir) {
    if (!col || col === 'default') return items;
    const sorted = [...items];
    const mult = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let res = 0;
      if (col === 'name') {
        res = a.name.localeCompare(b.name, 'ko');
      } else if (col === 'tier') {
        const scoreA = 100 - (a.gradeRank !== null && a.gradeRank !== undefined ? a.gradeRank : 999);
        const scoreB = 100 - (b.gradeRank !== null && b.gradeRank !== undefined ? b.gradeRank : 999);
        res = scoreA - scoreB;
      } else if (col === 'usage') {
        const ua = USAGE_RANKS[a.usage] || 0;
        const ub = USAGE_RANKS[b.usage] || 0;
        res = ua - ub;
      } else if (col === 'range') {
        res = (a.range || '').localeCompare(b.range || '', 'ko');
      } else if (col === 'drops') {
        const da = (a.drops && a.drops[0]) || '';
        const db = (b.drops && b.drops[0]) || '';
        res = da.localeCompare(db, 'ko');
      }
      if (res !== 0) return res * mult;
      return (a.no || 0) - (b.no || 0);
    });

    return sorted;
  }

  function sortHeroesList(heroes, col, dir, hl) {
    if (!col || col === 'default') return heroes;
    const sorted = [...heroes];
    const mult = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let res = 0;
      if (col === 'name') {
        res = a.name.localeCompare(b.name, 'ko');
      } else if (col === 'tier') {
        const ta = parseTierRank(a.tier);
        const tb = parseTierRank(b.tier);
        res = ta - tb;
      } else if (col === 'stars') {
        const sa = getHeroStarsCount(a, hl);
        const sb = getHeroStarsCount(b, hl);
        res = sa - sb;
      } else if (col === 'grade') {
        const ga = GRADE_RANKS[a.grade] || 0;
        const gb = GRADE_RANKS[b.grade] || 0;
        res = ga - gb;
      }

      if (res !== 0) return res * mult;
      return (a.no || 0) - (b.no || 0) || a.name.localeCompare(b.name, 'ko');
    });

    return sorted;
  }

  function sortMercenariesList(mercs, col, dir, currentTier) {
    if (!col || col === 'default') return mercs;
    const sorted = [...mercs];
    const mult = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let res = 0;
      if (col === 'name') {
        res = a.name.localeCompare(b.name, 'ko');
      } else if (col === 'grade') {
        const ga = GRADE_RANKS[a.grade] || 0;
        const gb = GRADE_RANKS[b.grade] || 0;
        res = ga - gb;
      } else if (col === 'recommend') {
        const ra = REC_RANKS[a.recommend] || 0;
        const rb = REC_RANKS[b.recommend] || 0;
        res = ra - rb;
      } else if (col === 'buff') {
        const getNum = m => {
          const v = m.tierValues ? m.tierValues[currentTier] : null;
          if (!v) return -999999;
          const parsed = parseFloat(v);
          return isNaN(parsed) ? 0 : parsed;
        };
        res = getNum(a) - getNum(b);
      } else if (col === 'level') {
        res = (a.no || 0) - (b.no || 0);
      }

      if (res !== 0) return res * mult;
      return a.name.localeCompare(b.name, 'ko');
    });

    return sorted;
  }

  function sortMountsList(mounts, col, dir) {
    if (!col || col === 'default') col = 'no';
    const sorted = [...mounts];
    const mult = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let res = 0;
      if (col === 'no') {
        res = (a.no || 0) - (b.no || 0);
      } else if (col === 'name') {
        res = a.name.localeCompare(b.name, 'ko');
      }

      if (res !== 0) return res * mult;
      return (a.no || 0) - (b.no || 0);
    });

    return sorted;
  }

  function sortPetsList(pets, col, dir) {
    if (!col || col === 'default') col = 'no';
    const sorted = [...pets];
    const mult = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let res = 0;
      if (col === 'no') {
        res = (a.no || 0) - (b.no || 0);
      } else if (col === 'name') {
        res = a.name.localeCompare(b.name, 'ko');
      } else if (col === 'tier') {
        const ta = parseTierRank(a.tier);
        const tb = parseTierRank(b.tier);
        res = ta - tb;
      } else if (col === 'drops') {
        const da = (a.drops && a.drops[0]) || a.dropRaw || '';
        const db = (b.drops && b.drops[0]) || b.dropRaw || '';
        res = da.localeCompare(db, 'ko');
      }

      if (res !== 0) return res * mult;
      return (a.no || 0) - (b.no || 0);
    });

    return sorted;
  }

  function updateSortSelectForTab(tab) {
    if (!elSortSelect || !elSortWrapper) return;
    elSortWrapper.style.display = 'flex';

    let html = '';
    if (tab === 'items') {
      html = `
        <option value="default">기본 추천순</option>
        <option value="tier_desc">티어 높은순 (S+ ❯ F-)</option>
        <option value="tier_asc">티어 낮은순 (F- ❯ S+)</option>
        <option value="usage_desc">용도 추천순 (O ❯ XX)</option>
        <option value="name_asc">아이템 이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">아이템 이름 역순 (ㅎ~ㄱ)</option>
        <option value="range_asc">사거리순 (근거리 ❯ 원거리)</option>
        <option value="drops_asc">드랍처순 (가나다)</option>
      `;
      if (rawItemData && rawItemData.statDefs) {
        const popularStats = [
          'hero_crit_dmg', 'tower_atk_mult', 'all_atk', 'projectile',
          'hero_atk_speed', 'double_attack', 'status_bonus', 'immune_bonus', 'hero_hp'
        ];
        const statOptions = popularStats
          .map(k => {
            const s = rawItemData.statDefs[k];
            return s ? `<option value="stat_${k}">${s.label} (${s.unit})</option>` : '';
          })
          .filter(Boolean)
          .join('');
        if (statOptions) {
          html += `<optgroup label="주요 능력치 수치순">${statOptions}</optgroup>`;
        }
      }
    } else if (tab === 'heroes') {
      html = `
        <option value="default">기본 순서</option>
        <option value="tier_desc">티어 높은순 (SSS ❯ F)</option>
        <option value="tier_asc">티어 낮은순 (F ❯ SSS)</option>
        <option value="stars_desc">추천 별점 높은순 (★★★★★)</option>
        <option value="grade_desc">등급 높은순 (신화 ❯ 일반)</option>
        <option value="name_asc">영웅 이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">영웅 이름 역순 (ㅎ~ㄱ)</option>
      `;
    } else if (tab === 'mercenaries') {
      html = `
        <option value="default">기본 순서</option>
        <option value="recommend_desc">추천도 높은순 (SSS ❯ X)</option>
        <option value="recommend_asc">추천도 낮은순 (X ❯ SSS)</option>
        <option value="grade_desc">등급 높은순 (신화 ❯ 일반)</option>
        <option value="buff_desc">선택 버프 수치 높은순</option>
        <option value="buff_asc">선택 버프 수치 낮은순</option>
        <option value="name_asc">용병 이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">용병 이름 역순 (ㅎ~ㄱ)</option>
      `;
    } else if (tab === 'mounts') {
      html = `
        <option value="no_asc">도감 번호순 (1 ❯ 57)</option>
        <option value="no_desc">도감 번호 역순 (57 ❯ 1)</option>
        <option value="name_asc">탈것 이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">탈것 이름 역순 (ㅎ~ㄱ)</option>
      `;
    } else if (tab === 'pets') {
      html = `
        <option value="no_asc">도감 번호순 (1 ❯ 26)</option>
        <option value="no_desc">도감 번호 역순 (26 ❯ 1)</option>
        <option value="tier_desc">티어 높은순 (S+ ❯ F-)</option>
        <option value="tier_asc">티어 낮은순 (F- ❯ S+)</option>
        <option value="name_asc">펫 이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">펫 이름 역순 (ㅎ~ㄱ)</option>
        <option value="drops_asc">획득처순 (가나다)</option>
      `;
    } else if (tab === 'camp') {
      html = `
        <option value="default">기본 순서 (구조물 ❯ 소품)</option>
        <option value="no_asc">번호순 (오름차순)</option>
        <option value="no_desc">번호순 (내림차순)</option>
        <option value="type_asc">구분순 (구조물 ❯ 소품)</option>
        <option value="type_desc">구분순 (소품 ❯ 구조물)</option>
        <option value="name_asc">이름순 (ㄱ~ㅎ)</option>
        <option value="name_desc">이름 역순 (ㅎ~ㄱ)</option>
      `;
    }

    elSortSelect.innerHTML = html;
    syncSortSelectValue();
  }

  function syncSortSelectValue() {
    if (!elSortSelect) return;
    const cur = tabSortState[currentTab];
    if (!cur || !cur.col || cur.col === 'default') {
      elSortSelect.value = 'default';
      return;
    }
    if (cur.col.startsWith('stat_')) {
      elSortSelect.value = cur.col;
      return;
    }
    const val = `${cur.col}_${cur.dir}`;
    if (elSortSelect.querySelector(`option[value="${val}"]`)) {
      elSortSelect.value = val;
    }
  }

  // DOM Elements
  let elGlobalNav;
  let elHeroTitle;
  let elHeroSubtitle;
  let elSearchInput;
  let elSearchClear;
  let elSearchHints;

  // Control Sections
  let elItemControls;
  let elHeroControls;
  let elMercControls;
  let elMountControls;
  let elPetControls;
  let elCampControls;
  let elGrowthControls;

  // Camp Controls
  let elCampTypeFilter;
  let elCampCommonToggleBtn;

  // Growth Controls
  let elGrowthZoomBtn;

  // Item Controls
  let elCatTabs;
  let elAwakeningSteps;
  let elRangeFilter;
  let elTierFilter;
  let elUsageFilter;
  let elDropFilter;
  let elTagChips;
  let elSortSelect;
  let elSortWrapper;

  // Hero Controls
  let elHeroLevelSteps;
  let elHeroTierFilter;
  let elHeroGradeFilter;

  // Merc Controls
  let elMercTierSteps;
  let elMercGradeFilter;
  let elMercRecFilter;

  // Mount Controls
  let elMountGuideBtn;

  // Pet Controls
  let elPetTierFilter;
  let elPetDropFilter;
  let elPetGuideBtn;

  // Filter Toggle & Sticky & ScrollTop
  let elFilterToggle;
  let elFilterPanel;
  let elFilterCount;
  let elScrollTopBtn;

  // Results
  let elItemsGrid;
  let elResultCount;
  let elResultUnit;
  let elModalOverlay;
  let elModalContent;

  // View Mode: 'table' or 'card' (Default on mobile < 768px is 'card', PC >= 768px is 'table')
  let userExplicitViewMode = localStorage.getItem('ara_view_mode');
  let currentViewMode = userExplicitViewMode || (window.innerWidth < 768 ? 'card' : 'table');
  let elViewModeToggle;
  let elAdminBtn;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    await loadAllData();
    setupEngine();
    renderInitialFilters();
    initFilterPanelState();
    bindEvents();
    readUrlParams();
    updateViewToggleButtons();
    switchTab(currentTab);
  }

  function cacheDom() {
    elGlobalNav = document.getElementById('globalNav');
    elHeroTitle = document.getElementById('heroTitle');
    elHeroSubtitle = document.getElementById('heroSubtitle');
    elSearchInput = document.getElementById('searchInput');
    elSearchClear = document.getElementById('searchClear');
    elSearchHints = document.getElementById('searchHints');

    elFilterToggle = document.getElementById('filterToggle');
    elFilterPanel = document.getElementById('filterPanel');
    elFilterCount = document.getElementById('filterCount');
    elScrollTopBtn = document.getElementById('scrollTopBtn');

    elItemControls = document.getElementById('itemControlSection');
    elHeroControls = document.getElementById('heroControlSection');
    elMercControls = document.getElementById('mercControlSection');
    elMountControls = document.getElementById('mountControlSection');
    elPetControls = document.getElementById('petControlSection');
    elCampControls = document.getElementById('campControlSection');
    elGrowthControls = document.getElementById('growthControlSection');

    // Camp
    elCampTypeFilter = document.getElementById('campTypeFilter');
    elCampCommonToggleBtn = document.getElementById('campCommonToggleBtn');

    // Growth
    elGrowthZoomBtn = document.getElementById('growthZoomBtn');

    // Item
    elCatTabs = document.getElementById('categoryTabs');
    elAwakeningSteps = document.getElementById('awakeningSteps');
    elRangeFilter = document.getElementById('rangeFilter');
    elTierFilter = document.getElementById('tierFilter');
    elUsageFilter = document.getElementById('usageFilter');
    elDropFilter = document.getElementById('dropFilter');
    elTagChips = document.getElementById('tagChips');
    elSortSelect = document.getElementById('sortSelect');
    elSortWrapper = document.getElementById('sortWrapper');

    // Hero
    elHeroLevelSteps = document.getElementById('heroLevelSteps');
    elHeroTierFilter = document.getElementById('heroTierFilter');
    elHeroGradeFilter = document.getElementById('heroGradeFilter');

    // Merc
    elMercTierSteps = document.getElementById('mercTierSteps');
    elMercGradeFilter = document.getElementById('mercGradeFilter');
    elMercRecFilter = document.getElementById('mercRecFilter');

    // Mount
    elMountGuideBtn = document.getElementById('mountGuideBtn');

    // Pet
    elPetTierFilter = document.getElementById('petTierFilter');
    elPetDropFilter = document.getElementById('petDropFilter');
    elPetGuideBtn = document.getElementById('petGuideBtn');

    // Results & Modal
    elItemsGrid = document.getElementById('itemsGrid');
    elResultCount = document.getElementById('resultCount');
    elResultUnit = document.getElementById('resultUnit');
    elModalOverlay = document.getElementById('modalOverlay');
    elModalContent = document.getElementById('modalContent');
    elViewModeToggle = document.getElementById('viewModeToggle');
    elAdminBtn = document.getElementById('adminBtn');
  }

  async function loadAllData() {
    // 1. Items Data
    const localSaved = localStorage.getItem('underdark_items_data');
    if (localSaved) {
      try {
        rawItemData = JSON.parse(localSaved);
      } catch (e) { }
    }
    if (!rawItemData && window.UNDERDARK_DATA) {
      rawItemData = window.UNDERDARK_DATA;
    }
    if (!rawItemData) {
      try {
        const res = await fetch('data/items.json');
        rawItemData = await res.json();
      } catch (e) { }
    }

    // 2. Expansion Data (Heroes, Mercs, Mounts, Pets)
    const cachedLive = window.SheetsSync ? window.SheetsSync.getCachedData() : null;
    if (cachedLive && cachedLive.items && cachedLive.items.length && rawItemData) {
      rawItemData = { ...rawItemData, items: cachedLive.items };
      if (window.UNDERDARK_DATA) window.UNDERDARK_DATA.items = cachedLive.items;
    }
    if (cachedLive && cachedLive.heroes && cachedLive.heroes.length) {
      expansionData = cachedLive;
    } else if (window.UNDERDARK_EXPANSION) {
      expansionData = window.UNDERDARK_EXPANSION;
    } else {
      try {
        const [hRes, mRes, mtRes, pRes, cRes] = await Promise.all([
          fetch('data/heroes.json'),
          fetch('data/mercenaries.json'),
          fetch('data/mounts.json'),
          fetch('data/pets.json'),
          fetch('data/camp.json')
        ]);
        const petJson = await pRes.json();
        const campJson = cRes.ok ? await cRes.json() : null;
        expansionData = {
          heroes: await hRes.json(),
          mercenaries: await mRes.json(),
          mounts: (await mtRes.json()).mounts || [],
          mountSubOptions: (await mtRes.json()).subOptions || [],
          pets: petJson.pets || [],
          petGuide: petJson.guide || {},
          camp: campJson
        };
      } catch (e) {
        console.warn('Could not load expansion data json', e);
      }
    }

    if (expansionData && !expansionData.camp) {
      try {
        const cRes = await fetch('data/camp.json');
        if (cRes.ok) expansionData.camp = await cRes.json();
      } catch (e) {
        console.warn('Could not load camp.json fallback', e);
      }
    }

    // Trigger silent background revalidation with Google Sheets
    if (window.SheetsSync) {
      setTimeout(() => {
        triggerBackgroundSheetSync(false);
      }, 300);
    }
  }

  function setupEngine() {
    if (rawItemData) {
      searchEngine = new window.UnderdarkSearch(rawItemData);
    }
  }

  function renderInitialFilters() {
    if (!rawItemData) return;

    // Item Categories
    elCatTabs.innerHTML = `
      <button class="cat-tab ${state.category === 'all' ? 'active' : ''}" data-cat="all">전체</button>
      ${rawItemData.categories.map(c => `
        <button class="cat-tab ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>
      `).join('')}
    `;

    // Drop Locations
    elDropFilter.innerHTML = `
      <option value="all">드랍처 (전체)</option>
      ${rawItemData.drops.map(d => `<option value="${d}">${d}</option>`).join('')}
    `;

    // Tag Chips
    const topTags = ['처형', '스턴', '이감', '스플', '타수', '면역', '상추피', '투사체', '곡', '영공속'];
    elTagChips.innerHTML = topTags
      .filter(t => rawItemData.tagDefs && rawItemData.tagDefs[t])
      .map(t => `<button class="tag-chip ${state.tags.includes(t) ? 'active' : ''}" data-tag="${t}">${t}</button>`)
      .join('');

    // Initial Sort Select Options
    updateSortSelectForTab(currentTab);
  }

  function initFilterPanelState() {
    if (!elFilterToggle || !elFilterPanel) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      elFilterPanel.classList.add('is-collapsed');
      elFilterToggle.classList.remove('active');
      elFilterToggle.setAttribute('aria-expanded', 'false');
    } else {
      elFilterPanel.classList.remove('is-collapsed');
      elFilterToggle.classList.add('active');
      elFilterToggle.setAttribute('aria-expanded', 'true');
    }
  }

  function bindEvents() {
    // Global Navigation
    elGlobalNav.addEventListener('click', e => {
      const btn = e.target.closest('.g-tab');
      if (!btn) return;
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });

    // Search input
    let debounceTimer;
    elSearchInput.addEventListener('input', e => {
      state.query = e.target.value;
      elSearchClear.classList.toggle('visible', !!state.query.trim());
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateUrl();
        renderActiveView();
      }, 120);
    });

    // Search Clear
    elSearchClear.addEventListener('click', () => {
      elSearchInput.value = '';
      state.query = '';
      elSearchClear.classList.remove('visible');
      elSearchInput.focus();
      updateUrl();
      renderActiveView();
    });

    // Filter Panel Toggle (Collapsible on all devices)
    if (elFilterToggle && elFilterPanel) {
      elFilterToggle.addEventListener('click', () => {
        const isCollapsed = elFilterPanel.classList.toggle('is-collapsed');
        const isOpen = !isCollapsed;
        elFilterToggle.setAttribute('aria-expanded', isOpen);
        elFilterToggle.classList.toggle('active', isOpen);
      });
    }

    // Floating Scroll To Top Button
    if (elScrollTopBtn) {
      window.addEventListener('scroll', () => {
        elScrollTopBtn.classList.toggle('visible', window.scrollY > 280);
      }, { passive: true });

      elScrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Item Events
    elCatTabs.addEventListener('click', e => {
      const btn = e.target.closest('.cat-tab');
      if (!btn) return;
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.getAttribute('data-cat');
      updateUrl();
      renderActiveView();
    });

    elAwakeningSteps.addEventListener('click', e => {
      const btn = e.target.closest('.awakening-step-btn');
      if (!btn) return;
      document.querySelectorAll('#awakeningSteps .awakening-step-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.awakeningLevel = parseInt(btn.getAttribute('data-level'), 10);
      updateUrl();
      renderActiveView();
    });

    elRangeFilter.addEventListener('change', e => { state.range = e.target.value; updateUrl(); renderActiveView(); });
    elTierFilter.addEventListener('change', e => { state.tier = e.target.value; updateUrl(); renderActiveView(); });
    elUsageFilter.addEventListener('change', e => { state.usage = e.target.value; updateUrl(); renderActiveView(); });
    elDropFilter.addEventListener('change', e => { state.drop = e.target.value; updateUrl(); renderActiveView(); });

    elTagChips.addEventListener('click', e => {
      const btn = e.target.closest('.tag-chip');
      if (!btn) return;
      const tag = btn.getAttribute('data-tag');
      if (state.tags.includes(tag)) {
        state.tags = state.tags.filter(t => t !== tag);
        btn.classList.remove('active');
      } else {
        state.tags.push(tag);
        btn.classList.add('active');
      }
      updateUrl();
      renderActiveView();
    });

    elSortSelect.addEventListener('change', e => {
      const val = e.target.value;
      const cur = tabSortState[currentTab];
      if (!cur) return;

      if (val === 'default') {
        cur.col = null;
        cur.dir = 'desc';
      } else if (val.startsWith('stat_')) {
        cur.col = val;
        cur.dir = 'desc';
      } else {
        const lastUnder = val.lastIndexOf('_');
        if (lastUnder !== -1) {
          cur.col = val.substring(0, lastUnder);
          cur.dir = val.substring(lastUnder + 1);
        }
      }
      renderActiveView();
    });

    // Data Grid Table Column Sorting Event Delegation
    elItemsGrid.addEventListener('click', e => {
      const th = e.target.closest('.sortable-th');
      if (th) {
        e.preventDefault();
        e.stopPropagation();
        const colKey = th.getAttribute('data-sort-col');
        if (colKey) handleTableSortClick(colKey);
      }
    });

    elItemsGrid.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const th = e.target.closest('.sortable-th');
        if (th) {
          e.preventDefault();
          e.stopPropagation();
          const colKey = th.getAttribute('data-sort-col');
          if (colKey) handleTableSortClick(colKey);
        }
      }
    });

    // Hero Events
    elHeroLevelSteps.addEventListener('click', e => {
      const btn = e.target.closest('.awakening-step-btn');
      if (!btn) return;
      document.querySelectorAll('#heroLevelSteps .awakening-step-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.heroLevel = btn.getAttribute('data-hlevel');
      renderActiveView();
    });

    elHeroTierFilter.addEventListener('change', e => { state.heroTier = e.target.value; renderActiveView(); });
    elHeroGradeFilter.addEventListener('change', e => { state.heroGrade = e.target.value; renderActiveView(); });

    // Merc Events
    elMercTierSteps.addEventListener('click', e => {
      const btn = e.target.closest('.awakening-step-btn');
      if (!btn) return;
      document.querySelectorAll('#mercTierSteps .awakening-step-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mercTier = btn.getAttribute('data-mtier');
      renderActiveView();
    });

    elMercGradeFilter.addEventListener('change', e => { state.mercGrade = e.target.value; renderActiveView(); });
    elMercRecFilter.addEventListener('change', e => { state.mercRec = e.target.value; renderActiveView(); });

    // Mount Events
    elMountGuideBtn.addEventListener('click', openMountGuideModal);

    // Pet Events
    if (elPetTierFilter) {
      elPetTierFilter.addEventListener('change', e => {
        state.petTier = e.target.value;
        renderActiveView();
      });
    }
    if (elPetDropFilter) {
      elPetDropFilter.addEventListener('change', e => {
        state.petDrop = e.target.value;
        renderActiveView();
      });
    }
    if (elPetGuideBtn) {
      elPetGuideBtn.addEventListener('click', openPetGuideModal);
    }

    // Camp Events
    if (elCampTypeFilter) {
      elCampTypeFilter.addEventListener('click', e => {
        const btn = e.target.closest('.awakening-step-btn');
        if (!btn) return;
        elCampTypeFilter.querySelectorAll('.awakening-step-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.campType = btn.getAttribute('data-ctype');
        renderActiveView();
      });
    }

    if (elCampCommonToggleBtn) {
      elCampCommonToggleBtn.addEventListener('click', () => {
        state.campCommonExpanded = !state.campCommonExpanded;
        const box = document.getElementById('campCommonDashboard');
        if (box) {
          box.classList.toggle('is-collapsed', !state.campCommonExpanded);
        }
        elCampCommonToggleBtn.classList.toggle('active', state.campCommonExpanded);
        elCampCommonToggleBtn.setAttribute('aria-expanded', state.campCommonExpanded ? 'true' : 'false');
      });
    }

    // Growth Events
    if (elGrowthZoomBtn) {
      elGrowthZoomBtn.addEventListener('click', openGrowthModal);
    }

    if (elAdminBtn) {
      elAdminBtn.addEventListener('click', openAdminModal);
    }

    // Keyboard & Modal
    window.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== elSearchInput) {
        e.preventDefault();
        elSearchInput.focus();
        elSearchInput.select();
      } else if (e.key === 'Escape' && elModalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    elModalOverlay.addEventListener('click', e => {
      if (e.target === elModalOverlay || e.target.closest('.modal-close-btn')) {
        closeModal();
      }
    });

    // Prevent background scrolling while modal is open without removing scrollbar
    elModalOverlay.addEventListener('wheel', e => {
      if (!e.target.closest('.modal-content')) {
        e.preventDefault();
      }
    }, { passive: false });

    elModalOverlay.addEventListener('touchmove', e => {
      if (!e.target.closest('.modal-content')) {
        e.preventDefault();
      }
    }, { passive: false });

    // View Mode Toggle (Table vs Card)
    if (elViewModeToggle) {
      elViewModeToggle.addEventListener('click', e => {
        const btn = e.target.closest('.view-btn');
        if (!btn) return;
        const mode = btn.getAttribute('data-mode');
        if (mode && mode !== currentViewMode) {
          currentViewMode = mode;
          userExplicitViewMode = mode;
          localStorage.setItem('ara_view_mode', mode);
          updateViewToggleButtons();
          renderActiveView();
        }
      });
    }

    // Auto-adapt on resize if user hasn't explicitly chosen
    window.addEventListener('resize', () => {
      if (!userExplicitViewMode) {
        const autoMode = window.innerWidth < 768 ? 'card' : 'table';
        if (autoMode !== currentViewMode) {
          currentViewMode = autoMode;
          updateViewToggleButtons();
          renderActiveView();
        }
      }
    });
  }

  function updateViewToggleButtons() {
    if (!elViewModeToggle) return;
    elViewModeToggle.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === currentViewMode);
    });
  }

  // Switch Tab
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.g-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });

    // Hide all controls
    elItemControls.style.display = 'none';
    elHeroControls.style.display = 'none';
    elMercControls.style.display = 'none';
    elMountControls.style.display = 'none';
    if (elPetControls) elPetControls.style.display = 'none';
    if (elCampControls) elCampControls.style.display = 'none';
    if (elGrowthControls) elGrowthControls.style.display = 'none';

    const stickySearch = document.querySelector('.search-sticky');
    const resultsMeta = document.querySelector('.results-meta');

    // Show selected controls & customize hero banner
    if (tab === 'items') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '아이템 도감 & 능력치 검색';
      elHeroSubtitle.textContent = '이름, 초성, 능력 문장 뿐만 아니라 세부 수치 조건으로 자유롭게 검색하세요.';
      elSearchInput.placeholder = '검색어 입력 (예: 빛단, ㅅㅁㅍㅍ, 처형, 치피>=100, 투사체>2)';
      elItemControls.style.display = 'block';
      elResultUnit.textContent = '아이템';
      renderItemSearchHints();
    } else if (tab === 'heroes') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '영웅 도감 & 영덱 공략';
      elHeroSubtitle.textContent = '모든 영웅의 기본 능력과 3·6·9·12·15 레벨별 추가 능력, 티어 평가를 확인하세요.';
      elSearchInput.placeholder = '영웅 이름, 별칭, 초성 검색 (예: 오크, 정불갑, 용싶해, 아그니)';
      elHeroControls.style.display = 'block';
      elResultUnit.textContent = '명의 영웅';
      renderHeroSearchHints();
    } else if (tab === 'mercenaries') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '지원용병 도감 & 추천';
      elHeroSubtitle.textContent = '지원용병의 등급별(B~SSS) 공격력/공속/치명타 버프 수치와 추천도를 확인하세요.';
      elSearchInput.placeholder = '지원용병 이름, 능력 검색 (예: 저승사자, 닌자, 세이렌, 토르)';
      elMercControls.style.display = 'block';
      elResultUnit.textContent = '명의 지원용병';
      renderMercSearchHints();
    } else if (tab === 'mounts') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '탈것 도감 & 부옵션 가이드';
      elHeroSubtitle.textContent = '총 57종의 탈것 고유 능력과 평가 코멘트, 합성법 및 18가지 부옵션 정보입니다.';
      elSearchInput.placeholder = '탈것 이름, 능력 검색 (예: 아기 백룡, 검은 악마, 거대슬라임)';
      elMountControls.style.display = 'block';
      elResultUnit.textContent = '종의 탈것';
      renderMountSearchHints();
    } else if (tab === 'pets') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '펫 도감 & 등급·옵션 세팅 가이드';
      elHeroSubtitle.textContent = '총 26종 펫의 고유 기본 능력과 드랍처, 등급별 해금 옵션 및 타워/영덱 종결 세팅 정보입니다.';
      elSearchInput.placeholder = '펫 이름, 초성, 능력 검색 (예: 용암슬라임, 쉐도우, ㅇㅇㅅㄹㅇ)';
      if (elPetControls) elPetControls.style.display = 'block';
      elResultUnit.textContent = '종의 펫';
      renderPetSearchHints();
    } else if (tab === 'camp') {
      if (stickySearch) stickySearch.style.display = '';
      if (resultsMeta) resultsMeta.style.display = '';
      if (elSortWrapper) elSortWrapper.style.display = 'flex';
      if (elViewModeToggle) elViewModeToggle.style.display = 'inline-flex';
      elHeroTitle.textContent = '야영지 구조물 & 소품 도감';
      elHeroSubtitle.textContent = '야영지 구조물(9종)과 소품(34종)의 고유 능력 및 공통 등급·부옵·랜덤옵 정보입니다.';
      elSearchInput.placeholder = '구조물/소품 이름, 초성, 능력 검색 (예: 묘지, 삼각 플라스크, ㅂㅅ, 원거리)';
      if (elCampControls) elCampControls.style.display = 'block';
      elResultUnit.textContent = '개 항목';
      renderCampSearchHints();
    } else if (tab === 'growth') {
      if (stickySearch) stickySearch.style.display = 'none';
      if (resultsMeta) resultsMeta.style.display = 'none';
      if (elGrowthControls) elGrowthControls.style.display = 'block';
      elHeroTitle.textContent = '언더다크 성장 가이드';
      elHeroSubtitle.textContent = '언더다크 성장에 필요한 전체 요구치와 성장 가이드 차트입니다.';
    }

    updateSortSelectForTab(tab);
    updateUrl();
    renderActiveView();
  }

  function renderItemSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="치피>=100">치피>=100</button>
      <button type="button" class="search-hint-tag" data-q="투사체>=3">투사체>=3</button>
      <button type="button" class="search-hint-tag" data-q="이감>=20">이감>=20</button>
      <button type="button" class="search-hint-tag" data-q="처형 원거리">처형 원거리</button>
      <button type="button" class="search-hint-tag" data-q="빛단">빛단</button>
      <button type="button" class="search-hint-tag" data-q="ㅅㅁㅍㅍ">ㅅㅁㅍㅍ</button>
    `;
    bindHintTags();
  }

  function renderHeroSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="오크">오크 (SSS)</button>
      <button type="button" class="search-hint-tag" data-q="아그니">아그니</button>
      <button type="button" class="search-hint-tag" data-q="정불갑">정불갑</button>
      <button type="button" class="search-hint-tag" data-q="용싶해">용싶해</button>
      <button type="button" class="search-hint-tag" data-q="스턴">스턴</button>
      <button type="button" class="search-hint-tag" data-q="곡괭이">곡괭이</button>
    `;
    bindHintTags();
  }

  function renderMercSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="저승사자">저승사자 (자사)</button>
      <button type="button" class="search-hint-tag" data-q="세이렌">세이렌 (처형)</button>
      <button type="button" class="search-hint-tag" data-q="발키리">발키리</button>
      <button type="button" class="search-hint-tag" data-q="서큐비스">서큐비스</button>
    `;
    bindHintTags();
  }

  function renderMountSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="아기 백룡">아기 백룡 (종결)</button>
      <button type="button" class="search-hint-tag" data-q="검은 악마">검은 악마 (4배)</button>
      <button type="button" class="search-hint-tag" data-q="고대 백룡">고대 백룡 (4배모드)</button>
      <button type="button" class="search-hint-tag" data-q="곡괭이">곡괭이</button>
    `;
    bindHintTags();
  }

  function renderPetSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="용암슬라임">용암 슬라임</button>
      <button type="button" class="search-hint-tag" data-q="쉐도우">쉐도우 (S)</button>
      <button type="button" class="search-hint-tag" data-q="포포">포포 (A+)</button>
      <button type="button" class="search-hint-tag" data-q="공격 속도">공격 속도</button>
      <button type="button" class="search-hint-tag" data-q="치명타">치명타</button>
      <button type="button" class="search-hint-tag" data-q="타워">타워 강화</button>
      <button type="button" class="search-hint-tag" data-q="스테이지">스테이지 펫</button>
    `;
    bindHintTags();
  }

  function renderCampSearchHints() {
    elSearchHints.innerHTML = `
      <span class="search-hint-label">⚡ 빠른 검색:</span>
      <button type="button" class="search-hint-tag" data-q="묘지">묘지</button>
      <button type="button" class="search-hint-tag" data-q="삼각 플라스크">삼각 플라스크</button>
      <button type="button" class="search-hint-tag" data-q="사파이어">사파이어</button>
      <button type="button" class="search-hint-tag" data-q="알에서 깬 병아리">알에서 깬 병아리</button>
      <button type="button" class="search-hint-tag" data-q="주 무기">주 무기 드랍</button>
      <button type="button" class="search-hint-tag" data-q="보조 무기">보조 무기 드랍</button>
      <button type="button" class="search-hint-tag" data-q="투구">투구 드랍</button>
      <button type="button" class="search-hint-tag" data-q="기타">기타 드랍</button>
      <button type="button" class="search-hint-tag" data-q="붉은 보석">붉은 보석 획득</button>
    `;
    bindHintTags();
  }

  function bindHintTags() {
    elSearchHints.querySelectorAll('.search-hint-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const q = tag.getAttribute('data-q');
        elSearchInput.value = q;
        state.query = q;
        elSearchClear.classList.add('visible');
        updateUrl();
        renderActiveView();
      });
    });
  }

  function updateFilterCount() {
    if (!elFilterCount) return;
    let count = 0;
    if (currentTab === 'items') {
      if (state.category !== 'all') count++;
      if (state.awakeningLevel > 0) count++;
      if (state.range !== 'all') count++;
      if (state.tier !== 'all') count++;
      if (state.usage !== 'all') count++;
      if (state.drop !== 'all') count++;
      if (state.tags && state.tags.length > 0) count += state.tags.length;
    } else if (currentTab === 'heroes') {
      if (state.heroTier !== 'all') count++;
      if (state.heroGrade !== 'all') count++;
      if (state.heroLevel !== 'base') count++;
    } else if (currentTab === 'mercenaries') {
      if (state.mercTier !== 'SSS') count++;
      if (state.mercGrade !== 'all') count++;
      if (state.mercRec !== 'all') count++;
    } else if (currentTab === 'pets') {
      if (state.petTier !== 'all') count++;
      if (state.petDrop !== 'all') count++;
    } else if (currentTab === 'camp') {
      if (state.campType !== 'all') count++;
    }

    if (count > 0) {
      elFilterCount.textContent = count;
      elFilterCount.removeAttribute('hidden');
    } else {
      elFilterCount.setAttribute('hidden', '');
    }
  }

  function renderActiveView() {
    updateFilterCount();
    if (currentTab === 'items') {
      renderItemsView();
    } else if (currentTab === 'heroes') {
      renderHeroesView();
    } else if (currentTab === 'mercenaries') {
      renderMercenariesView();
    } else if (currentTab === 'mounts') {
      renderMountsView();
    } else if (currentTab === 'pets') {
      renderPetsView();
    } else if (currentTab === 'camp') {
      renderCampView();
    } else if (currentTab === 'growth') {
      renderGrowthView();
    }
  }

  // -------------------------------------------------------------
  // 1. RENDER ITEMS (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderItemsView() {
    if (!searchEngine) return;
    const curSort = tabSortState.items;
    if (curSort.col && curSort.col.startsWith('stat_')) {
      state.sortBy = curSort.col.replace('stat_', '');
    } else {
      state.sortBy = 'default';
    }
    let items = searchEngine.search(state);
    if (curSort.col && !curSort.col.startsWith('stat_')) {
      items = sortItemsList(items, curSort.col, curSort.dir);
    }
    elResultCount.textContent = items.length;

    if (items.length === 0) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">일치하는 아이템이 없습니다.</div>
          <p>검색어나 필터 조건을 변경해보세요.</p>
        </div>
      `;
      return;
    }

    const currentAwak = state.awakeningLevel;

    if (currentViewMode === 'card') {
      const cardsHtml = items.map(item => {
        const imgHtml = item.img
          ? `<img src="${item.img}" alt="${item.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">⚔️</div>`;

        const rangeBadge = item.range
          ? `<span class="badge-tag badge-range ${item.range}">${item.range}</span>` : '';
        const tierBadge = item.tier
          ? `<span class="tier-badge tier-${item.tier}">${item.grade || item.tier}</span>` : '';
        const usageBadge = item.usage
          ? `<span class="usage-badge usage-${item.usage}">${item.usageLabel || item.usage}</span>` : '';

        let displayAbilities = item.abilities || [];
        let isAwakenedVariant = false;
        let noAwakeningNotice = '';

        if (currentAwak > 0) {
          if (item.awakening && item.awakening[currentAwak]) {
            displayAbilities = item.awakening[currentAwak];
            isAwakenedVariant = true;
          } else if (item.awakeningNote) {
            noAwakeningNotice = `<div class="ability-line" style="border-left-color: var(--accent-gold); color: var(--accent-gold); font-size: 0.8rem; background: #fef3c7;">${item.awakeningNote}</div>`;
          } else {
            noAwakeningNotice = `<div class="ability-line" style="border-left-color: var(--text-dim); color: var(--text-muted); font-size: 0.8rem;"><span style="opacity: 0.8;">⚠️ ${currentAwak}각성 정보없음 (기본 능력)</span></div>`;
          }
        }

        const abilitiesHtml = displayAbilities.map(line => {
          const highlighted = line.replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');
          return `<div class="ability-line ${isAwakenedVariant ? 'awakening-changed' : ''}">${highlighted}</div>`;
        }).join('');

        let statsChipsHtml = '';
        if (item.stats) {
          const chips = [];
          Object.entries(item.stats).forEach(([k, vals]) => {
            let v = vals[currentAwak];
            if (v === null || v === undefined) {
              for (let lv = currentAwak; lv >= 0; lv--) {
                if (vals[lv] !== null && vals[lv] !== undefined) { v = vals[lv]; break; }
              }
            }
            if (v !== null && v !== undefined && rawItemData.statDefs[k]) {
              const def = rawItemData.statDefs[k];
              chips.push(`<span class="stat-chip">${def.label}: <b>+${v}${def.unit}</b></span>`);
            }
          });
          if (chips.length > 0) statsChipsHtml = `<div class="card-stats-row">${chips.slice(0, 3).join('')}</div>`;
        }

        const dropsHtml = (item.drops || []).map(d => `<span class="drop-item">${d}</span>`).join('');

        return `
          <div class="item-card" data-item-id="${item.id}">
            <div class="card-header">
              <div class="card-img-wrapper">${imgHtml}</div>
              <div class="card-title-area">
                <div class="card-name-row">
                  <span class="card-name" title="${item.name}">${item.name}</span>
                  ${tierBadge}
                  ${usageBadge}
                </div>
                <div class="card-subinfo">
                  ${rangeBadge}
                  ${item.aliases && item.aliases.length ? `<span class="card-aliases">(${item.aliases.join(', ')})</span>` : ''}
                </div>
              </div>
            </div>
            <div class="card-abilities">
              ${noAwakeningNotice}
              ${abilitiesHtml}
            </div>
            ${statsChipsHtml}
            <div class="card-footer">
              <div class="card-drops">${dropsHtml || '-'}</div>
              <span style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 700;">상세보기 ❯</span>
            </div>
          </div>
        `;
      }).join('');

      elItemsGrid.innerHTML = `<div class="items-grid">${cardsHtml}</div>`;
    } else {
      const rowsHtml = items.map(item => {
        const imgHtml = item.img
          ? `<img src="${item.img}" alt="${item.name}" class="table-thumb-img" loading="lazy">`
          : `<div class="table-thumb-placeholder">⚔️</div>`;

        const rangeBadge = item.range
          ? `<span class="badge-tag badge-range ${item.range}">${item.range}</span>` : '-';
        const tierBadge = item.tier
          ? `<span class="tier-badge tier-${item.tier}">${item.grade || item.tier}</span>` : '-';
        const usageBadge = item.usage
          ? `<span class="usage-badge usage-${item.usage}">${item.usageLabel || item.usage}</span>` : '-';

        let displayAbilities = item.abilities || [];
        let isAwakenedVariant = false;
        let noAwakeningNotice = '';

        if (currentAwak > 0) {
          if (item.awakening && item.awakening[currentAwak]) {
            displayAbilities = item.awakening[currentAwak];
            isAwakenedVariant = true;
          } else if (item.awakeningNote) {
            noAwakeningNotice = `<div style="color: var(--accent-gold); font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">${item.awakeningNote}</div>`;
          } else {
            noAwakeningNotice = `<div style="color: var(--text-dim); font-size: 0.8rem; margin-bottom: 0.25rem;">⚠️ ${currentAwak}각성 정보없음 (기본 능력)</div>`;
          }
        }

        const abilitiesHtml = displayAbilities.map(line => {
          const highlighted = line.replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');
          return `<div style="${isAwakenedVariant ? 'color: #1d4ed8; font-weight: 600;' : ''}">${highlighted}</div>`;
        }).join('');

        let statsChipsHtml = '';
        if (item.stats) {
          const chips = [];
          Object.entries(item.stats).forEach(([k, vals]) => {
            let v = vals[currentAwak];
            if (v === null || v === undefined) {
              for (let lv = currentAwak; lv >= 0; lv--) {
                if (vals[lv] !== null && vals[lv] !== undefined) { v = vals[lv]; break; }
              }
            }
            if (v !== null && v !== undefined && rawItemData.statDefs[k]) {
              const def = rawItemData.statDefs[k];
              chips.push(`<span class="stat-chip">${def.label}: <b>+${v}${def.unit}</b></span>`);
            }
          });
          if (chips.length > 0) statsChipsHtml = chips.slice(0, 3).join('');
        }

        const dropsHtml = (item.drops || []).map(d => `<span class="drop-item">${d}</span>`).join('');

        return `
          <tr class="data-row item-row" data-item-id="${item.id}">
            <td style="width: 58px; text-align: center;">
              <div class="table-thumb-wrapper">${imgHtml}</div>
            </td>
            <td>
              <div class="table-item-name">${item.name}</div>
              ${item.aliases && item.aliases.length ? `<div class="table-item-aliases">${item.aliases.join(', ')}</div>` : ''}
            </td>
            <td style="text-align: center;">${tierBadge}</td>
            <td style="text-align: center;">${usageBadge}</td>
            <td style="text-align: center;">${rangeBadge}</td>
            <td class="table-ability-block">
              ${noAwakeningNotice}
              ${abilitiesHtml}
            </td>
            <td>${statsChipsHtml || '-'}</td>
            <td>${dropsHtml || '-'}</td>
          </tr>
        `;
      }).join('');

      elItemsGrid.innerHTML = `
        <div class="data-table-card">
          <div class="data-table-wrapper">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th style="width: 58px; text-align: center;">사진</th>
                  ${renderTh('name', '아이템명', 'min-width: 140px;')}
                  ${renderTh('tier', '티어', 'width: 80px; text-align: center;', true)}
                  ${renderTh('usage', '용도', 'width: 80px; text-align: center;', true)}
                  ${renderTh('range', '사거리', 'width: 85px; text-align: center;', true)}
                  <th style="min-width: 280px;">능력 및 ${currentAwak > 0 ? currentAwak + '각성 효과' : '기본 효과'}</th>
                  <th style="min-width: 160px;">주요 수치</th>
                  ${renderTh('drops', '드랍처', 'min-width: 130px;')}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    elItemsGrid.querySelectorAll('.item-row, .item-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-item-id');
        const it = rawItemData.items.find(x => x.id === id);
        if (it) openItemModal(it);
      });
    });
  }

  // -------------------------------------------------------------
  // 2. RENDER HEROES (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderHeroesView() {
    if (!expansionData || !expansionData.heroes) return;

    let heroes = expansionData.heroes;
    if (searchEngine) {
      heroes = searchEngine.searchHeroes(heroes, {
        query: state.query,
        tier: state.heroTier,
        grade: state.heroGrade,
      });
    }

    const hl = state.heroLevel;
    const curSort = tabSortState.heroes;
    heroes = sortHeroesList(heroes, curSort.col, curSort.dir, hl);

    elResultCount.textContent = heroes.length;

    if (heroes.length === 0) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🦸</div>
          <div class="empty-title">일치하는 영웅이 없습니다.</div>
          <p>검색어나 티어 필터를 변경해보세요.</p>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'card') {
      const cardsHtml = heroes.map(hero => {
        const imgHtml = hero.img
          ? `<img src="${hero.img}" alt="${hero.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🦸</div>`;

        const tierBadge = hero.tier
          ? `<span class="tier-badge tier-${hero.tier}">${hero.tier}</span>` : '';
        const gradeBadge = hero.grade
          ? `<span class="badge-tag">${hero.grade}</span>` : '';

        let extraHtml = '';
        if (hl !== 'base') {
          const lvInfo = hero.levels ? (hero.levels[hl] || (hl === '15' ? (hero.levels['16'] || hero.levels['17'] || hero.levels['18']) : null)) : null;
          if (lvInfo) {
            const filledStars = (lvInfo.stars || '').replace(/[^★]/g, '');
            const starsBadge = filledStars
              ? `<span style="color: #d97706; font-size: 0.88rem; font-weight: 800; letter-spacing: 1px;">${filledStars}</span>`
              : '';

            extraHtml = `
              <div class="ability-line awakening-changed">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
                  <b>${lvInfo.level}레벨 능력</b>
                  ${starsBadge}
                </div>
                <div>${lvInfo.ability}</div>
              </div>
            `;
          }
        }

        return `
          <div class="item-card hero-card" data-hero-id="${hero.id}">
            <div class="card-header">
              <div class="card-img-wrapper">${imgHtml}</div>
              <div class="card-title-area">
                <div class="card-name-row">
                  <span class="card-name">${hero.name}</span>
                  ${tierBadge}
                  ${gradeBadge}
                </div>
                ${hero.aliases && hero.aliases.length ? `<div class="card-aliases">별칭: ${hero.aliases.join(', ')}</div>` : ''}
              </div>
            </div>
            <div class="card-abilities">
              <div class="ability-line">
                <b style="color: var(--accent-secondary);">기본 능력:</b> ${hero.ability || '정보 없음'}
              </div>
              ${extraHtml}
            </div>
            ${hero.comment ? `
              <div style="font-size: 0.82rem; color: var(--text-muted); background: #f8fafc; padding: 0.5rem 0.65rem; border-radius: 6px; border-left: 3px solid var(--accent-primary); line-height: 1.45;">
                ${hero.comment}
              </div>
            ` : ''}
            <div class="card-footer">
              <span style="font-size: 0.78rem; color: var(--text-dim);">${hero.grade} 등급 영웅</span>
              <span style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 700;">상세보기 ❯</span>
            </div>
          </div>
        `;
      }).join('');

      elItemsGrid.innerHTML = `<div class="items-grid">${cardsHtml}</div>`;
    } else {
      const rowsHtml = heroes.map(hero => {
        const imgHtml = hero.img
          ? `<img src="${hero.img}" alt="${hero.name}" class="table-thumb-img" loading="lazy">`
          : `<div class="table-thumb-placeholder">🦸</div>`;

        const tierBadge = hero.tier
          ? `<span class="tier-badge tier-${hero.tier}">${hero.tier}</span>` : '-';
        const gradeBadge = hero.grade
          ? `<span class="badge-tag">${hero.grade}</span>` : '-';

        let extraHtml = '-';
        let starsHtml = '-';

        if (hl !== 'base') {
          const lvInfo = hero.levels ? (hero.levels[hl] || (hl === '15' ? (hero.levels['16'] || hero.levels['17'] || hero.levels['18']) : null)) : null;
          if (lvInfo) {
            extraHtml = `<div style="color: #1d4ed8; font-weight: 600; line-height: 1.45;">${lvInfo.ability}</div>`;
            const filledStars = (lvInfo.stars || '').replace(/[^★]/g, '');
            if (filledStars) {
              starsHtml = `<span style="color: #d97706; font-size: 0.95rem; font-weight: 800; letter-spacing: 1px;">${filledStars}</span>`;
            }
          } else {
            extraHtml = `<span style="color: var(--text-dim); font-size: 0.8rem;">해당 레벨 능력 없음</span>`;
          }
        }

        return `
          <tr class="data-row hero-row" data-hero-id="${hero.id}">
            <td style="width: 58px; text-align: center;">
              <div class="table-thumb-wrapper">${imgHtml}</div>
            </td>
            <td>
              <div class="table-item-name">${hero.name}</div>
              ${hero.aliases && hero.aliases.length ? `<div class="table-item-aliases">${hero.aliases.join(', ')}</div>` : ''}
            </td>
            <td style="text-align: center;">${tierBadge}</td>
            <td style="text-align: center; white-space: nowrap;">${starsHtml}</td>
            <td style="text-align: center;">${gradeBadge}</td>
            <td class="table-ability-block">${hero.ability || '정보 없음'}</td>
            <td class="table-ability-block">${extraHtml}</td>
            <td style="font-size: 0.82rem; color: #475569; max-width: 200px; line-height: 1.45;">
              ${hero.comment || '-'}
            </td>
          </tr>
        `;
      }).join('');

      elItemsGrid.innerHTML = `
        <div class="data-table-card">
          <div class="data-table-wrapper">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th style="width: 58px; text-align: center;">사진</th>
                  ${renderTh('name', '영웅명', 'min-width: 130px;')}
                  ${renderTh('tier', '티어', 'width: 80px; text-align: center;', true)}
                  ${renderTh('stars', '추천', 'width: 90px; text-align: center;', true)}
                  ${renderTh('grade', '등급', 'width: 80px; text-align: center;', true)}
                  <th style="min-width: 250px;">기본 고유 능력</th>
                  <th style="min-width: 250px;">선택 레벨(${hl === 'base' ? '추가' : hl + '레벨'}) 능력</th>
                  <th style="min-width: 160px;">평가 & 코멘트</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    elItemsGrid.querySelectorAll('.hero-row, .hero-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-hero-id');
        const h = expansionData.heroes.find(x => x.id === id);
        if (h) openHeroModal(h);
      });
    });
  }

  // -------------------------------------------------------------
  // 3. RENDER MERCENARIES (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderMercenariesView() {
    if (!expansionData || !expansionData.mercenaries) return;

    let mercs = expansionData.mercenaries;
    if (searchEngine) {
      mercs = searchEngine.searchMercenaries(mercs, {
        query: state.query,
        grade: state.mercGrade,
        recommend: state.mercRec,
      });
    }

    const currentTier = state.mercTier;
    const curSort = tabSortState.mercenaries;
    mercs = sortMercenariesList(mercs, curSort.col, curSort.dir, currentTier);

    elResultCount.textContent = mercs.length;

    if (mercs.length === 0) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-title">일치하는 지원용병이 없습니다.</div>
          <p>검색어나 추천 등급 필터를 변경해보세요.</p>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'card') {
      const cardsHtml = mercs.map(merc => {
        const imgHtml = merc.img
          ? `<img src="${merc.img}" alt="${merc.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🛡️</div>`;

        const gradeBadge = `<span class="badge-tag">${merc.grade}</span>`;
        const recBadge = merc.recommend
          ? `<span class="usage-badge usage-${merc.recommend}">${merc.recommend}</span>` : '';

        const tierVal = merc.tierValues ? merc.tierValues[currentTier] : null;
        const abilityText = formatMercAbility(merc.ability, tierVal);
        const buffValText = formatMercBuffValue(merc.ability, tierVal);

        return `
          <div class="item-card merc-card" data-merc-id="${merc.id}">
            <div class="card-header">
              <div class="card-img-wrapper">${imgHtml}</div>
              <div class="card-title-area">
                <div class="card-name-row">
                  <span class="card-name">${merc.name}</span>
                  ${recBadge}
                  ${gradeBadge}
                </div>
                <div class="card-subinfo">
                  <span>버프 수치: <b style="color: #2563eb;">${buffValText}</b></span>
                  <span style="margin-left: 0.5rem; color: var(--text-dim);">(${getMercLevelReq(currentTier)})</span>
                </div>
              </div>
            </div>
            <div class="card-abilities">
              <div class="ability-line">
                ${abilityText}
              </div>
            </div>
            <div class="card-footer">
              <span style="font-size: 0.78rem; color: var(--text-dim);">${currentTier} 등급</span>
              <span style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 700;">상세보기 ❯</span>
            </div>
          </div>
        `;
      }).join('');

      elItemsGrid.innerHTML = `<div class="items-grid">${cardsHtml}</div>`;
    } else {
      const rowsHtml = mercs.map(merc => {
        const imgHtml = merc.img
          ? `<img src="${merc.img}" alt="${merc.name}" class="table-thumb-img" loading="lazy">`
          : `<div class="table-thumb-placeholder">🛡️</div>`;

        const gradeBadge = `<span class="badge-tag">${merc.grade}</span>`;
        const recBadge = merc.recommend
          ? `<span class="usage-badge usage-${merc.recommend}">${merc.recommend}</span>` : '-';

        const tierVal = merc.tierValues ? merc.tierValues[currentTier] : null;
        const abilityText = formatMercAbility(merc.ability, tierVal);
        const buffValText = formatMercBuffValue(merc.ability, tierVal);

        return `
          <tr class="data-row merc-row" data-merc-id="${merc.id}">
            <td style="width: 58px; text-align: center;">
              <div class="table-thumb-wrapper">${imgHtml}</div>
            </td>
            <td>
              <div class="table-item-name">${merc.name}</div>
            </td>
            <td style="text-align: center;">${gradeBadge}</td>
            <td style="text-align: center;">${recBadge}</td>
            <td style="text-align: center;">
              <span style="font-weight: 800; color: #2563eb; font-size: 0.95rem;">
                ${buffValText}
              </span>
            </td>
            <td class="table-ability-block">${abilityText}</td>
            <td style="text-align: center; font-size: 0.8rem; color: #64748b;">
              ${getMercLevelReq(currentTier)}
            </td>
          </tr>
        `;
      }).join('');

      elItemsGrid.innerHTML = `
        <div class="data-table-card">
          <div class="data-table-wrapper">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th style="width: 58px; text-align: center;">사진</th>
                  ${renderTh('name', '용병명', 'min-width: 130px;')}
                  ${renderTh('grade', '기본 등급', 'width: 85px; text-align: center;', true)}
                  ${renderTh('recommend', '추천도', 'width: 85px; text-align: center;', true)}
                  ${renderTh('buff', `선택 (${currentTier}) 버프`, 'width: 125px; text-align: center;', true)}
                  <th style="min-width: 280px;">고유 능력</th>
                  ${renderTh('level', '필요 레벨', 'width: 90px; text-align: center;', true)}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    elItemsGrid.querySelectorAll('.merc-row, .merc-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-merc-id');
        const m = expansionData.mercenaries.find(x => x.id === id);
        if (m) openMercModal(m);
      });
    });
  }

  function getMercLevelReq(tier) {
    const map = { B: '5렙', A: '9렙', S: '13렙', SS: '17렙', SSS: '20렙' };
    return map[tier] || '';
  }

  function formatMercAbility(ability, tierVal) {
    if (!ability) return '';
    let text = ability;

    text = text.replace(/영웅이 공격할 때 공격할 때/g, '영웅이 공격할 때')
               .replace(/1%의 확률로 세 번/g, 'N%의 확률로 세 번')
               .replace(/공격할 때 1%의 확률로/g, '공격할 때 N%의 확률로');

    if (tierVal === null || tierVal === undefined) {
      return text.replace(/\bN%\b/g, 'N%').replace(/\bN\b/g, 'N');
    }

    if (text.includes('1+N배')) {
      return text.replace('1+N배', `<b class="stat-number">${tierVal}배</b>`);
    }
    if (text.includes('N배')) {
      return text.replace('N배', `<b class="stat-number">${tierVal}배</b>`);
    }
    if (text.includes('N개')) {
      return text.replace('N개', `<b class="stat-number">${tierVal}개</b>`);
    }
    if (text.includes('N 증가') || text.includes('N 상승')) {
      return text.replace(/N(?=\s*(증가|상승))/, `<b class="stat-number">+${tierVal}</b>`);
    }
    if (text.includes('N%')) {
      if (/N%(의\s*확률|\s*확률)/.test(text)) {
        return text.replace(/N%(?=(\s*의)?\s*확률)/, `<b class="stat-number">${tierVal}%</b>`);
      }
      return text.replace('N%', `<b class="stat-number">+${tierVal}%</b>`);
    }

    return text.replace(/\bN\b/g, `<b class="stat-number">+${tierVal}%</b>`);
  }

  function formatMercBuffValue(ability, tierVal) {
    if (tierVal === null || tierVal === undefined || tierVal === '-') return '-';
    const text = ability || '';
    if (text.includes('1+N배') || text.includes('N배')) return `${tierVal}배`;
    if (text.includes('N개')) return `${tierVal}개`;
    if (text.includes('N 증가') || text.includes('N 상승')) return `+${tierVal}`;
    if (/N%(의\s*확률|\s*확률)/.test(text) || text.includes('세 번 공격')) return `${tierVal}%`;
    return `+${tierVal}%`;
  }

  // -------------------------------------------------------------
  // 4. RENDER MOUNTS (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderMountsView() {
    if (!expansionData || !expansionData.mounts) return;

    let mounts = expansionData.mounts;
    if (searchEngine) {
      mounts = searchEngine.searchMounts(mounts, { query: state.query });
    }

    const curSort = tabSortState.mounts;
    mounts = sortMountsList(mounts, curSort.col, curSort.dir);

    elResultCount.textContent = mounts.length;

    if (mounts.length === 0) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐎</div>
          <div class="empty-title">일치하는 탈것이 없습니다.</div>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'card') {
      const cardsHtml = mounts.map(mount => {
        const imgHtml = mount.img
          ? `<img src="${mount.img}" alt="${mount.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🐎</div>`;

        const abilHighlighted = (mount.ability || '')
          .replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');

        return `
          <div class="item-card mount-card">
            <div class="card-header">
              <div class="card-img-wrapper">${imgHtml}</div>
              <div class="card-title-area">
                <div class="card-name-row">
                  <span class="card-name">${mount.name}</span>
                  <span class="badge-tag" style="font-family: monospace;">#${String(mount.no).padStart(2, '0')}</span>
                </div>
              </div>
            </div>
            <div class="card-abilities">
              <div class="ability-line">
                <b style="color: var(--accent-secondary);">고유 능력:</b><br>${abilHighlighted}
              </div>
            </div>
            ${mount.comment ? `
              <div style="font-size: 0.82rem; color: var(--text-muted); background: #f8fafc; padding: 0.5rem 0.65rem; border-radius: 6px; border-left: 3px solid var(--accent-gold); line-height: 1.45;">
                ${mount.comment}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      elItemsGrid.innerHTML = `<div class="items-grid">${cardsHtml}</div>`;
    } else {
      const rowsHtml = mounts.map(mount => {
        const imgHtml = mount.img
          ? `<img src="${mount.img}" alt="${mount.name}" class="table-thumb-img" loading="lazy">`
          : `<div class="table-thumb-placeholder">🐎</div>`;

        const abilHighlighted = (mount.ability || '')
          .replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');

        return `
          <tr class="data-row mount-row">
            <td style="width: 58px; text-align: center;">
              <div class="table-thumb-wrapper">${imgHtml}</div>
            </td>
            <td style="text-align: center;">
              <span class="badge-tag" style="font-family: monospace; font-size: 0.8rem;">#${String(mount.no).padStart(2, '0')}</span>
            </td>
            <td>
              <div class="table-item-name">${mount.name}</div>
            </td>
            <td class="table-ability-block">${abilHighlighted}</td>
            <td style="font-size: 0.83rem; color: #475569; line-height: 1.45;">
              ${mount.comment || '-'}
            </td>
          </tr>
        `;
      }).join('');

      elItemsGrid.innerHTML = `
        <div class="data-table-card">
          <div class="data-table-wrapper">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th style="width: 58px; text-align: center;">사진</th>
                  ${renderTh('no', '번호', 'width: 75px; text-align: center;', true)}
                  ${renderTh('name', '탈것 이름', 'min-width: 140px;')}
                  <th style="min-width: 280px;">고유 능력</th>
                  <th style="min-width: 220px;">유저 평가 & 코멘트</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // -------------------------------------------------------------
  // MODALS
  // -------------------------------------------------------------
  function openItemModal(item) {
    const currentAwak = state.awakeningLevel;
    const imgHtml = item.img
      ? `<img src="${item.img}" alt="${item.name}" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover;">`
      : `<div style="font-size: 2.5rem;">⚔️</div>`;

    const hasAnyAwakening = (item.awakening && Object.keys(item.awakening).length > 0) || !!item.awakeningNote;
    let awakeningSectionHtml = '';

    if (!hasAnyAwakening) {
      awakeningSectionHtml = `
        <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          <div style="font-size: 1.6rem; margin-bottom: 0.35rem;">ℹ️</div>
          각성 정보가 없습니다.
        </div>
      `;
    } else {
      let tableRows = '';
      for (let lv = 1; lv <= 5; lv++) {
        const lines = item.awakening && item.awakening[lv];
        const isCurrent = lv === currentAwak;
        let text = '';
        if (lines && lines.length) {
          text = lines.join('<br>');
        } else if (item.awakeningNote) {
          text = `<span style="color: var(--accent-gold);">${item.awakeningNote}</span>`;
        } else {
          text = `<span style="color: var(--text-dim);">각성 정보가 없습니다.</span>`;
        }
        tableRows += `<tr class="${isCurrent ? 'highlighted' : ''}"><th>${lv}각성</th><td>${text}</td></tr>`;
      }
      awakeningSectionHtml = `<table class="awakening-table"><tbody>${tableRows}</tbody></table>`;
    }

    const dropsHtml = (item.drops || []).map(d => `<span class="drop-item" style="cursor: pointer;" onclick="window.filterByDrop('${d}')">${d} 🔍</span>`).join('');

    elModalContent.innerHTML = `
      <div class="modal-header" data-modal-item-id="${item.id}">
        <div style="display: flex; gap: 1rem; align-items: center;">
          ${imgHtml}
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">${item.name}</h2>
              ${item.tier ? `<span class="tier-badge tier-${item.tier}">${item.grade || item.tier}</span>` : ''}
              ${item.usage ? `<span class="usage-badge usage-${item.usage}">${item.usageLabel || item.usage}</span>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem; font-size: 0.85rem; color: var(--text-muted);">
              ${item.range ? `<span class="badge-tag badge-range ${item.range}">${item.range}</span>` : ''}
              ${item.aliases && item.aliases.length ? `<span>별칭: ${item.aliases.join(', ')}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 0.5rem;">기본 능력 (0각성)</h4>
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            ${item.abilities.map(a => `<div class="ability-line">${a}</div>`).join('')}
          </div>
        </div>
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-gold);">각성 단계별 변화</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">현재 선택: ${currentAwak}각성</span>
          </div>
          ${awakeningSectionHtml}
        </div>
        ${item.comment ? `
          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">공략 코멘트</h4>
            <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-left: 3px solid var(--accent-primary); padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.875rem; color: var(--text-main);">
              ${item.comment}
            </div>
          </div>
        ` : ''}
        <div>
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">획득처 / 드랍</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">${dropsHtml || '획득처 정보 없음'}</div>
        </div>
      </div>
    `;

    showModal();
  }

  function openHeroModal(hero) {
    const imgHtml = hero.img
      ? `<img src="${hero.img}" alt="${hero.name}" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover;">`
      : `<div style="font-size: 2.5rem;">🦸</div>`;

    let levelRows = '';
    const sortedLevels = Object.values(hero.levels || {}).sort((a, b) => a.level - b.level);
    sortedLevels.forEach(lv => {
      const filledStars = (lv.stars || '').replace(/[^★]/g, '');
      const starsBadge = filledStars
        ? `<span style="color: #d97706; font-size: 0.88rem; font-weight: 800; letter-spacing: 1px;">${filledStars}</span>`
        : '';

      levelRows += `
        <tr>
          <th>${lv.level}레벨</th>
          <td>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.35rem;">
              <span>${lv.ability}</span>
              ${starsBadge}
            </div>
          </td>
        </tr>
      `;
    });

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; gap: 1rem; align-items: center;">
          ${imgHtml}
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">${hero.name}</h2>
              ${hero.tier ? `<span class="tier-badge tier-${hero.tier}">${hero.tier}</span>` : ''}
              <span class="badge-tag">${hero.grade}</span>
            </div>
            ${hero.aliases && hero.aliases.length ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.3rem;">별칭: ${hero.aliases.join(', ')}</div>` : ''}
          </div>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 0.4rem;">기본 고유 능력</h4>
          <div class="ability-line">${hero.ability || '기본 능력 정보 없음'}</div>
        </div>
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 0.4rem;">레벨별 추가 능력 & 평가</h4>
          <table class="awakening-table">
            <tbody>
              ${levelRows || '<tr><td colspan="2" style="text-align: center; color: var(--text-dim);">레벨 정보가 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
        ${hero.comment ? `
          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">영덱 공략 & 평가 코멘트</h4>
            <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-left: 3px solid var(--accent-primary); padding: 0.75rem 0.9rem; border-radius: 6px; font-size: 0.875rem; line-height: 1.6; color: var(--text-main);">
              ${hero.comment}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    showModal();
  }

  function openMercModal(merc) {
    const imgHtml = merc.img
      ? `<img src="${merc.img}" alt="${merc.name}" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover;">`
      : `<div style="font-size: 2.5rem;">🛡️</div>`;

    const tiers = ['B', 'A', 'S', 'SS', 'SSS'];
    const reqs = ['5레벨', '9레벨', '13레벨', '17레벨', '20레벨'];
    let rows = '';

    tiers.forEach((t, i) => {
      const val = merc.tierValues ? merc.tierValues[t] : '-';
      const buffVal = formatMercBuffValue(merc.ability, val);
      rows += `
        <tr>
          <th>${t} 등급<br><span style="font-size: 0.7rem; color: var(--text-dim); font-weight: 400;">(${reqs[i]})</span></th>
          <td style="font-weight: 700; color: var(--accent-secondary); font-size: 1rem;">
            ${buffVal}
          </td>
        </tr>
      `;
    });

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; gap: 1rem; align-items: center;">
          ${imgHtml}
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">${merc.name}</h2>
              ${merc.recommend ? `<span class="usage-badge usage-${merc.recommend}">${merc.recommend}</span>` : ''}
              <span class="badge-tag">${merc.grade}</span>
            </div>
          </div>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 0.4rem;">버프 능력</h4>
          <div class="ability-line">${formatMercAbility(merc.ability, null)}</div>
        </div>
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 0.4rem;">등급별 수치 상세 (필요 레벨)</h4>
          <table class="awakening-table">
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    showModal();
  }

  function openMountGuideModal() {
    const rawSub = (expansionData && expansionData.mountSubOptions) || {};
    const towerList = Array.isArray(rawSub.tower) ? rawSub.tower : [];
    const heroList = Array.isArray(rawSub.hero) ? rawSub.hero : [];
    const commonList = Array.isArray(rawSub.common) ? rawSub.common : [];

    function renderBadge(rng) {
      if (!rng) return '-';
      if (rng === '4') {
        return `<span class="subopt-badge rank-special">★ 4강 전용</span>`;
      } else if (rng === '3~4' || rng === '2~4') {
        return `<span class="subopt-badge rank-mid">${rng}강</span>`;
      }
      return `<span class="subopt-badge rank-all">${rng}강</span>`;
    }

    function renderTableRows(items) {
      if (!items || !items.length) {
        return `<tr><td colspan="3" style="text-align: center; color: var(--text-dim); padding: 1rem;">등록된 옵션 정보가 없습니다.</td></tr>`;
      }
      return items.map(item => {
        const highlightedName = item.name.replace(/(\d+(?:\.\d+)?%?)/g, '<b class="stat-number">$1</b>');
        return `
          <tr>
            <td style="width: 50px; text-align: center; font-weight: 700; color: var(--text-dim); font-size: 0.8rem;">#${item.no}</td>
            <td style="font-size: 0.875rem; color: var(--text-main); line-height: 1.45;">${highlightedName}</td>
            <td style="width: 95px; text-align: center;">${renderBadge(item.range)}</td>
          </tr>
        `;
      }).join('');
    }

    const towerRows = renderTableRows(towerList);
    const heroRows = renderTableRows(heroList);
    const commonRows = renderTableRows(commonList);

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="font-size: 2rem;">🐎</div>
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">탈것 합성법 & 부옵션 가이드</h2>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">총 30종 부옵션 (타워 / 영웅 / 공통) 및 강화 단계 정보</div>
          </div>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body" style="gap: 1.25rem;">
        <!-- Synthesis Card -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-glass);">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>▶</span> 탈것 합성 & 부옵션 활성화 규칙
          </h4>
          <ul style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.25rem;">
            <li>같은 종류 <b>신급 펫 2개</b> = <b>일반 등급 탈것 1개</b></li>
            <li>같은 종류 <b>동일 등급 일반 탈것 2개</b> = <b>상위 등급 탈것 1개</b></li>
            <li>등급 단계: 일반(4강) ➔ 레어(8강) ➔ 유니크(12강) ➔ 엘리트(16강) ➔ 미스테리(20강) ➔ 에픽(24강) ➔ 전설(28강) ➔ 신화(32강)</li>
            <li><b style="color: var(--accent-gold);">★ 미스테리 등급(20강)부터 부옵션 +1강 활성화</b> (강화 레벨 x 10 푸른다이아 소모)</li>
          </ul>
        </div>

        <!-- Sub-options 3-Category Nav -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-gold);">▶ 부옵션 분류 선택</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">총 30개 옵션</span>
          </div>
          <div class="subopt-nav" id="suboptNav">
            <button class="subopt-tab active" data-subtab="all">📋 전체 3개 카테고리 (30)</button>
            <button class="subopt-tab" data-subtab="tower">🏹 타워 관련 (${towerList.length})</button>
            <button class="subopt-tab" data-subtab="hero">🦸 영웅 관련 (${heroList.length})</button>
            <button class="subopt-tab" data-subtab="common">⚔️ 타워 · 영웅 공통 (${commonList.length})</button>
          </div>
        </div>

        <!-- 1. 타워 관련 섹션 -->
        <div class="subopt-section" id="subSectionTower">
          <div class="subopt-section-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">🏹</span>
              <span style="font-weight: 800; color: #00f5d4; font-size: 1rem;">1. 타워 관련 부옵션</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${towerList.length}개 항목</span>
          </div>
          <table class="awakening-table" style="margin-top: 0;">
            <thead>
              <tr style="background: rgba(0, 245, 212, 0.08);">
                <th style="width: 50px;">번호</th>
                <th>옵션 내용</th>
                <th style="width: 95px;">변동옵</th>
              </tr>
            </thead>
            <tbody>
              ${towerRows}
            </tbody>
          </table>
        </div>

        <!-- 2. 영웅 관련 섹션 -->
        <div class="subopt-section" id="subSectionHero">
          <div class="subopt-section-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">🦸</span>
              <span style="font-weight: 800; color: #c77dff; font-size: 1rem;">2. 영웅 관련 부옵션</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${heroList.length}개 항목</span>
          </div>
          <table class="awakening-table" style="margin-top: 0;">
            <thead>
              <tr style="background: rgba(157, 78, 221, 0.1);">
                <th style="width: 50px;">번호</th>
                <th>옵션 내용</th>
                <th style="width: 95px;">변동옵</th>
              </tr>
            </thead>
            <tbody>
              ${heroRows}
            </tbody>
          </table>
        </div>

        <!-- 3. 타워 · 영웅 공통 섹션 -->
        <div class="subopt-section" id="subSectionCommon">
          <div class="subopt-section-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">⚔️</span>
              <span style="font-weight: 800; color: #ffd166; font-size: 1rem;">3. 타워 · 영웅 공통 부옵션</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${commonList.length}개 항목</span>
          </div>
          <table class="awakening-table" style="margin-top: 0;">
            <thead>
              <tr style="background: rgba(255, 209, 102, 0.1);">
                <th style="width: 50px;">번호</th>
                <th>옵션 내용</th>
                <th style="width: 95px;">변동옵</th>
              </tr>
            </thead>
            <tbody>
              ${commonRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind category filter tabs
    const subTabs = elModalContent.querySelectorAll('.subopt-tab');
    const secTower = elModalContent.querySelector('#subSectionTower');
    const secHero = elModalContent.querySelector('#subSectionHero');
    const secCommon = elModalContent.querySelector('#subSectionCommon');

    subTabs.forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.getAttribute('data-subtab');
        subTabs.forEach(t => t.classList.toggle('active', t === tabBtn));

        if (target === 'all') {
          secTower.style.display = 'block';
          secHero.style.display = 'block';
          secCommon.style.display = 'block';
        } else if (target === 'tower') {
          secTower.style.display = 'block';
          secHero.style.display = 'none';
          secCommon.style.display = 'none';
        } else if (target === 'hero') {
          secTower.style.display = 'none';
          secHero.style.display = 'block';
          secCommon.style.display = 'none';
        } else if (target === 'common') {
          secTower.style.display = 'none';
          secHero.style.display = 'none';
          secCommon.style.display = 'block';
        }
      });
    });

    showModal();
  }

  // -------------------------------------------------------------
  // 5. RENDER PETS (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderPetsView() {
    if (!expansionData || !expansionData.pets) return;
    let pets = searchEngine
      ? searchEngine.searchPets(expansionData.pets, {
        query: state.query,
        tier: state.petTier,
        drop: state.petDrop,
      })
      : expansionData.pets;

    const curSort = tabSortState.pets;
    pets = sortPetsList(pets, curSort.col, curSort.dir);

    elResultCount.textContent = pets.length;

    if (pets.length === 0) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐾</div>
          <div class="empty-title">일치하는 펫이 없습니다.</div>
          <p>검색어나 티어, 드랍처 조건을 변경해보세요.</p>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'card') {
      const cardsHtml = pets.map(pet => {
        const imgHtml = pet.img
          ? `<img src="${pet.img}" alt="${pet.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🐾</div>`;

        const tierChar = (pet.tier || 'F').charAt(0);
        const tierBadge = `<span class="tier-badge tier-${tierChar}">${pet.tier}</span>`;
        const noBadge = `<span class="badge-tag" style="font-family: monospace; font-size: 0.8rem;">#${String(pet.no).padStart(2, '0')}</span>`;

        const abilHighlighted = (pet.ability || '')
          .replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');

        const dropsHtml = (pet.drops || [])
          .map(d => `<span class="drop-item">📍 ${d}</span>`)
          .join('');

        return `
          <div class="item-card pet-card" data-pet-id="${pet.id}">
            <div class="card-header">
              <div class="card-img-wrapper">${imgHtml}</div>
              <div class="card-title-area">
                <div class="card-name-row">
                  <span class="card-name">${pet.name}</span>
                  ${tierBadge}
                  ${noBadge}
                </div>
              </div>
            </div>
            <div class="card-abilities">
              <div class="ability-line">
                ${abilHighlighted}
              </div>
            </div>
            <div class="card-footer">
              <div class="card-drops">${dropsHtml || '-'}</div>
              <span style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 700;">상세보기 ❯</span>
            </div>
          </div>
        `;
      }).join('');

      elItemsGrid.innerHTML = `<div class="items-grid">${cardsHtml}</div>`;
    } else {
      const rowsHtml = pets.map(pet => {
        const imgHtml = pet.img
          ? `<img src="${pet.img}" alt="${pet.name}" class="table-thumb-img" loading="lazy">`
          : `<div class="table-thumb-placeholder">🐾</div>`;

        const tierChar = (pet.tier || 'F').charAt(0);
        const tierBadge = `<span class="tier-badge tier-${tierChar}">${pet.tier}</span>`;
        const noBadge = `<span class="badge-tag" style="font-family: monospace; font-size: 0.8rem;">#${String(pet.no).padStart(2, '0')}</span>`;

        const abilHighlighted = (pet.ability || '')
          .replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');

        const dropsHtml = (pet.drops || [])
          .map(d => `<span class="drop-item">📍 ${d}</span>`)
          .join('');

        return `
          <tr class="data-row pet-row" data-pet-id="${pet.id}">
            <td style="width: 58px; text-align: center;">
              <div class="table-thumb-wrapper">${imgHtml}</div>
            </td>
            <td style="text-align: center;">${noBadge}</td>
            <td>
              <div class="table-item-name">${pet.name}</div>
            </td>
            <td style="text-align: center;">${tierBadge}</td>
            <td class="table-ability-block">${abilHighlighted}</td>
            <td>${dropsHtml || '-'}</td>
          </tr>
        `;
      }).join('');

      elItemsGrid.innerHTML = `
        <div class="data-table-card">
          <div class="data-table-wrapper">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th style="width: 58px; text-align: center;">사진</th>
                  ${renderTh('no', '도감 No', 'width: 80px; text-align: center;', true)}
                  ${renderTh('name', '펫 이름', 'min-width: 140px;')}
                  ${renderTh('tier', '티어', 'width: 80px; text-align: center;', true)}
                  <th style="min-width: 280px;">기본 고유 능력</th>
                  ${renderTh('drops', '획득 / 드랍처', 'min-width: 180px;')}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Bind click event for both table row and card
    elItemsGrid.querySelectorAll('.pet-row, .pet-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-pet-id');
        const pet = expansionData.pets.find(p => p.id === id);
        if (pet) openPetModal(pet);
      });
    });
  }

  function openPetModal(pet) {
    const imgHtml = pet.img
      ? `<img src="${pet.img}" alt="${pet.name}" style="width: 68px; height: 68px; border-radius: 12px; object-fit: cover; background: #f8fafc; border: 1px solid #e2e8f0;">`
      : `<div style="font-size: 2.5rem;">🐾</div>`;

    const tierChar = (pet.tier || 'F').charAt(0);
    const tierBadge = `<span class="tier-badge tier-${tierChar}" style="font-size: 0.85rem; padding: 0.25rem 0.6rem;">${pet.tier}</span>`;
    const noBadge = `<span class="badge-tag" style="background: #eff6ff; color: #1d4ed8; font-size: 0.8rem; font-weight: 800; border: 1px solid #bfdbfe;">#${String(pet.no).padStart(2, '0')}</span>`;

    const abilHighlighted = (pet.ability || '')
      .replace(/(\d+(?:\.\d+)?%?|\b\d+배\b|\b\d+개\b)/g, '<span class="stat-number">$1</span>');

    const dropsHtml = (pet.drops || [])
      .map(d => `<span class="drop-item" style="font-size: 0.82rem; padding: 0.25rem 0.6rem;">📍 ${d}</span>`)
      .join('');

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; gap: 1rem; align-items: center;">
          ${imgHtml}
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              ${noBadge}
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0;">${pet.name}</h2>
              ${tierBadge}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              언더다크 펫 도감 · No.${pet.no}
            </div>
          </div>
        </div>
        <button class="modal-close-btn" aria-label="닫기">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- 기본 고유 능력 -->
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 0.5rem;">
            ⚡ 기본 고유 능력
          </h4>
          <div style="background: #fef3c7; border: 1px solid #fde68a; border-left: 4px solid var(--accent-gold); padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.95rem; line-height: 1.6; color: var(--text-main);">
            ${abilHighlighted}
          </div>
        </div>

        <!-- 획득처 -->
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 0.5rem;">
            🗺️ 획득 및 드랍처
          </h4>
          <div style="background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-glass);">
            <div class="drops-container" style="flex-wrap: wrap; gap: 0.4rem;">
              ${dropsHtml || '<span style="color: var(--text-dim);">획득처 정보가 없습니다.</span>'}
            </div>
          </div>
        </div>

        <!-- 펫 시스템 안내 -->
        <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="font-weight: 700; color: var(--accent-primary); font-size: 0.95rem; margin-bottom: 0.25rem;">
                💡 펫 시스템 & 추천 세팅 정보
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5;">
                펫의 <b>8개 등급 목록</b>, <b>부옵션(5종)</b>, <b>랜덤옵션(12종) 풀</b> 및 타워/영덱 종결 추천 조합을 확인하세요.
              </div>
            </div>
            <button id="modalPetGuideBtn" class="btn-primary" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;">
              📖 펫 시스템 가이드 보기
            </button>
          </div>
        </div>
      </div>
    `;

    const guideBtn = elModalContent.querySelector('#modalPetGuideBtn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        openPetGuideModal();
      });
    }

    showModal();
  }

  function openPetGuideModal() {
    const guide = (expansionData && expansionData.petGuide) || {};
    const grades = guide.grades || ['일반', '레어', '유니크', '엘리트', '미스터리', '에픽', '전설', '신'];
    const subOpts = guide.subOptions || [];
    const randomOpts = guide.randomOptions || [];
    const buildTower = guide.buildTower || {};
    const buildHero = guide.buildHero || {};

    const towerRandRows = (buildTower.randomOptions || []).map(o => `
      <li style="margin-bottom: 0.35rem; color: var(--text-main);">${o}</li>
    `).join('');

    const heroRandRows = (buildHero.randomOptions || []).map(o => `
      <li style="margin-bottom: 0.35rem; color: var(--text-main);">${o}</li>
    `).join('');

    const gradeColorMap = {
      '일반': { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
      '레어': { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
      '유니크': { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
      '엘리트': { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
      '미스터리': { color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' },
      '에픽': { color: '#7e22ce', bg: '#f3e8ff', border: '#e9d5ff' },
      '전설': { color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
      '신': { color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    };

    const horizontalGradesHtml = grades.map((g, idx) => {
      const style = gradeColorMap[g] || { color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' };
      const arrow = idx < grades.length - 1 ? `<span style="color: var(--text-dim); font-size: 0.85rem; user-select: none;">➔</span>` : '';
      return `
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <span style="font-weight: 800; font-size: 0.9rem; color: ${style.color}; background: ${style.bg}; border: 1px solid ${style.border}; padding: 0.35rem 0.85rem; border-radius: 8px; box-shadow: ${style.glow || 'none'}; white-space: nowrap;">
            ${g}
          </span>
          ${arrow}
        </div>
      `;
    }).join('');

    const subListHtml = subOpts.map(s => `
      <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.65rem; border-radius: 6px; background: #f0fdfa; border-left: 3px solid #0d9488; font-size: 0.83rem; line-height: 1.45;">
        <span style="font-weight: 800; color: #0d9488; min-width: 18px;">${s.no}.</span>
        <span style="color: var(--text-main); font-weight: 600;">${s.name}</span>
      </div>
    `).join('');

    const randListHtml = randomOpts.map(r => `
      <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.45rem 0.65rem; border-radius: 6px; background: ${r.category === '타워' ? '#f0fdfa' : '#faf5ff'}; border-left: 3px solid ${r.category === '타워' ? '#0d9488' : '#7e22ce'}; font-size: 0.82rem; line-height: 1.45;">
        <span style="font-weight: 800; color: ${r.category === '타워' ? '#0d9488' : '#7e22ce'}; min-width: 22px;">${r.no}.</span>
        <span style="color: var(--text-main);">${r.name}</span>
      </div>
    `).join('');

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
            <span>🐾</span> 펫 시스템 & 종결 추천 세팅 정보
          </h2>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
            엑셀 H열 우측의 추천 조합, 등급 목록, 부옵션 풀, 랜덤옵션 풀 정보입니다.
          </p>
        </div>
        <button class="modal-close-btn" aria-label="닫기">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- 1. 추천 조합 (타워 vs 영덱) -->
        <div>
          <h4 style="font-size: 1rem; font-weight: 800; color: var(--accent-gold); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>⭐</span> 추천 조합 (타워 추천 세팅 vs 영덱 추천 세팅)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            
            <!-- 타워 추천 세팅 -->
            <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
                <span style="font-size: 1.25rem;">🏹</span>
                <span style="font-weight: 800; color: #0f766e; font-size: 1.05rem;">타워 추천 세팅</span>
              </div>
              <div style="font-size: 0.85rem; margin-bottom: 0.75rem; background: #ccfbf1; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 3px solid #0d9488;">
                <b style="color: var(--text-main);">부옵:</b> <span style="color: #0f766e; font-weight: 700;">${buildTower.subOption || '타워의 공격 속도가 n% 상승합니다.'}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.35rem; font-weight: 700;">랜덤옵 4종:</div>
              <ul style="font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.6;">
                ${towerRandRows}
              </ul>
            </div>

            <!-- 영덱 추천 세팅 -->
            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
                <span style="font-size: 1.25rem;">🦸</span>
                <span style="font-weight: 800; color: #7e22ce; font-size: 1.05rem;">영덱 추천 세팅</span>
              </div>
              <div style="font-size: 0.85rem; margin-bottom: 0.75rem; background: #f3e8ff; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 3px solid #7e22ce;">
                <b style="color: var(--text-main);">부옵:</b> <span style="color: #7e22ce; font-weight: 700;">${buildHero.subOption || '영웅의 공격 속도가 n% 증가합니다.'}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.35rem; font-weight: 700;">랜덤옵 4종:</div>
              <ul style="font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.6;">
                ${heroRandRows}
              </ul>
            </div>

          </div>
        </div>

        <!-- 2. 등급 목록 (가로로 색깔 입혀서 글자로 표시) -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
            <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              <span>🎖️</span> 펫 등급 단계 (${grades.length}단계)
            </h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">일반 ➔ 신 (순차 승급)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; background: #f8fafc; border: 1px solid var(--border-glass); padding: 0.75rem 0.85rem; border-radius: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch;">
            ${horizontalGradesHtml}
          </div>
        </div>

        <!-- 3. 부옵 (5종) & 랜덤옵 (12종) 풀 -->
        <div>
          <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>📋</span> 부옵션 (5종) & 랜덤옵션 (12종) 풀
          </h4>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            
            <!-- 부옵 (5종) -->
            <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 10px; padding: 0.9rem; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem;">
                <h5 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f766e;">🎯 부옵 (${subOpts.length})</h5>
                <span style="font-size: 0.72rem; color: var(--text-muted);">고정 5종 풀</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                ${subListHtml}
              </div>
            </div>

            <!-- 랜덤옵 (12종) -->
            <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 10px; padding: 0.9rem; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem;">
                <h5 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #7e22ce;">🎲 랜덤옵 (${randomOpts.length})</h5>
                <span style="font-size: 0.72rem; color: var(--text-muted);">랜덤 12종 풀</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                ${randListHtml}
              </div>
            </div>

          </div>
        </div>

        <!-- 3. 참고사항 -->
        <div class="mount-tip-box" style="margin: 0;">
          <h4 style="color: var(--accent-gold); font-size: 0.9rem; margin-bottom: 0.4rem;">📌 중요 참고사항</h4>
          <ul style="font-size: 0.85rem; line-height: 1.6; margin: 0; padding-left: 1.2rem; color: var(--text-muted);">
            <li><b style="color: var(--accent-gold);">탈것 조합 시 모든 종류 나오는 펫 (동일 확률)</b></li>
            <li>협동 던전 1·2, 일일 던전(일반/협동), 길드 던전 1·2(일반/협동)의 펫 획득 정보는 시트에 미표기되어 있습니다.</li>
          </ul>
        </div>

      </div>
    `;

    showModal();
  }

  // -------------------------------------------------------------
  // 6. RENDER CAMP (STRUCTURES & PROPS)
  // -------------------------------------------------------------
  function formatCampAbility(text) {
    if (!text) return '';
    return text
      .replace(/(\[[^\]]+\])/g, '<span class="camp-kw-badge">$1</span>')
      .replace(/(\d+(?:\.\d+)?%)/g, '<span class="stat-highlight">$1</span>')
      .replace(/(\d+마리|\d+개)/g, '<span class="stat-highlight">$1</span>');
  }

  function sortCampList(list, col, dir) {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (col === 'no') {
        cmp = a.no - b.no;
      } else if (col === 'type') {
        if (a.type !== b.type) {
          cmp = a.type === 'structure' ? -1 : 1;
        } else {
          cmp = a.no - b.no;
        }
      } else if (col === 'name') {
        cmp = a.name.localeCompare(b.name, 'ko');
      } else if (col === 'ability') {
        cmp = (a.ability || '').localeCompare(b.ability || '', 'ko');
      } else {
        cmp = a.no - b.no;
      }
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  function renderCampCommonDashboard(common) {
    const grades = common.grades || ['일반', '레어', '유니크', '엘리트', '미스터리', '에픽', '전설', '신'];
    const subOpts = common.subOptions || [];
    const randOpts = common.randomOptions || [];

    const gradeColorMap = {
      '일반': { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
      '레어': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      '유니크': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      '엘리트': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      '미스터리': { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
      '에픽': { color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
      '전설': { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
      '신': { color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    };

    const gradesHtml = grades.map((g, idx) => {
      const st = gradeColorMap[g] || { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
      const arrow = idx < grades.length - 1 ? `<span class="camp-step-arrow">➔</span>` : '';
      return `
        <div class="camp-grade-step">
          <span class="camp-grade-badge" style="color: ${st.color}; background: ${st.bg}; border-color: ${st.border};">
            <small class="camp-grade-num">${idx + 1}</small>${g}
          </span>
          ${arrow}
        </div>
      `;
    }).join('');

    // Separate hero vs tower options for readability
    const heroSubs = subOpts.filter(o => o.includes('영웅'));
    const towerSubs = subOpts.filter(o => o.includes('타워'));

    const heroRands = randOpts.filter(o => o.includes('영웅'));
    const towerRands = randOpts.filter(o => o.includes('타워'));

    const isCollapsedClass = state.campCommonExpanded ? '' : 'is-collapsed';

    return `
      <section id="campCommonDashboard" class="camp-common-dashboard ${isCollapsedClass}">
        <div class="camp-common-header">
          <div class="camp-common-title-wrap">
            <span class="camp-common-icon">✨</span>
            <div>
              <h3 class="camp-common-title">구조물 & 소품 공통 적용 안내</h3>
              <p class="camp-common-desc">
                아래 <strong>등급 (8단계)</strong>, <strong>부옵션 (8종)</strong>, <strong>랜덤옵션 (12종)</strong>은 야영지 구조물과 소품 전체에 동일하게 적용되는 공통 사항입니다.
              </p>
            </div>
          </div>
          <button type="button" class="btn-outline btn-sm" id="inlineCampCommonToggle" title="접기 / 펼치기">
            ${state.campCommonExpanded ? '공통 정보 접기 ▲' : '공통 정보 펼치기 ▼'}
          </button>
        </div>

        <div class="camp-common-cards-grid">
          <!-- 1. 등급 (8단계) -->
          <div class="camp-common-card camp-grades-card">
            <div class="common-card-head">
              <span class="head-icon">🎖️</span>
              <h4 class="head-title">적용 등급 (${grades.length}단계)</h4>
              <span class="head-tag">일반 ➔ 신</span>
            </div>
            <div class="camp-grades-flow">
              ${gradesHtml}
            </div>
          </div>

          <!-- 2. 부옵션 (8종) -->
          <div class="camp-common-card camp-subs-card">
            <div class="common-card-head">
              <span class="head-icon">⚡</span>
              <h4 class="head-title">부옵션 (${subOpts.length}종)</h4>
              <span class="head-tag">영웅 5종 · 타워 3종</span>
            </div>
            <div class="camp-options-columns">
              <div class="camp-opt-group">
                <span class="camp-group-label hero">🦸 영웅 부옵 (${heroSubs.length})</span>
                <div class="camp-chips-list">
                  ${heroSubs.map((o, i) => `<div class="camp-opt-chip hero"><span class="chip-num">${i + 1}</span><span>${formatCampAbility(o)}</span></div>`).join('')}
                </div>
              </div>
              <div class="camp-opt-group">
                <span class="camp-group-label tower">🏰 타워 부옵 (${towerSubs.length})</span>
                <div class="camp-chips-list">
                  ${towerSubs.map((o, i) => `<div class="camp-opt-chip tower"><span class="chip-num">${i + 1}</span><span>${formatCampAbility(o)}</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- 3. 랜덤옵션 (12종) -->
          <div class="camp-common-card camp-rands-card">
            <div class="common-card-head">
              <span class="head-icon">🎲</span>
              <h4 class="head-title">랜덤옵션 (${randOpts.length}종)</h4>
              <span class="head-tag">영웅 7종 · 타워 5종</span>
            </div>
            <div class="camp-options-columns">
              <div class="camp-opt-group">
                <span class="camp-group-label hero">🦸 영웅 랜덤옵 (${heroRands.length})</span>
                <div class="camp-chips-list">
                  ${heroRands.map((o, i) => `<div class="camp-opt-chip hero"><span class="chip-num">${i + 1}</span><span>${formatCampAbility(o)}</span></div>`).join('')}
                </div>
              </div>
              <div class="camp-opt-group">
                <span class="camp-group-label tower">🏰 타워 랜덤옵 (${towerRands.length})</span>
                <div class="camp-chips-list">
                  ${towerRands.map((o, i) => `<div class="camp-opt-chip tower"><span class="chip-num">${i + 1}</span><span>${formatCampAbility(o)}</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCampTableView(items) {
    return `
      <div class="table-responsive-wrapper">
        <table class="data-grid-table camp-table">
          <thead>
            <tr>
              ${renderTh('no', 'No', 'width: 60px;', true)}
              ${renderTh('type', '구분', 'width: 100px;', true)}
              <th style="width: 80px;" class="text-center">사진</th>
              ${renderTh('name', '이름', 'width: 180px;')}
              ${renderTh('ability', '고유 능력')}
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr class="camp-table-row clickable-row" data-camp-id="${item.id}" tabindex="0" role="button" title="클릭하여 상세 정보 보기">
                <td class="text-center font-mono font-bold text-subtle">${item.no}</td>
                <td class="text-center">
                  <span class="camp-type-badge type-${item.type}">
                    ${item.type === 'structure' ? '🏛️ 구조물' : '🏺 소품'}
                  </span>
                </td>
                <td class="text-center">
                  <div class="camp-img-box">
                    <img src="${item.img || ''}" alt="${item.name}" loading="lazy">
                  </div>
                </td>
                <td class="font-bold camp-name-cell">
                  <div class="camp-name-text">${item.name}</div>
                </td>
                <td class="camp-ability-cell">${formatCampAbility(item.ability)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCampCardView(items) {
    return `
      <div class="camp-cards-grid">
        ${items.map(item => `
          <div class="camp-card ${item.type === 'structure' ? 'is-structure' : 'is-prop'}" data-camp-id="${item.id}" tabindex="0" role="button" title="클릭하여 상세 정보 보기">
            <div class="camp-card-header">
              <span class="camp-type-badge type-${item.type}">
                ${item.type === 'structure' ? '🏛️ 구조물' : '🏺 소품'}
              </span>
              <span class="camp-card-no">#${item.no}</span>
            </div>
            <div class="camp-card-img-wrap">
              <img src="${item.img || ''}" alt="${item.name}" loading="lazy">
            </div>
            <div class="camp-card-body">
              <h3 class="camp-card-title">${item.name}</h3>
              <div class="camp-card-ability">${formatCampAbility(item.ability)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCampView() {
    const camp = expansionData && expansionData.camp;
    if (!camp) {
      elItemsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <div class="empty-title">야영지 데이터를 불러오는 중입니다...</div>
        </div>
      `;
      return;
    }

    const curSort = tabSortState.camp || { col: 'no', dir: 'asc' };
    const structures = camp.structures || [];
    const props = camp.props || [];
    const allItems = [...structures, ...props];

    // Filter by type & search query
    let items = searchEngine && searchEngine.searchCamp
      ? searchEngine.searchCamp(allItems, { query: state.query, type: state.campType })
      : allItems.filter(it => (state.campType === 'all' || it.type === state.campType));

    // Sort items
    items = sortCampList(items, curSort.col, curSort.dir);

    elResultCount.textContent = items.length;

    // Common info dashboard HTML
    const commonHtml = renderCampCommonDashboard(camp.common || {});

    // Table or Card view
    let listHtml = '';
    if (items.length === 0) {
      listHtml = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">조건에 맞는 야영지 구조물 또는 소품이 없습니다</div>
          <div class="empty-desc">검색어나 구분 필터를 변경해보세요.</div>
        </div>
      `;
    } else if (currentViewMode === 'table') {
      listHtml = renderCampTableView(items);
    } else {
      listHtml = renderCampCardView(items);
    }

    elItemsGrid.innerHTML = `
      <div class="camp-view-wrapper">
        ${commonHtml}
        <div class="camp-content-area">
          ${listHtml}
        </div>
      </div>
    `;

    // Bind item click events for modal
    elItemsGrid.querySelectorAll('[data-camp-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-camp-id');
        const item = allItems.find(x => x.id === id);
        if (item) openCampModal(item);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = el.getAttribute('data-camp-id');
          const item = allItems.find(x => x.id === id);
          if (item) openCampModal(item);
        }
      });
    });

    // Bind common toggle inside view if clicked
    const inlineToggle = elItemsGrid.querySelector('#inlineCampCommonToggle');
    if (inlineToggle) {
      inlineToggle.addEventListener('click', () => {
        state.campCommonExpanded = !state.campCommonExpanded;
        const box = document.getElementById('campCommonDashboard');
        if (box) box.classList.toggle('is-collapsed', !state.campCommonExpanded);
        if (elCampCommonToggleBtn) {
          elCampCommonToggleBtn.classList.toggle('active', state.campCommonExpanded);
          elCampCommonToggleBtn.setAttribute('aria-expanded', state.campCommonExpanded ? 'true' : 'false');
        }
        inlineToggle.textContent = state.campCommonExpanded ? '공통 정보 접기 ▲' : '공통 정보 펼치기 ▼';
      });
    }
  }

  function openCampModal(item) {
    const isStructure = item.type === 'structure';
    const typeLabel = isStructure ? '🏛️ 구조물' : '🏺 소품';

    elModalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
            <span class="camp-type-badge type-${item.type}">${typeLabel}</span>
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted);">#${item.no}</span>
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin: 0;">${item.name}</h2>
        </div>
        <button class="modal-close-btn" aria-label="닫기">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 12px; padding: 1.5rem;">
          <img src="${item.img || ''}" alt="${item.name}" style="max-width: 140px; max-height: 140px; object-fit: contain; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.12));">
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 10px; padding: 1.1rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.45rem; text-transform: uppercase;">고유 능력</div>
          <div style="font-size: 1rem; font-weight: 600; line-height: 1.6; color: var(--text-main);">
            ${formatCampAbility(item.ability)}
          </div>
        </div>

        <div class="mount-tip-box" style="margin: 0;">
          <h4 style="color: var(--accent-gold); font-size: 0.9rem; margin-bottom: 0.4rem;">💡 야영지 공통 옵션 적용</h4>
          <p style="font-size: 0.85rem; line-height: 1.55; margin: 0; color: var(--text-muted);">
            본 항목(${item.name})은 <strong>일반 ~ 신 (8단계 등급)</strong>으로 승급이 가능하며, 공통 <strong>부옵션 (8종)</strong> 및 <strong>랜덤옵션 (12종)</strong> 풀이 동일하게 적용됩니다.
          </p>
        </div>
      </div>
    `;

    showModal();
  }

  // -------------------------------------------------------------
  // 7. RENDER GROWTH (성장 가이드)
  // -------------------------------------------------------------
  function renderGrowthView() {
    elResultCount.textContent = '1';
    elItemsGrid.innerHTML = `
      <div class="growth-view-wrapper">
        <div class="growth-card">
          <div class="growth-card-header">
            <div class="growth-header-info">
              <span class="growth-badge">성장 가이드</span>
              <h2 class="growth-title">언더다크 단계별 성장 가이드 차트</h2>
              <p class="growth-subtitle">캐릭터 단계별 요구 재화, 성장 스탯 증가율 및 레벨별 필요 사항을 담은 종합 안내도입니다. 차트를 클릭하면 전체화면으로 크게 볼 수 있습니다.</p>
            </div>
            <div class="growth-card-actions">
              <button type="button" class="btn-outline btn-sm" id="inlineGrowthZoomBtn">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
                전체화면 확대
              </button>
              <a href="assets/growth/underdark_growth.png" download="언더다크_성장.png" class="btn-outline btn-sm">
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                이미지 저장
              </a>
            </div>
          </div>

          <div class="growth-image-container" id="growthImageTrigger" role="button" tabindex="0" title="클릭하여 원본 크기로 확대">
            <img src="assets/growth/underdark_growth.png" alt="언더다크 성장 가이드" class="growth-image" loading="lazy">
            <div class="growth-image-overlay">
              <span class="growth-zoom-pill">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
                클릭하여 원본 크기(1031 × 1155)로 확대 보기
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    const trigger = elItemsGrid.querySelector('#growthImageTrigger');
    if (trigger) {
      trigger.addEventListener('click', openGrowthModal);
      trigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openGrowthModal();
        }
      });
    }

    const inlineBtn = elItemsGrid.querySelector('#inlineGrowthZoomBtn');
    if (inlineBtn) {
      inlineBtn.addEventListener('click', openGrowthModal);
    }
  }

  function openGrowthModal() {
    elModalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span class="growth-badge">성장 차트</span>
          </div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0;">언더다크 성장 가이드 (고해상도 원본)</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <a href="assets/growth/underdark_growth.png" download="언더다크_성장.png" class="btn-outline btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem;">
            <svg viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            저장
          </a>
          <button class="modal-close-btn" aria-label="닫기">✕</button>
        </div>
      </div>

      <div class="modal-body growth-modal-body" style="padding: 1rem; overflow-y: auto; max-height: 80vh; text-align: center; background: #0f172a;">
        <img src="assets/growth/underdark_growth.png" alt="언더다크 성장 가이드 원본" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      </div>
    `;

    showModal();
  }

  function showModal() {
    elModalOverlay.classList.add('active');
  }

  function closeModal() {
    elModalOverlay.classList.remove('active');
  }

  window.filterByDrop = function (dropName) {
    closeModal();
    elDropFilter.value = dropName;
    state.drop = dropName;
    updateUrl();
    renderActiveView();
  };

  // URL Sync
  function updateUrl() {
    const params = new URLSearchParams();
    params.set('tab', currentTab);
    if (state.query) params.set('q', state.query);

    if (currentTab === 'items') {
      if (state.category !== 'all') params.set('cat', state.category);
      if (state.range !== 'all') params.set('range', state.range);
      if (state.tier !== 'all') params.set('tier', state.tier);
      if (state.usage !== 'all') params.set('use', state.usage);
      if (state.drop !== 'all') params.set('drop', state.drop);
      if (state.tags.length > 0) params.set('tags', state.tags.join(','));
      if (state.awakeningLevel > 0) params.set('awak', state.awakeningLevel);
      if (state.sortBy !== 'default') params.set('sort', state.sortBy);
    }

    const str = params.toString();
    const newUrl = str ? `${window.location.pathname}?${str}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('tab')) currentTab = params.get('tab');
    if (params.has('q')) {
      state.query = params.get('q');
      elSearchInput.value = state.query;
      elSearchClear.style.display = 'flex';
    }
    if (params.has('cat')) state.category = params.get('cat');
    if (params.has('range')) state.range = params.get('range');
    if (params.has('tier')) state.tier = params.get('tier');
    if (params.has('use')) state.usage = params.get('use');
    if (params.has('drop')) state.drop = params.get('drop');
    if (params.has('tags')) state.tags = params.get('tags').split(',').filter(Boolean);
    if (params.has('awak')) state.awakeningLevel = parseInt(params.get('awak'), 10) || 0;
    if (params.has('sort')) state.sortBy = params.get('sort');
  }

  // ==========================================
  // Admin & Google Sheets Integration Modal
  // ==========================================
  const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi/edit?usp=sharing';
  const DEFAULT_ADMIN_ID = 'admin';
  const DEFAULT_ADMIN_PW = 'underdark1234';

  function openAdminModal() {
    const isAuthed = sessionStorage.getItem('underdark_admin_auth') === 'true';
    if (isAuthed) {
      renderAdminDashboardModal();
    } else {
      renderAdminLoginModal();
    }
  }

  function renderAdminLoginModal(errorMsg = '') {
    const html = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">🔐</span>
          <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: #0f172a;">관리자 로그인</h2>
        </div>
        <button type="button" class="modal-close-btn" aria-label="닫기">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.5rem; max-width: 440px; margin: 0 auto; width: 100%;">
        <p style="font-size: 0.88rem; color: #475569; margin-bottom: 1.25rem; line-height: 1.5;">
          관리자로 로그인하시면 데이터 수정용 <strong>구글 스프레드시트</strong>가 새 창으로 열립니다.
        </p>
        <form id="adminLoginForm">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.35rem; color: #334155;" for="modalAdminId">아이디</label>
            <input type="text" id="modalAdminId" class="filter-select" style="width: 100%; border-radius: 8px; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; background: #f8fafc;" placeholder="admin" required autocomplete="username">
          </div>
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.35rem; color: #334155;" for="modalAdminPw">비밀번호</label>
            <input type="password" id="modalAdminPw" class="filter-select" style="width: 100%; border-radius: 8px; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; background: #f8fafc;" placeholder="비밀번호 입력" required autocomplete="current-password">
          </div>
          ${errorMsg ? `
            <div style="color: #ef4444; font-size: 0.84rem; margin-bottom: 1rem; text-align: center; font-weight: 600; padding: 0.5rem; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
              ${errorMsg}
            </div>
          ` : ''}
          <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; font-weight: 700; padding: 0.8rem; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
            <span>🔓 로그인 및 구글 시트 열기</span>
          </button>
        </form>
      </div>
    `;

    elModalContent.innerHTML = html;
    showModal();

    const form = document.getElementById('adminLoginForm');
    const idInput = document.getElementById('modalAdminId');
    const pwInput = document.getElementById('modalAdminPw');

    setTimeout(() => {
      if (idInput && !idInput.value) idInput.focus();
      else if (pwInput) pwInput.focus();
    }, 100);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const id = (idInput.value || '').trim();
      const pw = (pwInput.value || '').trim();
      const validPw = localStorage.getItem('underdark_admin_pw') || DEFAULT_ADMIN_PW;

      if (id === DEFAULT_ADMIN_ID && pw === validPw) {
        sessionStorage.setItem('underdark_admin_auth', 'true');
        window.open(GOOGLE_SHEET_URL, '_blank');
        renderAdminDashboardModal(true);
      } else {
        renderAdminLoginModal('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    });
  }

  function renderAdminDashboardModal(justOpened = false) {
    const html = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">⚙️</span>
          <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: #0f172a;">관리자 모드</h2>
        </div>
        <button type="button" class="modal-close-btn" aria-label="닫기">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.5rem; max-width: 480px; margin: 0 auto; width: 100%;">
        ${justOpened ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 0.65rem;">
            <span style="font-size: 1.25rem; line-height: 1;">🚀</span>
            <div>
              <div style="font-weight: 700; color: #166534; font-size: 0.9rem;">구글 스프레드시트가 새 창으로 열렸습니다!</div>
              <div style="font-size: 0.8rem; color: #15803d; margin-top: 0.2rem; line-height: 1.4;">
                시트에서 내용을 수정하시면 실시간 자동 저장됩니다.
              </div>
            </div>
          </div>
        ` : `
          <p style="font-size: 0.88rem; color: #475569; margin-bottom: 1.25rem;">
            현재 <strong>관리자(admin)</strong>로 인증되어 있습니다.
          </p>
        `}

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.1rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.9rem; font-weight: 700; color: #166534; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
            <span>⚡</span> 실시간 자동 동기화 활성화됨
          </div>
          <p style="font-size: 0.82rem; color: #15803d; line-height: 1.55; margin: 0;">
            구글 시트에서 수정하신 내용은 <strong>웹사이트 접속 및 새로고침 시 실시간으로 즉시 반영</strong>됩니다. 별도의 터미널이나 파일 실행이 전혀 필요 없습니다!
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          <a href="${GOOGLE_SHEET_URL}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 0.85rem; font-weight: 700; font-size: 0.95rem; justify-content: center; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
            <span>📊 구글 스프레드시트 새창 열기</span>
            <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <button type="button" id="adminForceSyncBtn" class="btn-secondary" style="padding: 0.75rem; font-size: 0.85rem; font-weight: 600; justify-content: center; color: #1e293b; border-color: #cbd5e1; background: #f8fafc; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-radius: 8px;">
            <span>🔄 지금 즉시 구글 시트 동기화</span>
          </button>
          <button type="button" id="adminLogoutBtn" class="btn-outline" style="padding: 0.7rem; font-size: 0.85rem; justify-content: center; color: #dc2626; border-color: #fecaca; background: #fff;">
            <span>🚪 로그아웃</span>
          </button>
        </div>
      </div>
    `;

    elModalContent.innerHTML = html;
    showModal();

    const forceSyncBtn = document.getElementById('adminForceSyncBtn');
    if (forceSyncBtn) {
      forceSyncBtn.addEventListener('click', async () => {
        forceSyncBtn.disabled = true;
        forceSyncBtn.innerHTML = '<span>⏳ 구글 시트 동기화 중...</span>';
        await triggerBackgroundSheetSync(true);
        forceSyncBtn.disabled = false;
        forceSyncBtn.innerHTML = '<span>✅ 동기화 완료!</span>';
        setTimeout(() => {
          forceSyncBtn.innerHTML = '<span>🔄 지금 즉시 구글 시트 동기화</span>';
        }, 2000);
      });
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('underdark_admin_auth');
        renderAdminLoginModal();
      });
    }
  }

  // ==========================================
  // Background Real-Time Sheet Revalidation
  // ==========================================
  let isSyncingSheets = false;
  async function triggerBackgroundSheetSync(isManual = false) {
    if (isSyncingSheets || !window.SheetsSync) return;
    isSyncingSheets = true;
    try {
      const fresh = await window.SheetsSync.fetchLiveExpansionData(isManual);
      if (fresh) {
        let itemsChanged = false;
        if (fresh.items && fresh.items.length && rawItemData) {
          const oldItemsJson = JSON.stringify(rawItemData.items || []);
          const newItemsJson = JSON.stringify(fresh.items);
          if (oldItemsJson !== newItemsJson) {
            rawItemData.items = fresh.items;
            if (window.UNDERDARK_DATA) {
              window.UNDERDARK_DATA.items = fresh.items;
            }
            searchEngine = new window.UnderdarkSearch(rawItemData);
            itemsChanged = true;
          }
        }
        const oldHash = JSON.stringify(expansionData || {});
        const newHash = JSON.stringify(fresh);
        if (oldHash !== newHash || itemsChanged) {
          expansionData = fresh;
          window.UNDERDARK_EXPANSION = fresh;
          renderActiveView();

          // If detail modal is currently open, re-render it with fresh item data
          if (elModalOverlay && elModalOverlay.classList.contains('active')) {
            const openHeader = elModalContent.querySelector('.modal-header[data-modal-item-id]');
            const openId = openHeader ? openHeader.getAttribute('data-modal-item-id') : null;
            if (openId && rawItemData && rawItemData.items) {
              const freshItem = rawItemData.items.find(x => x.id === openId);
              if (freshItem) openItemModal(freshItem);
            }
          }

          if (isManual) {
            showToast('✅ 구글 시트 최신 데이터가 반영되었습니다.');
          } else {
            console.log('⚡ Live Google Sheets data updated and rendered.');
          }
        } else if (isManual) {
          showToast('✅ 이미 최신 데이터 상태입니다.');
        }
      }
    } catch (e) {
      console.warn('Live Google Sheets background sync failed:', e);
      if (isManual) {
        showToast('⚠️ 구글 시트 연결 실패. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      isSyncingSheets = false;
    }
  }

  function showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(15,23,42,0.92);color:#fff;padding:10px 20px;border-radius:30px;font-size:0.85rem;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.25);z-index:9999;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:none;opacity:0;display:flex;align-items:center;gap:6px;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, 2800);
  }
})();

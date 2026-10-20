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
  };

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

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    await loadAllData();
    setupEngine();
    renderInitialFilters();
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

    elItemControls = document.getElementById('itemControlSection');
    elHeroControls = document.getElementById('heroControlSection');
    elMercControls = document.getElementById('mercControlSection');
    elMountControls = document.getElementById('mountControlSection');
    elPetControls = document.getElementById('petControlSection');

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
    if (window.UNDERDARK_EXPANSION) {
      expansionData = window.UNDERDARK_EXPANSION;
    } else {
      try {
        const [hRes, mRes, mtRes, pRes] = await Promise.all([
          fetch('data/heroes.json'),
          fetch('data/mercenaries.json'),
          fetch('data/mounts.json'),
          fetch('data/pets.json')
        ]);
        const petJson = await pRes.json();
        expansionData = {
          heroes: await hRes.json(),
          mercenaries: await mRes.json(),
          mounts: (await mtRes.json()).mounts || [],
          mountSubOptions: (await mtRes.json()).subOptions || [],
          pets: petJson.pets || [],
          petGuide: petJson.guide || {}
        };
      } catch (e) {
        console.warn('Could not load expansion data json', e);
      }
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

    // Sort Stat Options
    const statGroup = document.createElement('optgroup');
    statGroup.label = '주요 능력치 수치 순';
    const popularStats = [
      'hero_crit_dmg', 'tower_atk_mult', 'all_atk', 'projectile',
      'hero_atk_speed', 'double_attack', 'status_bonus', 'immune_bonus', 'hero_hp'
    ];
    popularStats.forEach(key => {
      const s = rawItemData.statDefs[key];
      if (s) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${s.label} (${s.unit})`;
        statGroup.appendChild(opt);
      }
    });
    elSortSelect.appendChild(statGroup);
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
      elSearchClear.style.display = state.query ? 'flex' : 'none';
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
      elSearchClear.style.display = 'none';
      elSearchInput.focus();
      updateUrl();
      renderActiveView();
    });

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
      state.sortBy = e.target.value;
      updateUrl();
      renderActiveView();
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
    elSortWrapper.style.display = 'none';

    // Show selected controls & customize hero banner
    if (tab === 'items') {
      elHeroTitle.textContent = '아이템 도감 & 능력치 검색';
      elHeroSubtitle.textContent = '이름, 초성, 능력 문장 뿐만 아니라 세부 수치 조건으로 자유롭게 검색하세요.';
      elSearchInput.placeholder = '검색어 입력 (예: 빛단, ㅅㅁㅍㅍ, 처형, 치피>=100, 투사체>2)';
      elItemControls.style.display = 'block';
      elSortWrapper.style.display = 'flex';
      elResultUnit.textContent = '아이템';
      renderItemSearchHints();
    } else if (tab === 'heroes') {
      elHeroTitle.textContent = '영웅 도감 & 영덱 공략';
      elHeroSubtitle.textContent = '모든 영웅의 기본 능력과 3·6·9·12·15 레벨별 추가 능력, 티어 평가를 확인하세요.';
      elSearchInput.placeholder = '영웅 이름, 별칭, 초성 검색 (예: 오크, 정불갑, 용싶해, 아그니)';
      elHeroControls.style.display = 'block';
      elResultUnit.textContent = '명의 영웅';
      renderHeroSearchHints();
    } else if (tab === 'mercenaries') {
      elHeroTitle.textContent = '지원용병 도감 & 추천';
      elHeroSubtitle.textContent = '지원용병의 등급별(B~SSS) 공격력/공속/치명타 버프 수치와 추천도를 확인하세요.';
      elSearchInput.placeholder = '지원용병 이름, 능력 검색 (예: 저승사자, 닌자, 세이렌, 토르)';
      elMercControls.style.display = 'block';
      elResultUnit.textContent = '명의 지원용병';
      renderMercSearchHints();
    } else if (tab === 'mounts') {
      elHeroTitle.textContent = '탈것 도감 & 부옵션 가이드';
      elHeroSubtitle.textContent = '총 57종의 탈것 고유 능력과 평가 코멘트, 합성법 및 18가지 부옵션 정보입니다.';
      elSearchInput.placeholder = '탈것 이름, 능력 검색 (예: 아기 백룡, 검은 악마, 거대슬라임)';
      elMountControls.style.display = 'block';
      elResultUnit.textContent = '종의 탈것';
      renderMountSearchHints();
    } else if (tab === 'pets') {
      elHeroTitle.textContent = '펫 도감 & 등급·옵션 세팅 가이드';
      elHeroSubtitle.textContent = '총 26종 펫의 고유 기본 능력과 드랍처, 등급별 해금 옵션 및 타워/영덱 종결 세팅 정보입니다.';
      elSearchInput.placeholder = '펫 이름, 초성, 능력 검색 (예: 용암슬라임, 쉐도우, ㅇㅇㅅㄹㅇ)';
      if (elPetControls) elPetControls.style.display = 'block';
      elResultUnit.textContent = '종의 펫';
      renderPetSearchHints();
    }

    updateUrl();
    renderActiveView();
  }

  function renderItemSearchHints() {
    elSearchHints.innerHTML = `
      <span>빠른 검색:</span>
      <span class="search-hint-tag" data-q="치피>=100">치피>=100</span>
      <span class="search-hint-tag" data-q="투사체>=3">투사체>=3</span>
      <span class="search-hint-tag" data-q="이감>=20">이감>=20</span>
      <span class="search-hint-tag" data-q="처형 원거리">처형 원거리</span>
      <span class="search-hint-tag" data-q="빛단">빛단</span>
      <span class="search-hint-tag" data-q="ㅅㅁㅍㅍ">ㅅㅁㅍㅍ</span>
    `;
    bindHintTags();
  }

  function renderHeroSearchHints() {
    elSearchHints.innerHTML = `
      <span>빠른 검색:</span>
      <span class="search-hint-tag" data-q="오크">오크 (SSS)</span>
      <span class="search-hint-tag" data-q="아그니">아그니</span>
      <span class="search-hint-tag" data-q="정불갑">정불갑</span>
      <span class="search-hint-tag" data-q="용싶해">용싶해</span>
      <span class="search-hint-tag" data-q="스턴">스턴</span>
      <span class="search-hint-tag" data-q="곡괭이">곡괭이</span>
    `;
    bindHintTags();
  }

  function renderMercSearchHints() {
    elSearchHints.innerHTML = `
      <span>빠른 검색:</span>
      <span class="search-hint-tag" data-q="저승사자">저승사자 (자사)</span>
      <span class="search-hint-tag" data-q="세이렌">세이렌 (처형)</span>
      <span class="search-hint-tag" data-q="발키리">발키리</span>
      <span class="search-hint-tag" data-q="서큐비스">서큐비스</span>
    `;
    bindHintTags();
  }

  function renderMountSearchHints() {
    elSearchHints.innerHTML = `
      <span>빠른 검색:</span>
      <span class="search-hint-tag" data-q="아기 백룡">아기 백룡 (종결)</span>
      <span class="search-hint-tag" data-q="검은 악마">검은 악마 (4배)</span>
      <span class="search-hint-tag" data-q="고대 백룡">고대 백룡 (4배모드)</span>
      <span class="search-hint-tag" data-q="곡괭이">곡괭이</span>
    `;
    bindHintTags();
  }

  function renderPetSearchHints() {
    elSearchHints.innerHTML = `
      <span>빠른 검색:</span>
      <span class="search-hint-tag" data-q="용암슬라임">용암 슬라임</span>
      <span class="search-hint-tag" data-q="쉐도우">쉐도우 (S)</span>
      <span class="search-hint-tag" data-q="포포">포포 (A+)</span>
      <span class="search-hint-tag" data-q="공격 속도">공격 속도</span>
      <span class="search-hint-tag" data-q="치명타">치명타</span>
      <span class="search-hint-tag" data-q="타워">타워 강화</span>
      <span class="search-hint-tag" data-q="스테이지">스테이지 펫</span>
    `;
    bindHintTags();
  }

  function bindHintTags() {
    elSearchHints.querySelectorAll('.search-hint-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const q = tag.getAttribute('data-q');
        elSearchInput.value = q;
        state.query = q;
        elSearchClear.style.display = 'flex';
        updateUrl();
        renderActiveView();
      });
    });
  }

  function renderActiveView() {
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
    }
  }

  // -------------------------------------------------------------
  // 1. RENDER ITEMS (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderItemsView() {
    if (!searchEngine) return;
    const items = searchEngine.search(state);
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

        const dropsHtml = (item.drops || []).slice(0, 2).map(d => `<span class="drop-item">${d}</span>`).join('');

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

        const dropsHtml = (item.drops || []).slice(0, 2).map(d => `<span class="drop-item">${d}</span>`).join('');

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
                  <th style="min-width: 140px;">아이템명</th>
                  <th style="width: 80px; text-align: center;">티어</th>
                  <th style="width: 80px; text-align: center;">용도</th>
                  <th style="width: 85px; text-align: center;">사거리</th>
                  <th style="min-width: 280px;">능력 및 ${currentAwak > 0 ? currentAwak + '각성 효과' : '기본 효과'}</th>
                  <th style="min-width: 160px;">주요 수치</th>
                  <th style="min-width: 130px;">드랍처</th>
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

    const hl = state.heroLevel;

    if (currentViewMode === 'card') {
      const cardsHtml = heroes.map(hero => {
        const imgHtml = hero.img
          ? `<img src="${hero.img}" alt="${hero.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🦸</div>`;

        const tierBadge = hero.tier
          ? `<span class="tier-badge tier-${hero.tier.charAt(0)}">${hero.tier}</span>` : '';
        const gradeBadge = hero.grade
          ? `<span class="badge-tag">${hero.grade}</span>` : '';

        let extraHtml = '';
        if (hl !== 'base') {
          const lvInfo = hero.levels ? hero.levels[hl] : null;
          if (lvInfo) {
            extraHtml = `
              <div class="ability-line awakening-changed">
                <b>${hl}레벨 능력:</b> ${lvInfo.ability}
                ${lvInfo.stars ? `<div style="color: #d97706; font-size: 0.78rem; margin-top: 0.15rem;">${lvInfo.stars}</div>` : ''}
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
          ? `<span class="tier-badge tier-${hero.tier.charAt(0)}">${hero.tier}</span>` : '-';
        const gradeBadge = hero.grade
          ? `<span class="badge-tag">${hero.grade}</span>` : '-';

        let extraHtml = '-';
        if (hl !== 'base') {
          const lvInfo = hero.levels ? hero.levels[hl] : null;
          if (lvInfo) {
            extraHtml = `
              <div style="color: #1d4ed8; font-weight: 600; line-height: 1.45;">
                ${lvInfo.ability}
                ${lvInfo.stars ? `<div style="color: #d97706; font-size: 0.8rem; margin-top: 0.15rem;">${lvInfo.stars}</div>` : ''}
              </div>
            `;
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
                  <th style="min-width: 130px;">영웅명</th>
                  <th style="width: 80px; text-align: center;">티어</th>
                  <th style="width: 80px; text-align: center;">등급</th>
                  <th style="min-width: 260px;">기본 고유 능력</th>
                  <th style="min-width: 260px;">선택 레벨(${hl === 'base' ? '추가' : hl + '레벨'}) 능력</th>
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

    const currentTier = state.mercTier;

    if (currentViewMode === 'card') {
      const cardsHtml = mercs.map(merc => {
        const imgHtml = merc.img
          ? `<img src="${merc.img}" alt="${merc.name}" class="card-img" loading="lazy">`
          : `<div class="card-img-placeholder">🛡️</div>`;

        const gradeBadge = `<span class="badge-tag">${merc.grade}</span>`;
        const recBadge = merc.recommend
          ? `<span class="usage-badge usage-${merc.recommend}">${merc.recommend}</span>` : '';

        let abilityText = merc.ability || '';
        const tierVal = merc.tierValues ? merc.tierValues[currentTier] : null;

        if (tierVal !== null && tierVal !== undefined) {
          abilityText = abilityText.replace(/\bN\b|\bN%\b/g, `<b class="stat-number">+${tierVal}%</b>`);
        }

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
                  <span>버프 수치: <b style="color: #2563eb;">${tierVal !== null && tierVal !== undefined ? `+${tierVal}%` : '-'}</b></span>
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

        let abilityText = merc.ability || '';
        const tierVal = merc.tierValues ? merc.tierValues[currentTier] : null;

        if (tierVal !== null && tierVal !== undefined) {
          abilityText = abilityText.replace(/\bN\b|\bN%\b/g, `<b class="stat-number">+${tierVal}%</b>`);
        }

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
                ${tierVal !== null && tierVal !== undefined ? `+${tierVal}%` : '-'}
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
                  <th style="min-width: 130px;">용병명</th>
                  <th style="width: 85px; text-align: center;">기본 등급</th>
                  <th style="width: 85px; text-align: center;">추천도</th>
                  <th style="width: 120px; text-align: center;">선택 (${currentTier}) 버프</th>
                  <th style="min-width: 280px;">고유 능력</th>
                  <th style="width: 90px; text-align: center;">필요 레벨</th>
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

  // -------------------------------------------------------------
  // 4. RENDER MOUNTS (DATA GRID TABLE)
  // -------------------------------------------------------------
  function renderMountsView() {
    if (!expansionData || !expansionData.mounts) return;

    let mounts = expansionData.mounts;
    if (searchEngine) {
      mounts = searchEngine.searchMounts(mounts, { query: state.query });
    }

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
                  <th style="width: 75px; text-align: center;">번호</th>
                  <th style="min-width: 140px;">탈것 이름</th>
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
        <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border-glass); border-radius: 8px; padding: 1.2rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">ℹ️</div>
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
      <div class="modal-header">
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
      levelRows += `
        <tr>
          <th>${lv.level}레벨</th>
          <td>
            <div>${lv.ability}</div>
            ${lv.stars ? `<div class="star-rating" style="margin-top: 0.25rem;">${lv.stars}</div>` : ''}
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
              ${hero.tier ? `<span class="tier-badge tier-${hero.tier.charAt(0)}">${hero.tier}</span>` : ''}
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
      rows += `
        <tr>
          <th>${t} 등급<br><span style="font-size: 0.7rem; color: var(--text-dim); font-weight: 400;">(${reqs[i]})</span></th>
          <td style="font-weight: 700; color: var(--accent-secondary); font-size: 1rem;">
            ${val !== '-' ? `+${val}%` : '-'}
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
          <div class="ability-line">${merc.ability}</div>
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
    const pets = searchEngine
      ? searchEngine.searchPets(expansionData.pets, {
        query: state.query,
        tier: state.petTier,
        drop: state.petDrop,
      })
      : expansionData.pets;

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
                  <th style="width: 75px; text-align: center;">도감 No</th>
                  <th style="min-width: 140px;">펫 이름</th>
                  <th style="width: 80px; text-align: center;">티어</th>
                  <th style="min-width: 280px;">기본 고유 능력</th>
                  <th style="min-width: 180px;">획득 / 드랍처</th>
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
      ? `<img src="${pet.img}" alt="${pet.name}" style="width: 76px; height: 76px; border-radius: 12px; object-fit: cover; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">`
      : `<div style="font-size: 2.5rem;">🐾</div>`;

    const tierChar = (pet.tier || 'F').charAt(0);
    const tierBadge = `<span class="tier-badge tier-${tierChar}" style="font-size: 0.85rem; padding: 0.25rem 0.6rem;">${pet.tier}</span>`;
    const noBadge = `<span class="badge-tag" style="background: rgba(255,255,255,0.08); color: var(--accent-gold); font-size: 0.8rem; font-weight: 800;">#${String(pet.no).padStart(2, '0')}</span>`;

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
})();

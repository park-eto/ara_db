/**
 * Underdark Item Admin Controller
 * - ID / PW Authentication
 * - CRUD operations for items
 * - LocalStorage sync + Server API save + JSON download
 */

(function () {
  'use strict';

  // Default credentials (can be overridden via localStorage)
  const DEFAULT_ID = 'admin';
  const DEFAULT_PW = 'underdark1234';

  let currentData = null;
  let editingItem = null;

  // DOM
  let elLoginSection;
  let elLoginForm;
  let elAdminId;
  let elAdminPw;
  let elLoginError;
  let elDashboardSection;
  let elLogoutBtn;

  let elAdminTableBody;
  let elAdminItemCount;
  let elAdminSearchInput;
  let elAdminCatFilter;

  let elAddItemBtn;
  let elSaveChangesBtn;
  let elDownloadJsonBtn;
  let elResetDataBtn;

  let elEditModalOverlay;
  let elEditModalTitle;
  let elEditModalClose;
  let elEditCancelBtn;
  let elItemEditForm;

  // Inputs
  let elEditItemId;
  let elEditName;
  let elEditAliases;
  let elEditCat;
  let elEditRange;
  let elEditGrade;
  let elEditUsage;
  let elEditAbilities;
  let elEditAwak1;
  let elEditAwak2;
  let elEditAwak3;
  let elEditAwak4;
  let elEditAwak5;
  let elEditDrops;
  let elEditComment;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    bindEvents();
    checkAuth();
  }

  function cacheDom() {
    elLoginSection = document.getElementById('loginSection');
    elLoginForm = document.getElementById('loginForm');
    elAdminId = document.getElementById('adminId');
    elAdminPw = document.getElementById('adminPw');
    elLoginError = document.getElementById('loginError');
    elDashboardSection = document.getElementById('dashboardSection');
    elLogoutBtn = document.getElementById('logoutBtn');

    elAdminTableBody = document.getElementById('adminTableBody');
    elAdminItemCount = document.getElementById('adminItemCount');
    elAdminSearchInput = document.getElementById('adminSearchInput');
    elAdminCatFilter = document.getElementById('adminCatFilter');

    elAddItemBtn = document.getElementById('addItemBtn');
    elSaveChangesBtn = document.getElementById('saveChangesBtn');
    elDownloadJsonBtn = document.getElementById('downloadJsonBtn');
    elResetDataBtn = document.getElementById('resetDataBtn');

    elEditModalOverlay = document.getElementById('editModalOverlay');
    elEditModalTitle = document.getElementById('editModalTitle');
    elEditModalClose = document.getElementById('editModalClose');
    elEditCancelBtn = document.getElementById('editCancelBtn');
    elItemEditForm = document.getElementById('itemEditForm');

    elEditItemId = document.getElementById('editItemId');
    elEditName = document.getElementById('editName');
    elEditAliases = document.getElementById('editAliases');
    elEditCat = document.getElementById('editCat');
    elEditRange = document.getElementById('editRange');
    elEditGrade = document.getElementById('editGrade');
    elEditUsage = document.getElementById('editUsage');
    elEditAbilities = document.getElementById('editAbilities');
    elEditAwak1 = document.getElementById('editAwak1');
    elEditAwak2 = document.getElementById('editAwak2');
    elEditAwak3 = document.getElementById('editAwak3');
    elEditAwak4 = document.getElementById('editAwak4');
    elEditAwak5 = document.getElementById('editAwak5');
    elEditDrops = document.getElementById('editDrops');
    elEditComment = document.getElementById('editComment');
  }

  function checkAuth() {
    const isAuthed = sessionStorage.getItem('underdark_admin_auth') === 'true';
    if (isAuthed) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    elLoginSection.style.display = 'flex';
    elDashboardSection.style.display = 'none';
    elLogoutBtn.style.display = 'none';
  }

  async function showDashboard() {
    elLoginSection.style.display = 'none';
    elDashboardSection.style.display = 'block';
    elLogoutBtn.style.display = 'inline-flex';
    await loadItemsData();
    renderTable();
  }

  async function loadItemsData() {
    const localSaved = localStorage.getItem('underdark_items_data');
    if (localSaved) {
      try {
        currentData = JSON.parse(localSaved);
        return;
      } catch (e) {
        console.warn('Failed to parse local stored items', e);
      }
    }

    if (window.UNDERDARK_DATA) {
      currentData = JSON.parse(JSON.stringify(window.UNDERDARK_DATA));
      return;
    }

    try {
      const res = await fetch('data/items.json');
      currentData = await res.json();
    } catch (err) {
      console.error('Failed to load data:', err);
      alert('아이템 데이터를 불러오는 데 실패했습니다.');
    }
  }

  function bindEvents() {
    // Login
    elLoginForm.addEventListener('submit', e => {
      e.preventDefault();
      const id = elAdminId.value.trim();
      const pw = elAdminPw.value.trim();

      if (id === DEFAULT_ID && pw === DEFAULT_PW) {
        sessionStorage.setItem('underdark_admin_auth', 'true');
        elLoginError.style.display = 'none';
        showDashboard();
      } else {
        elLoginError.style.display = 'block';
      }
    });

    // Logout
    elLogoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('underdark_admin_auth');
      showLogin();
    });

    // Filter & Search Table
    elAdminSearchInput.addEventListener('input', renderTable);
    elAdminCatFilter.addEventListener('change', renderTable);

    // Add Item
    elAddItemBtn.addEventListener('click', () => {
      editingItem = null;
      elEditModalTitle.textContent = '새 아이템 추가';
      elItemEditForm.reset();
      elEditItemId.value = '';
      openEditModal();
    });

    // Modal Close
    elEditModalClose.addEventListener('click', closeEditModal);
    elEditCancelBtn.addEventListener('click', closeEditModal);
    elEditModalOverlay.addEventListener('click', e => {
      if (e.target === elEditModalOverlay) closeEditModal();
    });

    // Form Submit (Save Item)
    elItemEditForm.addEventListener('submit', onSaveItem);

    // Save All Changes (Server + Local)
    elSaveChangesBtn.addEventListener('click', saveAllChanges);

    // Download JSON
    elDownloadJsonBtn.addEventListener('click', downloadJson);

    // Reset Data
    elResetDataBtn.addEventListener('click', resetData);
  }

  function renderTable() {
    if (!currentData || !currentData.items) return;

    const query = elAdminSearchInput.value.trim().toLowerCase();
    const cat = elAdminCatFilter.value;

    const filtered = currentData.items.filter(item => {
      if (cat !== 'all' && item.cat !== cat) return false;
      if (query) {
        const matchName = item.name.toLowerCase().includes(query);
        const matchId = item.id.toLowerCase().includes(query);
        const matchAlias = (item.aliases || []).some(a => a.toLowerCase().includes(query));
        if (!matchName && !matchId && !matchAlias) return false;
      }
      return true;
    });

    elAdminItemCount.textContent = filtered.length;

    elAdminTableBody.innerHTML = filtered
      .map(item => {
        const catMap = { weapon: '주 무기', sub: '보조 무기', helmet: '투구', ring: '반지', etc: '기타' };
        const imgHtml = item.img
          ? `<img src="${item.img}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">`
          : `<div style="font-size: 1.25rem;">⚔️</div>`;

        const abilSummary = (item.abilities || []).slice(0, 2).join(' / ');

        return `
          <tr>
            <td>${imgHtml}</td>
            <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-dim);">${item.id}</td>
            <td style="font-weight: 700; color: #fff;">${item.name}</td>
            <td><span class="badge-tag">${catMap[item.cat] || item.cat}</span></td>
            <td style="white-space: nowrap;">${item.range ? `<span class="badge-tag badge-range ${item.range}">${item.range}</span>` : '-'}</td>
            <td>${item.tier ? `<span class="tier-badge tier-${item.tier}">${item.grade || item.tier}</span>` : '-'}</td>
            <td>${item.usage ? `<span class="usage-badge usage-${item.usage}">${item.usage}</span>` : '-'}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${abilSummary}">
              ${abilSummary || '-'}
            </td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="window.adminEditItem('${item.id}')">수정</button>
              <button class="btn-danger" style="padding: 0.3rem 0.6rem; margin-left: 0.3rem;" onclick="window.adminDeleteItem('${item.id}')">삭제</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  window.adminEditItem = function (id) {
    const item = currentData.items.find(x => x.id === id);
    if (!item) return;

    editingItem = item;
    elEditModalTitle.textContent = `아이템 수정: ${item.name}`;

    elEditItemId.value = item.id;
    elEditName.value = item.name;
    elEditAliases.value = (item.aliases || []).join(', ');
    elEditCat.value = item.cat || 'weapon';
    elEditRange.value = item.range || '';
    elEditGrade.value = item.grade || '';
    elEditUsage.value = item.usage || '';
    elEditAbilities.value = (item.abilities || []).join('\n');

    elEditAwak1.value = (item.awakening && item.awakening['1']) ? item.awakening['1'].join(' / ') : '';
    elEditAwak2.value = (item.awakening && item.awakening['2']) ? item.awakening['2'].join(' / ') : '';
    elEditAwak3.value = (item.awakening && item.awakening['3']) ? item.awakening['3'].join(' / ') : '';
    elEditAwak4.value = (item.awakening && item.awakening['4']) ? item.awakening['4'].join(' / ') : '';
    elEditAwak5.value = (item.awakening && item.awakening['5']) ? item.awakening['5'].join(' / ') : '';

    elEditDrops.value = (item.drops || []).join(', ');
    elEditComment.value = item.comment || '';

    openEditModal();
  };

  window.adminDeleteItem = function (id) {
    const item = currentData.items.find(x => x.id === id);
    if (!item) return;

    if (confirm(`정말 '${item.name}' 아이템을 삭제하시겠습니까?`)) {
      currentData.items = currentData.items.filter(x => x.id !== id);
      renderTable();
      saveToLocal();
      alert(`'${item.name}' 아이템이 삭제되었습니다. [변경사항 저장]을 눌러 영구 반영하세요.`);
    }
  };

  function openEditModal() {
    elEditModalOverlay.classList.add('active');
  }

  function closeEditModal() {
    elEditModalOverlay.classList.remove('active');
  }

  function onSaveItem(e) {
    e.preventDefault();

    const name = elEditName.value.trim();
    if (!name) return;

    const cat = elEditCat.value;
    const aliases = elEditAliases.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const range = elEditRange.value || null;
    const grade = elEditGrade.value.trim() || null;
    const usage = elEditUsage.value || null;
    const abilities = elEditAbilities.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const drops = elEditDrops.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const comment = elEditComment.value.trim() || null;

    // Awakening
    const awakening = {};
    if (elEditAwak1.value.trim()) awakening['1'] = elEditAwak1.value.split('/').map(s => s.trim());
    if (elEditAwak2.value.trim()) awakening['2'] = elEditAwak2.value.split('/').map(s => s.trim());
    if (elEditAwak3.value.trim()) awakening['3'] = elEditAwak3.value.split('/').map(s => s.trim());
    if (elEditAwak4.value.trim()) awakening['4'] = elEditAwak4.value.split('/').map(s => s.trim());
    if (elEditAwak5.value.trim()) awakening['5'] = elEditAwak5.value.split('/').map(s => s.trim());

    // Tier extraction
    let tier = null;
    if (grade) {
      const m = grade.match(/[SABCDEF]/i);
      if (m) tier = m[0].toUpperCase();
    }

    // Chosung
    const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    function makeCho(s) {
      let r = '';
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i) - 0xac00;
        if (c >= 0 && c < 11172) r += CHO[Math.floor(c / 588)];
        else if (/[0-9a-zA-Z가-힣]/.test(s[i])) r += s[i].toLowerCase();
      }
      return r;
    }
    function norm(s) {
      return (s || '').replace(/[\s/·,.\-_()[\]+~]+/g, '').toLowerCase();
    }

    const textAll = abilities.concat(Object.values(awakening).flat()).join(' ');

    if (editingItem) {
      // Update existing
      editingItem.name = name;
      editingItem.aliases = aliases;
      editingItem.cat = cat;
      editingItem.range = range;
      editingItem.grade = grade;
      editingItem.tier = tier;
      editingItem.usage = usage;
      editingItem.abilities = abilities;
      editingItem.awakening = awakening;
      editingItem.drops = drops;
      editingItem.comment = comment;

      editingItem.search = {
        name: norm(name),
        cho: makeCho(norm(name)),
        alias: aliases.map(norm),
        aliasCho: aliases.map(a => makeCho(norm(a))),
        text: norm(textAll),
        comment: norm(comment || ''),
        drops: norm(drops.join(' ')),
      };
    } else {
      // Add new
      const maxNo = currentData.items
        .filter(x => x.cat === cat)
        .reduce((max, it) => Math.max(max, it.no || 0), 0);
      const newNo = maxNo + 1;
      const newId = `${cat}-${newNo}`;

      const newItem = {
        id: newId,
        cat: cat,
        no: newNo,
        name: name,
        aliases: aliases,
        range: range,
        abilities: abilities,
        tags: {},
        grade: grade,
        gradeRank: 50,
        tier: tier,
        usage: usage,
        usageLabel: usage === 'O' ? '추천' : usage === '△' ? '상황별' : usage === 'X' ? '비추천' : null,
        comment: comment,
        drops: drops,
        img: null,
        knownLevels: [0, 1, 2, 3, 4, 5],
        stats: {},
        awakening: awakening,
        search: {
          name: norm(name),
          cho: makeCho(norm(name)),
          alias: aliases.map(norm),
          aliasCho: aliases.map(a => makeCho(norm(a))),
          text: norm(textAll),
          comment: norm(comment || ''),
          drops: norm(drops.join(' ')),
        },
      };
      currentData.items.push(newItem);
    }

    renderTable();
    saveToLocal();
    closeEditModal();
    alert(`'${name}' 아이템이 성공적으로 저장되었습니다!`);
  }

  function saveToLocal() {
    localStorage.setItem('underdark_items_data', JSON.stringify(currentData));
  }

  async function saveAllChanges() {
    saveToLocal();

    // Try posting to local server if available
    try {
      const res = await fetch('/api/save-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData),
      });
      if (res.ok) {
        alert('✅ 서버 파일(data/items.json & items.js)과 브라우저에 모두 성공적으로 저장되었습니다!');
        return;
      }
    } catch (e) {
      // server API not reachable (running on static file or GitHub Pages)
    }

    alert('✅ 브라우저 로컬 스토리지에 저장되었습니다!\n(정적 호스팅 환경에서는 상단의 [JSON 다운로드] 버튼을 이용해 파일을 교체할 수 있습니다.)');
  }

  function downloadJson() {
    if (!currentData) return;
    const jsonStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetData() {
    if (confirm('정말로 로컬의 모든 수정을 취소하고 원본 엑셀 데이터로 초기화하시겠습니까?')) {
      localStorage.removeItem('underdark_items_data');
      location.reload();
    }
  }
})();

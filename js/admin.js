/**
 * Underdark Admin Portal Controller
 * - ID / PW Authentication (admin / underdark1234)
 * - Opens Google Sheets Headless CMS in a new tab upon login
 * - Session state handling
 */

(function () {
  'use strict';

  const DEFAULT_ID = 'admin';
  const DEFAULT_PW = 'underdark1234';
  const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1rT0VUnOxTHSo_k8xa4MIyzWtQdxSuhTi/edit?usp=sharing';

  let elLoginSection;
  let elLoginForm;
  let elAdminId;
  let elAdminPw;
  let elLoginError;
  let elDashboardSection;
  let elLogoutBtn;
  let elOpenSheetBtn;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
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
    elOpenSheetBtn = document.getElementById('openSheetBtn');
  }

  function bindEvents() {
    if (elLoginForm) {
      elLoginForm.addEventListener('submit', handleLogin);
    }
    if (elLogoutBtn) {
      elLogoutBtn.addEventListener('click', handleLogout);
    }
  }

  function checkAuth() {
    const isAuthed = sessionStorage.getItem('underdark_admin_auth') === 'true';
    if (isAuthed) {
      showDashboard(false);
    } else {
      showLogin();
    }
  }

  function showLogin() {
    if (elLoginSection) elLoginSection.style.display = 'flex';
    if (elDashboardSection) elDashboardSection.style.display = 'none';
    if (elLogoutBtn) elLogoutBtn.style.display = 'none';
    if (elLoginError) elLoginError.style.display = 'none';
    if (elAdminPw) elAdminPw.value = '';
    setTimeout(() => {
      if (elAdminId && !elAdminId.value) elAdminId.focus();
      else if (elAdminPw) elAdminPw.focus();
    }, 100);
  }

  function showDashboard(justLoggedIn = false) {
    if (elLoginSection) elLoginSection.style.display = 'none';
    if (elDashboardSection) elDashboardSection.style.display = 'block';
    if (elLogoutBtn) elLogoutBtn.style.display = 'inline-flex';
  }

  function handleLogin(e) {
    e.preventDefault();
    const id = (elAdminId.value || '').trim();
    const pw = (elAdminPw.value || '').trim();
    const validPw = localStorage.getItem('underdark_admin_pw') || DEFAULT_PW;

    if (id === DEFAULT_ID && pw === validPw) {
      if (elLoginError) elLoginError.style.display = 'none';
      sessionStorage.setItem('underdark_admin_auth', 'true');
      showDashboard(true);
      window.open(GOOGLE_SHEET_URL, '_blank');
    } else {
      if (elLoginError) {
        elLoginError.style.display = 'block';
      }
      if (elAdminPw) {
        elAdminPw.select();
        elAdminPw.focus();
      }
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('underdark_admin_auth');
    showLogin();
  }
})();

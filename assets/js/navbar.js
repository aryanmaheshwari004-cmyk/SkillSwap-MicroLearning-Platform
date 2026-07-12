/**
 * Skill Swap - Navbar Logic
 * Manages auth-state visibility (guest vs. authenticated),
 * avatar photo, username display, logout, and mobile burger menu.
 * Depends on: config.js, utils.js, auth-guard.js (loaded before this file).
 * Safe to include on every page — exits early if #navbar is absent.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  // ── Element refs ────────────────────────────────────────────────────────
  const actionsGuest    = document.getElementById('navbar-actions-guest');
  const actionsAuth     = document.getElementById('navbar-actions-auth');
  const avatarImg       = document.getElementById('navbar-avatar-img');
  const avatarBtn       = document.getElementById('navbar-avatar-btn');
  const burgerBtn       = document.getElementById('navbar-burger');
  const mobileMenu      = document.getElementById('navbar-mobile-menu');
  const mobileLogin     = document.getElementById('navbar-mobile-login');
  const mobileRegister  = document.getElementById('navbar-mobile-register');
  // Dashboard uses a bespoke profile pill with a username span
  const dashProfileBtn  = document.getElementById('dash-nav-profile-btn');
  const dashUsername    = document.getElementById('dash-nav-username');
  // Logout button (injected by this script into the auth section)
  let logoutBtn         = document.getElementById('navbar-logout-btn');

  // ── Inject a Logout button if not already present ───────────────────────
  // We add it once into #navbar-actions-auth so every page gets it without
  // requiring each HTML file to be manually edited.
  function ensureLogoutButton() {
    if (logoutBtn || !actionsAuth) return;

    logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.id   = 'navbar-logout-btn';
    logoutBtn.className = 'navbar-logout-btn';
    logoutBtn.setAttribute('aria-label', 'Log out');
    logoutBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      <span>Log out</span>`;
    actionsAuth.appendChild(logoutBtn);
  }

  // ── Show authenticated state ─────────────────────────────────────────────
  function showAuthState(user) {
    // Desktop: hide guest, show auth
    if (actionsGuest) actionsGuest.classList.add('hidden');
    if (actionsAuth)  actionsAuth.classList.remove('hidden');

    // Mobile: hide login/register buttons
    if (mobileLogin)    mobileLogin.classList.add('hidden');
    if (mobileRegister) mobileRegister.classList.add('hidden');

    // Populate avatar photo
    if (user.profile_photo) {
      if (avatarImg) avatarImg.src = user.profile_photo;
      // Dashboard uses a separate img inside dash-nav-profile-btn
      const dashAvatarImg = dashProfileBtn
        ? dashProfileBtn.querySelector('img')
        : null;
      if (dashAvatarImg) dashAvatarImg.src = user.profile_photo;
    }

    // Populate username (dashboard pill)
    if (dashUsername && user.name) {
      dashUsername.textContent = user.name.split(' ')[0]; // first name only
    }
  }

  // ── Show guest state ─────────────────────────────────────────────────────
  function showGuestState() {
    if (actionsGuest) actionsGuest.classList.remove('hidden');
    if (actionsAuth)  actionsAuth.classList.add('hidden');
    if (mobileLogin)    mobileLogin.classList.remove('hidden');
    if (mobileRegister) mobileRegister.classList.remove('hidden');
  }

  // ── Main render ──────────────────────────────────────────────────────────
  async function renderNavbarState() {
    ensureLogoutButton();

    const session = await AuthGuard.checkAuthOptional();

    if (session.authenticated && session.user) {
      showAuthState(session.user);
    } else {
      showGuestState();
    }
  }

  // ── Logout handler ───────────────────────────────────────────────────────
  async function handleLogout() {
    if (!logoutBtn) return;

    const originalContent = logoutBtn.innerHTML;
    logoutBtn.disabled    = true;
    logoutBtn.innerHTML   = '<span>Logging out…</span>';

    try {
      await Utils.apiRequest(CONFIG.ENDPOINTS.LOGOUT, { method: 'POST' });
    } catch (_) {
      // Even on network error, redirect — server-side session is likely gone.
    }

    // Bust the AuthGuard cache so the next page load re-checks
    AuthGuard._cachedSession = null;

    window.location.href = 'login.html';
  }

  // ── Avatar click → profile page ──────────────────────────────────────────
  if (avatarBtn) {
    avatarBtn.addEventListener('click', function () {
      window.location.href = 'profile.html';
    });
  }

  // ── Burger / mobile menu toggle ──────────────────────────────────────────
  if (burgerBtn && mobileMenu) {
    burgerBtn.addEventListener('click', function () {
      const isOpen = mobileMenu.classList.toggle('is-open');
      burgerBtn.setAttribute('aria-expanded', String(isOpen));
      burgerBtn.classList.toggle('is-active', isOpen);
    });

    // Close mobile menu on outside click
    document.addEventListener('click', function (e) {
      if (
        mobileMenu.classList.contains('is-open') &&
        !navbar.contains(e.target)
      ) {
        mobileMenu.classList.remove('is-open');
        burgerBtn.setAttribute('aria-expanded', 'false');
        burgerBtn.classList.remove('is-active');
      }
    });
  }

  // ── Logout button click (delegated — button injected dynamically) ────────
  if (actionsAuth) {
    actionsAuth.addEventListener('click', function (e) {
      if (e.target.closest('#navbar-logout-btn')) {
        handleLogout();
      }
    });
  }

  // ── Mobile menu: also wire logout if injected there later ───────────────
  if (mobileMenu) {
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('#navbar-logout-btn-mobile')) {
        handleLogout();
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  renderNavbarState();
});

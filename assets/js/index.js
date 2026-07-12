/**
 * Skill Swap - Landing Page Logic
 * Smooth-scrolls in-page anchor links (How it Works, Categories)
 * and adjusts the hero CTA for visitors who are already logged in,
 * so returning users land on their dashboard instead of the
 * registration form.
 * Depends on: config.js, utils.js, auth-guard.js, navbar.js.
 */

(function () {
  'use strict';

  /**
   * Smooth-scrolls to a same-page anchor target instead of relying on
   * the browser's default jump, since base.css already sets
   * scroll-behavior: smooth on <html> — this handles the case where
   * a person navigates to index.html#section from a different page
   * and the browser performs the scroll before styles are settled.
   */
  function wireAnchorLinks() {
    const anchorLinks = document.querySelectorAll('a[href^="index.html#"], a[href^="#"]');

    anchorLinks.forEach((link) => {
      link.addEventListener('click', function (event) {
        const href = link.getAttribute('href');
        const hashIndex = href.indexOf('#');
        if (hashIndex === -1) return;

        const targetId = href.slice(hashIndex + 1);
        const targetEl = document.getElementById(targetId);

        if (targetEl) {
          event.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /**
   * For an already-authenticated visitor, repoints the hero's primary
   * CTA from "Join Skill Swap free" to the dashboard, since registering
   * again isn't a relevant action for them. Leaves every other link
   * untouched.
   */
  async function adjustHeroForAuthenticatedVisitor() {
    const session = await AuthGuard.checkAuthOptional();
    if (!session.authenticated) return;

    const heroPrimaryCta = document.querySelector('.hero-cta-group .btn-primary');
    if (heroPrimaryCta) {
      heroPrimaryCta.textContent = 'Go to your dashboard';
      heroPrimaryCta.href = 'dashboard.html';
    }

    const finalCta = document.querySelector('.cta-banner-inner .btn-primary');
    if (finalCta) {
      finalCta.textContent = 'Go to your dashboard';
      finalCta.href = 'dashboard.html';
    }
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  wireAnchorLinks();
  adjustHeroForAuthenticatedVisitor();
})();

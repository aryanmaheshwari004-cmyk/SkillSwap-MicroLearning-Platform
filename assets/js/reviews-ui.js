/**
 * Skill Swap - Reviews UI Enhancement Layer
 * Adds: search/filter, verified badge rendering, animated counters,
 * and rich card HTML. Works alongside reviews.js without modifying it.
 *
 * Strategy:
 *  - Monkey-patch the renderReviewsList function after reviews.js loads.
 *  - After each render, add search + filter listeners & sync stat counters.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────────────────
     Helpers
     ────────────────────────────────────────────────────────────────────────── */

  function renderStars(rating) {
    if (rating === null || rating === undefined) return '';
    const full = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= full
        ? '★'
        : '<span class="star-empty">★</span>';
    }
    return html;
  }

  function fmtDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch (_) {
      return '';
    }
  }

  /** Animated count-up for hero stat values */
  function countUp(el, target, suffix) {
    if (!el) return;
    const isFloat = !Number.isInteger(target);
    const duration = 900;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = target * ease;
      el.textContent = isFloat
        ? val.toFixed(1) + (suffix || '')
        : Math.round(val) + (suffix || '');
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Build a rich review card
     ────────────────────────────────────────────────────────────────────────── */

  function buildReviewCard(review) {
    const photoSrc  = review.reviewer_photo || 'assets/images/default-avatar.png';
    const date      = fmtDate(review.created_at);
    const stars     = renderStars(review.rating);
    const ratingNum = parseInt(review.rating, 10) || 0;

    // All reviews from completed sessions are "verified"
    const verifiedBadge = `
      <span class="rv-verified-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M22 4 12 14.01l-3-3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Verified
      </span>`;

    const commentHTML = review.comment
      ? `<div class="rv-comment-wrap">
           <span class="rv-quote-mark" aria-hidden="true">"</span>
           <p class="review-list-comment">${escHtml(review.comment)}</p>
         </div>`
      : '';

    const item = document.createElement('div');
    item.className    = 'review-list-item';
    item.dataset.rating = ratingNum;
    item.dataset.comment = (review.comment || '').toLowerCase();
    item.dataset.author  = (review.reviewer_name || '').toLowerCase();

    item.innerHTML = `
      <div class="review-list-header">
        <div class="rv-avatar-wrap">
          <img src="${escHtml(photoSrc)}" alt="${escHtml(review.reviewer_name)}" class="avatar">
        </div>
        <div class="rv-author-block">
          <span class="review-list-author">${escHtml(review.reviewer_name)}</span>
          <div class="rv-author-meta">
            <span class="rv-card-stars star-rating">${stars}</span>
            ${verifiedBadge}
          </div>
        </div>
        <span class="review-list-date">${escHtml(date)}</span>
      </div>
      ${commentHTML}
    `;

    return item;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Search & Filter logic
     ────────────────────────────────────────────────────────────────────────── */

  let _activeFilter = 'all';
  let _searchQuery  = '';

  function applyFilters() {
    const container = document.getElementById('reviews-list-container');
    const emptyState = document.getElementById('reviews-empty-state');
    if (!container) return;

    const items   = Array.from(container.querySelectorAll('.review-list-item'));
    let visible   = 0;

    items.forEach((item) => {
      const rating  = parseInt(item.dataset.rating, 10);
      const comment = item.dataset.comment || '';
      const author  = item.dataset.author  || '';
      const query   = _searchQuery.toLowerCase().trim();

      // Filter check
      let filterPass = true;
      if (_activeFilter === '5')   filterPass = rating === 5;
      else if (_activeFilter === '4') filterPass = rating === 4;
      else if (_activeFilter === '3') filterPass = rating === 3;
      else if (_activeFilter === 'low') filterPass = rating <= 2;

      // Search check
      const searchPass = !query || comment.includes(query) || author.includes(query);

      const show = filterPass && searchPass;
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // Update count badge
    const badge = document.getElementById('rv-feed-count-badge');
    if (badge) {
      badge.textContent = visible === items.length
        ? 'All'
        : `${visible} / ${items.length}`;
    }

    // Show/hide empty state
    if (emptyState) {
      if (items.length > 0 && visible === 0) {
        emptyState.classList.remove('hidden');
        emptyState.querySelector('.rv-empty-title').textContent = 'No matching reviews';
        emptyState.querySelector('.rv-empty-body').textContent  = 'Try adjusting your search or filters.';
      } else if (items.length === 0) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
      }
    }
  }

  function setupControls() {
    // Search
    const searchInput = document.getElementById('rv-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        _searchQuery = this.value;
        applyFilters();
      });
    }

    // Filter buttons
    document.querySelectorAll('.rv-filter-btn').forEach((btn) => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.rv-filter-btn').forEach((b) => b.classList.remove('is-active'));
        this.classList.add('is-active');
        _activeFilter = this.dataset.filter || 'all';
        applyFilters();
      });
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Hero stat counter sync
     ────────────────────────────────────────────────────────────────────────── */

  function syncHeroStats(reviews, avgRating, reviewCount) {
    // Average rating
    const avgEl = document.getElementById('rv-stat-avg');
    if (avgEl) {
      if (avgRating !== null) {
        countUp(avgEl, parseFloat(avgRating), '★');
      } else {
        avgEl.textContent = '—';
      }
    }

    // Total reviews
    const countEl = document.getElementById('rv-stat-count');
    if (countEl) countUp(countEl, reviewCount || 0);

    // Verified sessions (= all reviews from completed sessions)
    const verifiedEl = document.getElementById('rv-stat-verified');
    if (verifiedEl) countUp(verifiedEl, reviewCount || 0);

    // 5-star percentage
    const fiveStarEl = document.getElementById('rv-stat-5star');
    if (fiveStarEl && reviews) {
      const fiveCount  = reviews.filter((r) => parseInt(r.rating, 10) === 5).length;
      const pct        = reviewCount > 0 ? Math.round((fiveCount / reviewCount) * 100) : 0;
      countUp(fiveStarEl, pct, '%');
    }

    // Update count badge in feed header
    const badge = document.getElementById('rv-feed-count-badge');
    if (badge) badge.textContent = `${reviewCount || 0} total`;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Override renderReviewsList from reviews.js
     ────────────────────────────────────────────────────────────────────────── */

  /**
   * We wait for the DOM to be fully initialised (reviews.js runs after us
   * due to script order), then patch by observing changes to the container.
   * reviews.js populates #reviews-list-container; we intercept via a
   * MutationObserver and re-render with richer HTML.
   */

  let _latestReviews = [];

  function patchContainer() {
    const container = document.getElementById('reviews-list-container');
    if (!container) return;

    const observer = new MutationObserver(function () {
      // Detect raw items injected by original reviews.js (.review-list-item)
      // that are NOT yet enhanced (no rv-author-block = not ours)
      const rawItems = container.querySelectorAll('.review-list-item:not([data-enhanced])');
      if (rawItems.length === 0) return;

      // Rebuild using our rich template from cached data
      if (_latestReviews.length === 0) return;

      observer.disconnect(); // prevent recursion
      container.innerHTML = '';
      _latestReviews.forEach((review, idx) => {
        const card = buildReviewCard(review);
        card.dataset.enhanced = 'true';
        card.style.animationDelay = `${idx * 60}ms`;
        container.appendChild(card);
      });
      applyFilters();
      observer.observe(container, { childList: true });
    });

    observer.observe(container, { childList: true });
  }

  /**
   * Hook into the global loadReviews callback by wrapping the original
   * renderReviewsList after both scripts have loaded.
   */
  function hookReviewsJs() {
    // reviews.js is an IIFE — we cannot access its inner functions directly.
    // Instead we intercept the summary data by observing rating-summary-score
    // changes and the list container for raw items.
    const scoreEl = document.getElementById('rating-summary-score');
    const countEl = document.getElementById('rating-summary-count');

    // Watch for score updates (means reviews loaded)
    const scoreObserver = new MutationObserver(function () {
      const rawScore = scoreEl ? scoreEl.textContent.trim() : null;
      const rawCount = countEl ? countEl.textContent.trim() : '';
      const avg  = (rawScore && rawScore !== '—') ? parseFloat(rawScore) : null;
      const match = rawCount.match(/\d+/);
      const cnt  = match ? parseInt(match[0], 10) : 0;
      syncHeroStats(_latestReviews, avg, cnt);
    });

    if (scoreEl) scoreObserver.observe(scoreEl, { childList: true, characterData: true, subtree: true });

    // Also intercept the list container to capture rendered items and rebuild them
    const listEl = document.getElementById('reviews-list-container');
    if (listEl) {
      const listObserver = new MutationObserver(function () {
        const rawItems = listEl.querySelectorAll('.review-list-item:not([data-enhanced])');
        if (rawItems.length === 0) return;

        listObserver.disconnect();

        // Parse data from raw items injected by reviews.js
        const parsed = [];
        rawItems.forEach((item) => {
          const authorEl  = item.querySelector('.review-list-author');
          const starsEl   = item.querySelector('.star-rating');
          const dateEl    = item.querySelector('.review-list-date');
          const commentEl = item.querySelector('.review-list-comment');
          const imgEl     = item.querySelector('img');

          parsed.push({
            reviewer_name:  authorEl  ? authorEl.textContent.trim()  : 'Anonymous',
            reviewer_photo: imgEl     ? imgEl.getAttribute('src')     : null,
            rating:         starsEl   ? (starsEl.querySelectorAll('★, .star-rating > *:not(.star-empty)').length || countFilledStars(starsEl)) : 0,
            created_at:     dateEl    ? parseDateFromText(dateEl.textContent.trim()) : new Date().toISOString(),
            comment:        commentEl ? commentEl.textContent.trim()  : '',
          });
        });

        // Fallback rating count via star chars
        parsed.forEach((r, i) => {
          if (!r.rating) {
            const item = rawItems[i];
            if (item) {
              const starSpans = item.querySelectorAll('.star-rating');
              starSpans.forEach((s) => {
                const text = s.textContent;
                const filled = (text.match(/★/g) || []).length;
                const empty  = s.querySelectorAll('.star-empty').length;
                r.rating = filled - empty + empty; // filled includes empty coloured, recount
                r.rating = filled;
              });
            }
          }
        });

        _latestReviews = parsed;

        // Rebuild with rich UI
        listEl.innerHTML = '';
        _latestReviews.forEach((review, idx) => {
          const card = buildReviewCard(review);
          card.dataset.enhanced = 'true';
          card.style.animationDelay = `${idx * 60}ms`;
          listEl.appendChild(card);
        });

        applyFilters();
        listObserver.observe(listEl, { childList: true });
      });

      listObserver.observe(listEl, { childList: true });
    }
  }

  function countFilledStars(starsEl) {
    if (!starsEl) return 0;
    const text    = starsEl.innerHTML;
    const empties = (text.match(/star-empty/g) || []).length;
    const total   = (text.match(/★/g) || []).length;
    return total - empties;
  }

  function parseDateFromText(text) {
    try {
      const d = new Date(text);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Init
     ────────────────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    setupControls();
    hookReviewsJs();
  });

})();

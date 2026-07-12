/**
 * Skill Swap - Browse Skills Page Logic
 * Handles keyword search, filter chips, mentor card rendering,
 * and pagination by calling search_skills.php / filter_skills.php.
 * Depends on: config.js, utils.js, auth-guard.js, navbar.js.
 */

(function () {
  'use strict';

  const searchForm = document.getElementById('browse-search-form');
  const searchInput = document.getElementById('browse-search-input');
  const filtersPanel = document.getElementById('browse-filters-panel');
  const filtersToggleBtn = document.getElementById('browse-filters-toggle-btn');
  const filtersClearBtn = document.getElementById('browse-filters-clear-btn');
  const categoryChipsContainer = document.getElementById('filter-category-chips');
  const resultsGrid = document.getElementById('mentor-card-grid');
  const resultsCount = document.getElementById('browse-results-count');
  const emptyState = document.getElementById('browse-empty-state');
  const paginationNav = document.getElementById('browse-pagination');

  const state = {
    q: '',
    category: '',
    experience_level: '',
    proficiency: '',
    rating: '',
    availability: false,
    page: 1,
  };

  const EXPERIENCE_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

  /**
   * Builds a star rating string (filled/empty) for display.
   * @param {number|null} rating
   * @returns {string}
   */
  function renderStars(rating) {
    if (rating === null) return '<span class="text-muted">No ratings yet</span>';
    const fullStars = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= fullStars ? '★' : '<span class="star-empty">★</span>';
    }
    return html;
  }

  /**
   * Renders the category filter chips from the categories list,
   * fetched once via get_my_skills.php's category list (public reuse
   * is avoided; instead categories are inferred from filter results).
   * Since categories are a small static lookup table, we hardcode
   * the known set here matching database/skillswap.sql seed data.
   */
  function renderCategoryChips() {
    const categories = [
      { id: 1, name: 'Programming & Development' },
      { id: 2, name: 'Design & Creative' },
      { id: 3, name: 'Business & Marketing' },
      { id: 4, name: 'Languages' },
      { id: 5, name: 'Music & Arts' },
      { id: 6, name: 'Data & Analytics' },
      { id: 7, name: 'Writing & Content' },
      { id: 8, name: 'Personal Development' },
      { id: 9, name: 'Other' },
    ];

    categories.forEach((cat) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'browse-filter-chip';
      chip.dataset.value = String(cat.id);
      chip.textContent = cat.name;
      categoryChipsContainer.appendChild(chip);
    });
  }

  /**
   * Renders a single mentor card element for a skill result.
   * @param {Object} item
   * @returns {HTMLElement}
   */
  function renderMentorCard(item) {
    const card = document.createElement('article');
    card.className = 'mentor-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${item.mentor_name} — ${item.skill_name}`);

    const photoSrc = item.mentor_photo || 'assets/images/default-avatar.png';
    const experienceLabel = EXPERIENCE_LABELS[item.mentor_experience] || 'Beginner';
    const expClass = (item.mentor_experience || 'beginner').toLowerCase();

    // Build rating markup
    let ratingHTML;
    if (item.mentor_rating !== null) {
      ratingHTML = `
        <span class="mentor-card-stars">${renderStars(item.mentor_rating)}</span>
        <span class="mentor-card-rating-num">${parseFloat(item.mentor_rating).toFixed(1)}</span>
        <span class="mentor-card-review-count">(${item.mentor_review_count || 0})</span>
      `;
    } else {
      ratingHTML = `<span class="mentor-card-no-rating">No reviews yet</span>`;
    }

    // Session count (may be missing in older API — default to 0)
    const sessionCount = item.session_count !== undefined ? item.session_count : 0;

    card.innerHTML = `
      <!-- Header: avatar + meta + experience badge -->
      <div class="mentor-card-header">
        <div class="mentor-card-avatar-wrap">
          <img src="${photoSrc}" alt="${item.mentor_name}" class="mentor-card-avatar">
          <span class="mentor-card-avail-dot" title="Available"></span>
        </div>
        <div class="mentor-card-meta">
          <div class="mentor-card-name">${item.mentor_name}</div>
          <div class="mentor-card-rating-row">${ratingHTML}</div>
        </div>
        <span class="mentor-card-exp-badge mentor-card-exp-badge--${expClass}">${experienceLabel}</span>
      </div>

      <!-- Skill name -->
      <div class="mentor-card-skill-name">${item.skill_name}</div>

      <!-- Description -->
      <p class="mentor-card-description">${item.description || 'No description provided.'}</p>

      <!-- Skill / category tags -->
      <div class="mentor-card-skill-tags">
        <span class="mentor-card-category-tag">${item.category_name || 'Uncategorized'}</span>
        <span class="mentor-card-skill-tag">${item.skill_name}</span>
      </div>

      <!-- Divider -->
      <div class="mentor-card-divider"></div>

      <!-- Footer: session count + CTA -->
      <div class="mentor-card-footer">
        <span class="mentor-card-sessions">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ${sessionCount} session${sessionCount !== 1 ? 's' : ''}
        </span>
        <span class="mentor-card-cta">
          View profile
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </div>
    `;

    const navigate = () => { window.location.href = `skill-detail.html?id=${item.id}`; };
    card.addEventListener('click', navigate);
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter') navigate(); });

    return card;
  }

  /**
   * Renders pagination controls based on the current pagination state.
   * @param {{page: number, total_pages: number}} pagination
   */
  function renderPagination(pagination) {
    paginationNav.innerHTML = '';

    if (pagination.total_pages <= 1) {
      paginationNav.classList.add('hidden');
      return;
    }

    paginationNav.classList.remove('hidden');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'browse-pagination-btn';
    prevBtn.textContent = '‹';
    prevBtn.disabled = pagination.page <= 1;
    prevBtn.addEventListener('click', () => {
      state.page = Math.max(1, state.page - 1);
      fetchResults();
    });
    paginationNav.appendChild(prevBtn);

    for (let p = 1; p <= pagination.total_pages; p++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `browse-pagination-btn${p === pagination.page ? ' is-active' : ''}`;
      pageBtn.textContent = String(p);
      pageBtn.addEventListener('click', () => {
        state.page = p;
        fetchResults();
      });
      paginationNav.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'browse-pagination-btn';
    nextBtn.textContent = '›';
    nextBtn.disabled = pagination.page >= pagination.total_pages;
    nextBtn.addEventListener('click', () => {
      state.page = Math.min(pagination.total_pages, state.page + 1);
      fetchResults();
    });
    paginationNav.appendChild(nextBtn);
  }

  /**
   * Fetches results from filter_skills.php using the current state,
   * then renders the mentor card grid.
   */
  async function fetchResults() {
    resultsGrid.innerHTML = Array(6).fill('<div class="mentor-card-skeleton" aria-hidden="true"></div>').join('');
    emptyState.classList.add('hidden');

    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.experience_level) params.set('experience_level', state.experience_level);
    if (state.proficiency) params.set('proficiency', state.proficiency);
    if (state.rating) params.set('rating', state.rating);
    if (state.availability) params.set('availability', 'true');
    params.set('page', String(state.page));

    const url = `${CONFIG.ENDPOINTS.FILTER_SKILLS}?${params.toString()}`;
    const { ok, data } = await Utils.apiRequest(url, { method: 'GET' });

    resultsGrid.innerHTML = '';

    if (!ok || !data.success) {
      resultsCount.textContent = 'Could not load results.';
      Utils.showToast(data.message || 'Something went wrong.', 'error');
      return;
    }

    const { results, pagination } = data.data;

    resultsCount.textContent = `${pagination.total_results} mentor${pagination.total_results === 1 ? '' : 's'} found`;

    if (results.length === 0) {
      emptyState.classList.remove('hidden');
      renderPagination({ page: 1, total_pages: 0 });
      return;
    }

    results.forEach((item) => {
      resultsGrid.appendChild(renderMentorCard(item));
    });

    renderPagination(pagination);
  }

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------

  searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    state.q = searchInput.value.trim();
    state.page = 1;
    fetchResults();
  });

  document.querySelectorAll('.browse-filter-chip-row').forEach((row) => {
    const filterKey = row.dataset.filter;
    row.addEventListener('click', function (event) {
      const chip = event.target.closest('.browse-filter-chip');
      if (!chip) return;

      row.querySelectorAll('.browse-filter-chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');

      state[filterKey] = chip.dataset.value;
      state.page = 1;
      fetchResults();
    });
  });

  filtersClearBtn.addEventListener('click', function () {
    state.q = '';
    state.category = '';
    state.experience_level = '';
    state.proficiency = '';
    state.rating = '';
    state.availability = false;
    state.page = 1;
    searchInput.value = '';

    const availabilityCheckbox = document.getElementById('filter-availability');
    if (availabilityCheckbox) {
      availabilityCheckbox.checked = false;
    }

    document.querySelectorAll('.browse-filter-chip-row').forEach((row) => {
      row.querySelectorAll('.browse-filter-chip').forEach((c) => c.classList.remove('is-active'));
      row.querySelector('.browse-filter-chip[data-value=""]')?.classList.add('is-active');
    });

    fetchResults();
  });

  // Availability checkbox change event
  const availabilityCheckbox = document.getElementById('filter-availability');
  if (availabilityCheckbox) {
    availabilityCheckbox.addEventListener('change', function () {
      state.availability = availabilityCheckbox.checked;
      state.page = 1;
      fetchResults();
    });
  }

  filtersToggleBtn.addEventListener('click', function () {
    const isOpen = filtersPanel.classList.toggle('is-open');
    filtersToggleBtn.setAttribute('aria-expanded', String(isOpen));
  });

  // Empty-state reset button
  const emptyResetBtn = document.getElementById('browse-empty-reset-btn');
  if (emptyResetBtn) {
    emptyResetBtn.addEventListener('click', function () {
      filtersClearBtn.click();
    });
  }

  // Quick category pills in hero
  document.querySelectorAll('.browse-quick-cat-pill').forEach((pill) => {
    pill.addEventListener('click', function () {
      document.querySelectorAll('.browse-quick-cat-pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const catId = pill.dataset.catId || '';
      state.category = catId;
      state.page = 1;
      // also sync filter chips
      const catChipRow = document.getElementById('filter-category-chips');
      if (catChipRow) {
        catChipRow.querySelectorAll('.browse-filter-chip').forEach((c) => c.classList.remove('is-active'));
        const matching = catChipRow.querySelector(`.browse-filter-chip[data-value="${catId}"]`);
        if (matching) matching.classList.add('is-active');
        else catChipRow.querySelector('.browse-filter-chip[data-value=""]')?.classList.add('is-active');
      }
      fetchResults();
    });
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  (function init() {
    renderCategoryChips();

    // Pre-fill from URL query params (e.g. landing page category links).
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      // Category links from index.html use slugs, not ids; this is a
      // best-effort match left for future enhancement. For now, fetch
      // unfiltered results.
    }

    fetchResults();
  })();
})();

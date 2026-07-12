/**
 * Skill Swap — My Skills UI Enhancements
 *
 * Handles:
 *   1. Client-side search (filters rendered skill cards by name)
 *   2. Client-side category + proficiency level filter
 *   3. Hero stats counters (offered / wanted / categories)
 *   4. Tab count badge updates
 *   5. Proficiency pill → hidden select sync (keeps my-skills.js form working)
 *   6. Character counter for description textarea
 *   7. Empty-state CTAs wired to the Add button (same as myskills-add-btn)
 *   8. Filter toolbar visibility (level filter hidden on Wanted tab)
 *   9. Category filter population from skill data
 *
 * TECHNICAL CONTRACT:
 *   - Does NOT intercept or modify my-skills.js.
 *   - Reads rendered DOM after my-skills.js populates it via MutationObserver.
 *   - All original IDs, form fields and class hooks remain untouched.
 *   - Removing this file leaves the page fully functional.
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Element refs
     ----------------------------------------------------------------------- */
  const searchInput    = document.getElementById('ms-search-input');
  const searchClear    = document.getElementById('ms-search-clear');
  const filterCategory = document.getElementById('ms-filter-category');
  const filterLevel    = document.getElementById('ms-filter-level');
  const filterLevelWrap = document.getElementById('ms-filter-level-wrap');

  const offeredList    = document.getElementById('offered-skills-list');
  const wantedList     = document.getElementById('wanted-skills-list');

  const statOffered    = document.getElementById('ms-stat-offered');
  const statWanted     = document.getElementById('ms-stat-wanted');
  const statCategories = document.getElementById('ms-stat-categories');

  const tabCountOffered = document.getElementById('tab-count-offered');
  const tabCountWanted  = document.getElementById('tab-count-wanted');

  const descTextarea   = document.getElementById('skill-form-description');
  const descCount      = document.getElementById('ms-desc-count');

  const addBtn         = document.getElementById('myskills-add-btn');
  const emptyAddOffered = document.getElementById('ms-offered-empty-add-btn');
  const emptyAddWanted  = document.getElementById('ms-wanted-empty-add-btn');

  const profPills      = document.querySelectorAll('.ms-prof-pill input[type="radio"]');
  const hiddenProfSelect = document.getElementById('skill-form-proficiency');

  const tabButtons     = document.querySelectorAll('.myskills-tab-btn');

  /* -----------------------------------------------------------------------
     Active tab tracker
     ----------------------------------------------------------------------- */
  let activeTab = 'offered';

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateFilterLevelVisibility();
      applyFilters();
    });
  });

  function updateFilterLevelVisibility() {
    if (filterLevelWrap) {
      filterLevelWrap.style.display = activeTab === 'offered' ? '' : 'none';
    }
  }

  /* -----------------------------------------------------------------------
     1+2. SEARCH + FILTER
     ----------------------------------------------------------------------- */
  function getCardText(card) {
    const h4  = card.querySelector('h4');
    const badges = card.querySelectorAll('.badge');
    const desc = card.querySelector('.myskills-item-description');
    let text = '';
    if (h4) text += h4.textContent + ' ';
    badges.forEach(b => { text += b.textContent + ' '; });
    if (desc) text += desc.textContent + ' ';
    return text.toLowerCase();
  }

  function getCardCategory(card) {
    const badge = card.querySelector('.badge-skill');
    return badge ? badge.textContent.trim().toLowerCase() : '';
  }

  function getCardLevel(card) {
    // badge-neutral with proficiency text
    const badges = card.querySelectorAll('.badge-neutral, .badge-prof-beginner, .badge-prof-intermediate, .badge-prof-expert');
    let level = '';
    badges.forEach(b => {
      const t = b.textContent.trim().toLowerCase();
      if (['beginner', 'intermediate', 'expert'].includes(t)) level = t;
    });
    return level;
  }

  function applyFilters() {
    const query    = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const catFilter = filterCategory ? filterCategory.value.trim().toLowerCase() : '';
    const lvlFilter = filterLevel ? filterLevel.value.trim().toLowerCase() : '';

    const activeList = activeTab === 'offered' ? offeredList : wantedList;
    if (!activeList) return;

    const cards = activeList.querySelectorAll('.myskills-item-card');
    let visible = 0;

    cards.forEach(card => {
      const text  = getCardText(card);
      const cat   = getCardCategory(card);
      const level = getCardLevel(card);

      const matchQuery = !query || text.includes(query);
      const matchCat   = !catFilter || cat === catFilter;
      const matchLevel = !lvlFilter || level === lvlFilter || activeTab !== 'offered';

      const show = matchQuery && matchCat && matchLevel;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // Show/hide no-results inline message
    let noResults = activeList.querySelector('.ms-no-results');
    if (cards.length > 0 && visible === 0) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.className = 'ms-no-results';
        noResults.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="rgba(226,232,240,0.2)" stroke-width="2"/>
            <path d="m21 21-4.35-4.35" stroke="rgba(226,232,240,0.2)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p style="color:rgba(226,232,240,0.35);font-size:0.875rem;margin:0">No skills match your filters.</p>
          <button class="ms-clear-filters-btn">Clear filters</button>
        `;
        noResults.querySelector('.ms-clear-filters-btn').addEventListener('click', clearFilters);
        activeList.appendChild(noResults);
      }
      noResults.style.display = 'flex';
    } else if (noResults) {
      noResults.style.display = 'none';
    }
  }

  function clearFilters() {
    if (searchInput)    searchInput.value = '';
    if (filterCategory) filterCategory.value = '';
    if (filterLevel)    filterLevel.value = '';
    if (searchClear)    searchClear.classList.add('hidden');
    applyFilters();
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const hasValue = searchInput.value.length > 0;
      if (searchClear) searchClear.classList.toggle('hidden', !hasValue);
      applyFilters();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      applyFilters();
    });
  }
  if (filterCategory) filterCategory.addEventListener('change', applyFilters);
  if (filterLevel)    filterLevel.addEventListener('change', applyFilters);

  /* -----------------------------------------------------------------------
     3. HERO STATS + 4. TAB COUNT BADGES
     Updated whenever the skill lists change via MutationObserver
     ----------------------------------------------------------------------- */
  function updateStats() {
    const offeredCards = offeredList ? offeredList.querySelectorAll('.myskills-item-card').length : 0;
    const wantedCards  = wantedList  ? wantedList.querySelectorAll('.myskills-item-card').length  : 0;

    // Unique categories across all visible skill cards
    const cats = new Set();
    const allCards = document.querySelectorAll('.myskills-item-card');
    allCards.forEach(card => {
      const badge = card.querySelector('.badge-skill');
      if (badge) cats.add(badge.textContent.trim());
    });

    if (statOffered)    animateCounter(statOffered,    0, offeredCards, 400, false);
    if (statWanted)     animateCounter(statWanted,     0, wantedCards,  400, false);
    if (statCategories) animateCounter(statCategories, 0, cats.size,    400, false);
    if (tabCountOffered) tabCountOffered.textContent = offeredCards;
    if (tabCountWanted)  tabCountWanted.textContent  = wantedCards;

    // Populate category filter from unique badge texts
    populateCategoryFilter(cats);
  }

  function populateCategoryFilter(categorySet) {
    if (!filterCategory) return;
    const current = filterCategory.value;
    // Keep placeholder option
    filterCategory.innerHTML = '<option value="">All Categories</option>';
    [...categorySet].sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.toLowerCase();
      opt.textContent = cat;
      filterCategory.appendChild(opt);
    });
    // Restore selection if still valid
    if (current) filterCategory.value = current;
  }

  function animateCounter(el, from, to, duration, isPercent) {
    if (!el) return;
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased) + (isPercent ? '%' : '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function observeLists() {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        updateStats();
        applyFilters();
        // Re-inject proficiency colour classes
        colourProficiencyBadges();
      });
    });
    if (offeredList) observer.observe(offeredList, { childList: true, subtree: true });
    if (wantedList)  observer.observe(wantedList,  { childList: true, subtree: true });
  }

  /* -----------------------------------------------------------------------
     PROFICIENCY BADGE COLOURING
     Applies colour variant classes to badge-neutral proficiency badges
     so they match the design system without touching my-skills.js
     ----------------------------------------------------------------------- */
  function colourProficiencyBadges() {
    document.querySelectorAll('.myskills-item-card .badge-neutral').forEach(badge => {
      const text = badge.textContent.trim().toLowerCase();
      if (text === 'beginner') {
        badge.classList.add('badge-prof-beginner');
      } else if (text === 'intermediate') {
        badge.classList.add('badge-prof-intermediate');
      } else if (text === 'expert') {
        badge.classList.add('badge-prof-expert');
      }
    });
  }

  /* -----------------------------------------------------------------------
     5. PROFICIENCY PILL ↔ HIDDEN SELECT SYNC
     The visual pills update the hidden <select> that my-skills.js reads
     ----------------------------------------------------------------------- */
  profPills.forEach(pill => {
    pill.addEventListener('change', () => {
      if (hiddenProfSelect && pill.checked) {
        hiddenProfSelect.value = pill.value;
      }
    });
  });

  // When the modal opens, sync pills FROM the hidden select (for edit mode)
  function syncPillsFromSelect() {
    if (!hiddenProfSelect) return;
    const currentVal = hiddenProfSelect.value || 'intermediate';
    profPills.forEach(pill => {
      pill.checked = pill.value === currentVal;
    });
  }

  // Watch for modal opening via MutationObserver on the overlay
  const modalOverlay = document.getElementById('myskills-modal-overlay');
  if (modalOverlay) {
    const modalObserver = new MutationObserver(() => {
      if (modalOverlay.classList.contains('is-open')) {
        syncPillsFromSelect();
        // Reset char counter
        updateCharCount();
      }
    });
    modalObserver.observe(modalOverlay, { attributes: true, attributeFilter: ['class'] });
  }

  // Also sync pills when my-skills.js calls form.reset (which fires a 'reset' event)
  const form = document.getElementById('myskills-form');
  if (form) {
    form.addEventListener('reset', () => {
      // After reset, set pills to intermediate default
      requestAnimationFrame(() => {
        profPills.forEach(pill => { pill.checked = pill.value === 'intermediate'; });
        if (hiddenProfSelect) hiddenProfSelect.value = 'intermediate';
        updateCharCount();
      });
    });
  }

  /* -----------------------------------------------------------------------
     6. CHARACTER COUNTER
     ----------------------------------------------------------------------- */
  function updateCharCount() {
    if (descTextarea && descCount) {
      descCount.textContent = descTextarea.value.length;
    }
  }
  if (descTextarea) {
    descTextarea.addEventListener('input', updateCharCount);
  }

  /* -----------------------------------------------------------------------
     7. EMPTY-STATE CTAs → trigger the main Add Skill button
     ----------------------------------------------------------------------- */
  if (emptyAddOffered) {
    emptyAddOffered.addEventListener('click', () => {
      // Switch to offered tab first
      const offeredTab = document.querySelector('.myskills-tab-btn[data-tab="offered"]');
      if (offeredTab) offeredTab.click();
      if (addBtn) addBtn.click();
    });
  }
  if (emptyAddWanted) {
    emptyAddWanted.addEventListener('click', () => {
      const wantedTab = document.querySelector('.myskills-tab-btn[data-tab="wanted"]');
      if (wantedTab) wantedTab.click();
      if (addBtn) addBtn.click();
    });
  }

  /* -----------------------------------------------------------------------
     8. NO-RESULTS PILL STYLE
     Inject inline style for the dynamically created no-results element
     ----------------------------------------------------------------------- */
  const noResultsStyle = document.createElement('style');
  noResultsStyle.textContent = `
    .ms-no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 3rem 2rem;
      text-align: center;
      grid-column: 1 / -1;
    }
    .ms-clear-filters-btn {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: rgba(124,58,237,0.15);
      border: 1px solid rgba(124,58,237,0.3);
      color: #c4b5fd;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Inter', sans-serif;
    }
    .ms-clear-filters-btn:hover {
      background: rgba(124,58,237,0.28);
      border-color: rgba(167,139,250,0.5);
    }
  `;
  document.head.appendChild(noResultsStyle);

  /* -----------------------------------------------------------------------
     INIT
     ----------------------------------------------------------------------- */
  function init() {
    updateFilterLevelVisibility();
    observeLists();

    // Stagger card animations when rendered
    document.addEventListener('animationstart', (e) => {
      if (e.animationName === 'ms-card-in') {
        const cards = document.querySelectorAll('.myskills-item-card');
        cards.forEach((card, i) => {
          card.style.animationDelay = `${i * 0.06}s`;
        });
      }
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

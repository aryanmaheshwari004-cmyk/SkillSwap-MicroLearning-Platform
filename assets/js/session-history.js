/**
 * Skill Swap - Session History Page Logic
 * Loads user's past sessions, reviews, and achievements,
 * and renders them in a premium glassmorphism timeline.
 * Supports live searching, filter dropdowns, metrics, and progress.
 * Keeps backend intact.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  // DOM elements
  const listContainer = document.getElementById('history-sessions-list');
  const emptyState = document.getElementById('history-empty-state');
  const timelineTrack = document.getElementById('timeline-track');

  // Search & Filters
  const searchInput = document.getElementById('history-search');
  const roleSelect = document.getElementById('filter-role');
  const statusSelect = document.getElementById('filter-status');
  const skillSelect = document.getElementById('filter-skill');

  // Summary Metrics
  const statCompleted = document.getElementById('stat-completed');
  const statHours = document.getElementById('stat-hours');
  const statSuccess = document.getElementById('stat-success');
  const statMilestone = document.getElementById('stat-milestone');

  // Learning Progress
  const balanceValLearn = document.getElementById('balance-val-learn');
  const balanceValMentor = document.getElementById('balance-val-mentor');
  const balancePctLearn = document.getElementById('balance-pct-learn');
  const balancePctMentor = document.getElementById('balance-pct-mentor');
  const balanceFillLearn = document.getElementById('balance-fill-learn');
  const balanceFillMentor = document.getElementById('balance-fill-mentor');

  // Badges Grid
  const badgesGrid = document.getElementById('badges-grid');

  // State
  let currentUserId = null;
  let allSessions = [];
  let receivedReviews = [];
  const counterpartReviewsCache = {}; // cached counterpart reviews lists

  const STATUS_LABELS = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  /**
   * Formats a date string (YYYY-MM-DD) into a readable label.
   */
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  /**
   * Formats a time string (HH:MM:SS) into a 12-hour readable label.
   */
  function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /**
   * Returns a static star rating HTML string.
   */
  function renderStaticStars(rating) {
    if (rating === null || rating === undefined) return '';
    const fullStars = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= fullStars ? '★' : '<span>★</span>';
    }
    return html;
  }

  /**
   * Match a received review (written by the counterpart for current user)
   * chronologically to this session.
   */
  function findReceivedReviewForSession(session) {
    const candidates = receivedReviews.filter(r => r.reviewer_id === session.counterpart_id);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const sessionTime = new Date(session.scheduled_date + 'T' + session.scheduled_time).getTime();
    let bestMatch = null;
    let minDiff = Infinity;

    candidates.forEach(r => {
      const reviewTime = new Date(r.created_at).getTime();
      const diff = reviewTime - sessionTime;
      // The review must be completed after or near the session scheduled date/time
      if (diff >= -3600000 && diff < minDiff) {
        minDiff = diff;
        bestMatch = r;
      }
    });

    return bestMatch || candidates[0];
  }

  /**
   * Fetch and match a given review (written by current user for the counterpart)
   * chronologically to this session. Caches counterpart reviews for performance.
   */
  async function getGivenReviewForSession(session) {
    if (!session.has_reviewed) return null;
    const counterpartId = session.counterpart_id;

    if (!counterpartReviewsCache[counterpartId]) {
      const { ok, data } = await Utils.apiRequest(`${CONFIG.ENDPOINTS.GET_REVIEWS}?user_id=${counterpartId}`);
      if (ok && data.success) {
        counterpartReviewsCache[counterpartId] = data.data.reviews || [];
      } else {
        counterpartReviewsCache[counterpartId] = [];
      }
    }

    const candidates = counterpartReviewsCache[counterpartId].filter(r => r.reviewer_id === currentUserId);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const sessionTime = new Date(session.scheduled_date + 'T' + session.scheduled_time).getTime();
    let bestMatch = null;
    let minDiff = Infinity;

    candidates.forEach(r => {
      const reviewTime = new Date(r.created_at).getTime();
      const diff = reviewTime - sessionTime;
      if (diff >= -3600000 && diff < minDiff) {
        minDiff = diff;
        bestMatch = r;
      }
    });

    return bestMatch || candidates[0];
  }

  /**
   * Dynamically loads reviews for cards after they are rendered to keep UI fast.
   */
  async function loadReviewDetailsForCard(session) {
    const wrapper = document.getElementById(`reviews-wrapper-${session.id}`);
    if (!wrapper) return;

    // 1. Fetch received review (from local cache of received reviews)
    const recReview = findReceivedReviewForSession(session);
    
    // 2. Fetch given review (requires async check/cache of counterpart reviews)
    const givReview = await getGivenReviewForSession(session);

    if (!recReview && !givReview) {
      return; // No reviews for this session
    }

    wrapper.innerHTML = '';

    if (recReview) {
      const recBox = document.createElement('div');
      recBox.className = 'review-display-box';
      recBox.innerHTML = `
        <div class="review-display-header">
          <span class="review-display-label">Feedback Received</span>
          <span class="review-stars-static">${renderStaticStars(recReview.rating)}</span>
        </div>
        ${recReview.comment ? `<p class="review-display-comment">"${recReview.comment}"</p>` : ''}
      `;
      wrapper.appendChild(recBox);
    }

    if (givReview) {
      const givBox = document.createElement('div');
      givBox.className = 'review-display-box';
      givBox.innerHTML = `
        <div class="review-display-header">
          <span class="review-display-label">Feedback Given</span>
          <span class="review-stars-static">${renderStaticStars(givReview.rating)}</span>
        </div>
        ${givReview.comment ? `<p class="review-display-comment">"${givReview.comment}"</p>` : ''}
      `;
      wrapper.appendChild(givBox);
    }
  }

  /**
   * Renders a single session card.
   */
  function createTimelineItem(session) {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const node = document.createElement('div');
    node.className = `timeline-node timeline-node--${session.status}`;
    item.appendChild(node);

    const card = document.createElement('article');
    card.className = `card session-card timeline-card timeline-card--${session.status}`;

    const photoSrc = session.counterpart_photo || 'assets/images/default-avatar.png';
    const roleLabel = session.my_role === 'learner' ? 'Mentor' : 'Learner';

    card.innerHTML = `
      <div class="session-card-top">
        <div class="session-card-person">
          <img src="${photoSrc}" alt="${session.counterpart_name}" class="avatar avatar-md">
          <div>
            <span class="session-card-role-label">${roleLabel}</span>
            <h4>${session.counterpart_name}</h4>
            <span class="session-card-skill">${session.skill_name}</span>
          </div>
        </div>
        <span class="status-badge status-${session.status}">${STATUS_LABELS[session.status]}</span>
      </div>
      <div class="session-card-meta-row">
        <span class="session-card-meta-item">📅 ${formatDate(session.scheduled_date)}</span>
        <span class="session-card-meta-item">🕒 ${formatTime(session.scheduled_time)}</span>
      </div>
      ${session.notes ? `<p class="session-card-notes">${session.notes}</p>` : ''}
      
      <!-- Asynchronously loaded ratings/feedback block -->
      <div class="card-reviews-wrapper" id="reviews-wrapper-${session.id}"></div>
    `;

    // Append action review button if completed and current user hasn't left feedback yet
    if (session.status === 'completed' && !session.has_reviewed) {
      const actions = document.createElement('div');
      actions.className = 'session-card-actions';

      const reviewBtn = document.createElement('a');
      reviewBtn.href = `reviews.html?session_id=${session.id}&reviewee_id=${session.counterpart_id}`;
      reviewBtn.className = 'btn btn-primary btn-sm';
      reviewBtn.textContent = 'Leave a review';
      actions.appendChild(reviewBtn);

      card.appendChild(actions);
    }

    item.appendChild(card);
    return item;
  }

  /**
   * Dynamically populates the unique skills filter dropdown options.
   */
  function populateSkillsFilter() {
    const skills = new Set();
    allSessions.forEach(s => {
      if (s.skill_name) skills.add(s.skill_name);
    });

    skillSelect.innerHTML = '<option value="all">All Skills</option>';
    
    // Sort alphabetically
    Array.from(skills).sort().forEach(skill => {
      const opt = document.createElement('option');
      opt.value = skill;
      opt.textContent = skill;
      skillSelect.appendChild(opt);
    });
  }

  /**
   * Calculates and updates the top KPI metric summary boxes.
   */
  function updateSummaryStats() {
    const completed = allSessions.filter(s => s.status === 'completed').length;
    const rejected = allSessions.filter(s => s.status === 'rejected').length;
    const cancelled = allSessions.filter(s => s.status === 'cancelled').length;
    const total = completed + rejected + cancelled;

    // Completed
    statCompleted.textContent = completed;

    // Hours Swapped
    statHours.textContent = `${completed}h`;

    // Success Rate
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    statSuccess.textContent = `${rate}%`;

    // Next Milestone Progress
    const milestones = [
      { count: 1, name: 'First Swap' },
      { count: 5, name: 'Master Swapper' },
      { count: 10, name: 'Skill Master' },
      { count: 25, name: 'Elite Swapper' }
    ];

    let nextMilestone = null;
    for (const m of milestones) {
      if (completed < m.count) {
        nextMilestone = m;
        break;
      }
    }

    if (nextMilestone) {
      statMilestone.textContent = `${completed}/${nextMilestone.count}`;
      statMilestone.title = `Progress towards ${nextMilestone.name}`;
    } else {
      statMilestone.textContent = 'Elite 🎉';
      statMilestone.title = 'All milestones completed!';
    }
  }

  /**
   * Renders the right sidebar widgets: Learning Balance and Achievements.
   */
  function renderSidebarWidgets() {
    const completed = allSessions.filter(s => s.status === 'completed');
    const learnHrs = completed.filter(s => s.my_role === 'learner').length;
    const mentorHrs = completed.filter(s => s.my_role === 'mentor').length;
    const totalHrs = learnHrs + mentorHrs;

    // Learning Balance widget
    balanceValLearn.textContent = `${learnHrs}h`;
    balanceValMentor.textContent = `${mentorHrs}h`;

    const learnPct = totalHrs > 0 ? Math.round((learnHrs / totalHrs) * 100) : 50;
    const mentorPct = totalHrs > 0 ? 100 - learnPct : 50;

    balancePctLearn.textContent = `${learnPct}% Learn`;
    balancePctMentor.textContent = `${mentorPct}% Teach`;

    balanceFillLearn.style.width = `${learnPct}%`;
    balanceFillMentor.style.width = `${mentorPct}%`;

    // Unique skills completed set
    const uniqueSkills = new Set();
    completed.forEach(s => {
      if (s.skill_name) uniqueSkills.add(s.skill_name);
    });

    // Check if received any 5-star review
    const hasFiveStar = receivedReviews.some(r => Math.round(r.rating) === 5);

    // Achievements Badges configuration
    const badges = [
      {
        id: 'first-swap',
        icon: '🌱',
        name: 'First Swap',
        desc: 'Completed your first skill swap exchange.',
        unlocked: completed.length >= 1,
        progress: `${Math.min(completed.length, 1)}/1`
      },
      {
        id: 'super-learner',
        icon: '📚',
        name: 'Super Learner',
        desc: 'Completed 3+ sessions as a learner.',
        unlocked: learnHrs >= 3,
        progress: `${learnHrs}/3`
      },
      {
        id: 'super-mentor',
        icon: '🎓',
        name: 'Super Mentor',
        desc: 'Completed 3+ sessions as a mentor.',
        unlocked: mentorHrs >= 3,
        progress: `${mentorHrs}/3`
      },
      {
        id: 'dual-swapper',
        icon: '🔄',
        name: 'Dual Swapper',
        desc: 'Completed swaps as both learner and mentor.',
        unlocked: learnHrs >= 1 && mentorHrs >= 1,
        progress: `${learnHrs >= 1 ? 1 : 0}+${mentorHrs >= 1 ? 1 : 0}/2`
      },
      {
        id: 'skill-collector',
        icon: '🎖️',
        name: 'Skill Collector',
        desc: 'Completed swaps across 3+ different skills.',
        unlocked: uniqueSkills.size >= 3,
        progress: `${uniqueSkills.size}/3`
      },
      {
        id: 'peer-star',
        icon: '⭐',
        name: 'Peer Star',
        desc: 'Received a 5-star rating from a community peer.',
        unlocked: hasFiveStar,
        progress: hasFiveStar ? '1/1' : '0/1'
      }
    ];

    badgesGrid.innerHTML = '';
    badges.forEach(badge => {
      const item = document.createElement('div');
      item.className = `badge-item badge-item--${badge.unlocked ? 'unlocked' : 'locked'}`;

      item.innerHTML = `
        <span class="badge-icon">${badge.icon}</span>
        <span class="badge-name">${badge.name}</span>
        
        <div class="badge-tooltip">
          <span class="tooltip-title">
            <span>${badge.name}</span>
            <span class="tooltip-status tooltip-status--${badge.unlocked ? 'unlocked' : 'locked'}">
              ${badge.unlocked ? 'Unlocked' : 'Locked'}
            </span>
          </span>
          <span class="tooltip-desc">${badge.desc}</span>
          <span class="tooltip-desc" style="margin-top: 3px; font-weight: 600; color: #a78bfa;">
            Progress: ${badge.progress}
          </span>
        </div>
      `;

      badgesGrid.appendChild(item);
    });
  }

  /**
   * Filters and renders the chronological timeline sessions list.
   */
  function filterAndRender() {
    const query = searchInput.value.toLowerCase().trim();
    const role = roleSelect.value;
    const status = statusSelect.value;
    const skill = skillSelect.value;

    const filtered = allSessions.filter(session => {
      // 1. Search Query (counterpart name or skill name)
      const nameMatch = session.counterpart_name && session.counterpart_name.toLowerCase().includes(query);
      const skillMatch = session.skill_name && session.skill_name.toLowerCase().includes(query);
      if (query && !nameMatch && !skillMatch) return false;

      // 2. Role filter
      if (role !== 'all' && session.my_role !== role) return false;

      // 3. Status filter
      if (status !== 'all' && session.status !== status) return false;

      // 4. Skill filter
      if (skill !== 'all' && session.skill_name !== skill) return false;

      return true;
    });

    listContainer.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      timelineTrack.style.display = 'none';
      return;
    }

    emptyState.classList.add('hidden');
    timelineTrack.style.display = 'block';

    let lastMonthYear = '';

    filtered.forEach(session => {
      // Extract month and year: e.g. "July 2026"
      const dateObj = new Date(session.scheduled_date + 'T00:00:00');
      const monthYear = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      // Group timeline items visually by month divider header
      if (monthYear !== lastMonthYear) {
        const divider = document.createElement('div');
        divider.className = 'timeline-month-divider';
        divider.textContent = monthYear;
        listContainer.appendChild(divider);
        lastMonthYear = monthYear;
      }

      const timelineItem = createTimelineItem(session);
      listContainer.appendChild(timelineItem);

      // Post-render: asynchronously look up ratings details
      if (session.status === 'completed') {
        loadReviewDetailsForCard(session);
      }
    });
  }

  /**
   * Fetches the user session profile and timeline history lists.
   */
  async function loadHistory() {
    // Determine authenticated user
    const user = await AuthGuard.requireAuth();
    currentUserId = user.id;

    // Fetch received reviews for current user (used to display review feedback received on cards)
    const { ok: rOk, data: rData } = await Utils.apiRequest(`${CONFIG.ENDPOINTS.GET_REVIEWS}?user_id=${currentUserId}`);
    if (rOk && rData.success) {
      receivedReviews = rData.data.reviews || [];
    }

    // Fetch past sessions history
    const { ok: sOk, data: sData } = await Utils.apiRequest(CONFIG.ENDPOINTS.GET_SESSION_HISTORY, { method: 'GET' });

    if (!sOk || !sData.success) {
      Utils.showToast(sData.message || 'Could not load your session history.', 'error');
      listContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    allSessions = sData.data.sessions || [];

    populateSkillsFilter();
    updateSummaryStats();
    renderSidebarWidgets();
    filterAndRender();
  }

  // ------------------------------------------------------------------
  // Initial Event listeners
  // ------------------------------------------------------------------
  function setupEventListeners() {
    searchInput.addEventListener('input', filterAndRender);
    roleSelect.addEventListener('change', filterAndRender);
    statusSelect.addEventListener('change', filterAndRender);
    skillSelect.addEventListener('change', filterAndRender);
  }

  // Init
  (async function init() {
    setupEventListeners();
    await loadHistory();
  })();
})();

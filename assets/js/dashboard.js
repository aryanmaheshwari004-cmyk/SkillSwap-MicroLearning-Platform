/**
 * Skill Swap - Dashboard Page Logic
 * Loads aggregated dashboard data and skill lists from the database,
 * renders stat cards, profile completion, sessions, reviews, skill
 * progress, and learning goals — all from real data.
 * Shows professional empty states when no data exists.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     DOM refs
  ------------------------------------------------------------------ */
  const greetingEl              = document.getElementById('dashboard-greeting');

  const statActiveSessions      = document.getElementById('stat-active-sessions');
  const statCompletedSessions   = document.getElementById('stat-completed-sessions');
  const statAverageRating       = document.getElementById('stat-average-rating');
  const statSkillsOffered       = document.getElementById('stat-skills-offered');
  const statSkillsWanted        = document.getElementById('stat-skills-wanted');

  const completionPercentEl     = document.getElementById('completion-percent');
  const completionRingFill      = document.getElementById('completion-ring-fill');
  const completionRingPct       = document.getElementById('dash-ring-pct');
  const completionChecklist     = document.getElementById('completion-checklist');

  const sessionsPreviewContainer = document.getElementById('dashboard-upcoming-preview');
  const sessionsListContainer    = document.getElementById('dash-sessions-list');
  const reviewsPreviewContainer  = document.getElementById('dashboard-reviews-preview');
  const goalsListContainer       = document.getElementById('dash-goals-list');
  const skillBarsContainer       = document.getElementById('dash-skill-bars-dynamic');

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const CHECK_LABELS = {
    has_photo:            'Profile photo',
    has_bio:              'Bio',
    has_experience_level: 'Experience level',
    has_skill_offered:    'A skill offered',
    has_skill_wanted:     'A skill wanted',
  };

  // Colour palette cycled for skill progress bars
  const BAR_COLOURS = ['purple', 'blue', 'pink', 'amber', 'green'];

  // Proficiency → numeric width (%)
  const PROFICIENCY_WIDTH = {
    beginner:     28,
    intermediate: 60,
    expert:       90,
  };

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */

  /**
   * Formats a date string (YYYY-MM-DD) into a short readable label.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /**
   * Formats a time string (HH:MM:SS) into a 12-hour readable label.
   * @param {string} timeStr
   * @returns {string}
   */
  function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /**
   * Renders filled/empty star string.
   * @param {number} rating
   * @returns {string}
   */
  function renderStaticStars(rating) {
    const full = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= full ? '★' : '<span class="star-empty">★</span>';
    }
    return html;
  }

  /**
   * Returns a professional empty-state HTML block.
   * @param {string} icon  SVG path data or emoji
   * @param {string} title
   * @param {string} body
   * @param {string} [actionHref]
   * @param {string} [actionLabel]
   * @returns {string}
   */
  function emptyState(icon, title, body, actionHref = '', actionLabel = '') {
    const svgIcon = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5"
           stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>`;

    const actionBtn = actionHref
      ? `<a href="${actionHref}" class="dash-empty-action">${actionLabel}</a>`
      : '';

    return `
      <div class="dash-empty-state">
        <div class="dash-empty-icon">${svgIcon}</div>
        <p class="dash-empty-title">${title}</p>
        <p class="dash-empty-body">${body}</p>
        ${actionBtn}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render: stats
  ------------------------------------------------------------------ */
  function renderStats(stats) {
    statActiveSessions.textContent    = stats.active_sessions_count;
    statCompletedSessions.textContent = stats.completed_sessions_count;
    statAverageRating.textContent     =
      stats.average_rating !== null ? stats.average_rating.toFixed(1) : '—';
    statSkillsOffered.textContent     = stats.skills_offered_count;
    statSkillsWanted.textContent      = stats.skills_wanted_count;
  }

  /* ------------------------------------------------------------------
     Render: profile completion ring
  ------------------------------------------------------------------ */
  function renderCompletion(completion) {
    const pct = completion.percent;

    // Badge + ring centre text
    completionPercentEl.textContent = `${pct}%`;
    completionRingPct.textContent   = `${pct}%`;

    // SVG ring: circumference = 2π × r(40) ≈ 251.2
    const circumference = 251.2;
    const offset = circumference - (pct / 100) * circumference;
    completionRingFill.style.strokeDashoffset = offset;

    // Build checklist items
    completionChecklist.innerHTML = '';
    Object.keys(CHECK_LABELS).forEach((key) => {
      const isDone = Boolean(completion.checks[key]);
      const li     = document.createElement('li');
      li.className = `completion-check-item${isDone ? ' is-done' : ''}`;
      li.innerHTML = `
        <span class="completion-check-icon">${isDone ? '✓' : ''}</span>
        <span>${CHECK_LABELS[key]}</span>`;
      completionChecklist.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------
     Render: upcoming sessions (activity preview)
  ------------------------------------------------------------------ */
  function renderUpcomingPreview(sessions) {
    if (!sessionsPreviewContainer) return;
    sessionsPreviewContainer.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      sessionsPreviewContainer.innerHTML = emptyState(
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        'No upcoming sessions',
        'Book your first session to start swapping skills.',
        'browse-skills.html',
        'Browse Skills'
      );
      return;
    }

    sessions.forEach((session) => {
      const photoSrc  = session.counterpart_photo || 'assets/images/default-avatar.png';
      const roleLabel = session.my_role === 'learner' ? 'with mentor' : 'with learner';

      const row = document.createElement('div');
      row.className = 'dashboard-session-row';
      row.innerHTML = `
        <img src="${photoSrc}" alt="${session.counterpart_name}" class="avatar avatar-sm">
        <div class="dashboard-session-info">
          <h4>${session.skill_name}</h4>
          <span class="dashboard-session-meta">
            ${roleLabel} ${session.counterpart_name}
            &middot;
            ${formatDate(session.scheduled_date)}, ${formatTime(session.scheduled_time)}
          </span>
        </div>
        <span class="status-badge status-${session.status}">${session.status}</span>`;
      sessionsPreviewContainer.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     Render: upcoming sessions list (separate card)
  ------------------------------------------------------------------ */
  function renderSessionsList(sessions) {
    if (!sessionsListContainer) return;
    sessionsListContainer.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      sessionsListContainer.innerHTML = emptyState(
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        'No scheduled sessions',
        'Your upcoming sessions will appear here once booked.',
        'browse-skills.html',
        'Find a Mentor'
      );
      return;
    }

    sessions.forEach((session) => {
      const photoSrc  = session.counterpart_photo || 'assets/images/default-avatar.png';
      const roleLabel = session.my_role === 'learner' ? 'with mentor' : 'with learner';

      const row = document.createElement('div');
      row.className = 'dashboard-session-row';
      row.innerHTML = `
        <img src="${photoSrc}" alt="${session.counterpart_name}" class="avatar avatar-sm">
        <div class="dashboard-session-info">
          <h4>${session.skill_name}</h4>
          <span class="dashboard-session-meta">
            ${roleLabel} ${session.counterpart_name}
            &middot;
            ${formatDate(session.scheduled_date)}, ${formatTime(session.scheduled_time)}
          </span>
        </div>
        <span class="status-badge status-${session.status}">${session.status}</span>`;
      sessionsListContainer.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     Render: recent reviews
  ------------------------------------------------------------------ */
  function renderReviewsPreview(reviews) {
    if (!reviewsPreviewContainer) return;
    reviewsPreviewContainer.innerHTML = '';

    if (!reviews || reviews.length === 0) {
      reviewsPreviewContainer.innerHTML = emptyState(
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
        'No reviews yet',
        'Complete a session and your reviews will show up here.',
        'upcoming-sessions.html',
        'View Sessions'
      );
      return;
    }

    reviews.forEach((review) => {
      const photoSrc = review.reviewer_photo || 'assets/images/default-avatar.png';
      const row = document.createElement('div');
      row.className = 'dashboard-review-row';
      row.innerHTML = `
        <div class="dashboard-review-header">
          <img src="${photoSrc}" alt="${review.reviewer_name}" class="avatar avatar-sm">
          <span class="dashboard-review-author">${review.reviewer_name}</span>
          <span class="star-rating text-sm">${renderStaticStars(review.rating)}</span>
        </div>
        ${review.comment
          ? `<p class="dashboard-review-comment">${review.comment}</p>`
          : ''}`;
      reviewsPreviewContainer.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     Render: skill progress bars (Skills Offered)
  ------------------------------------------------------------------ */
  function renderSkillProgress(skillsOffered) {
    if (!skillBarsContainer) return;
    skillBarsContainer.innerHTML = '';

    const active = (skillsOffered || []).filter((s) => s.is_active == 1);

    if (active.length === 0) {
      skillBarsContainer.innerHTML = emptyState(
        '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        'No skills offered yet',
        'Add the skills you can teach to showcase your expertise.',
        'my-skills.html',
        'Add a Skill'
      );
      return;
    }

    // Show first 4 skills to avoid overflow
    active.slice(0, 4).forEach((skill, idx) => {
      const colour = BAR_COLOURS[idx % BAR_COLOURS.length];
      const width  = PROFICIENCY_WIDTH[skill.proficiency] || 50;
      const levelLabel = skill.proficiency
        ? skill.proficiency.charAt(0).toUpperCase() + skill.proficiency.slice(1)
        : '';

      const item = document.createElement('div');
      item.className = 'dash-skill-bar-item';
      item.innerHTML = `
        <div class="dash-skill-bar-header">
          <span class="dash-skill-bar-name">${skill.skill_name}</span>
          <span class="dash-skill-bar-level">${levelLabel}</span>
        </div>
        <div class="dash-skill-bar-track">
          <div class="dash-skill-bar-fill dash-skill-bar-fill--${colour}"
               style="width: 0%"
               data-target-width="${width}%">
          </div>
        </div>`;
      skillBarsContainer.appendChild(item);
    });

    // Animate bars after a brief paint delay
    requestAnimationFrame(() => {
      skillBarsContainer.querySelectorAll('.dash-skill-bar-fill').forEach((fill) => {
        fill.style.width = fill.dataset.targetWidth;
      });
    });
  }

  /* ------------------------------------------------------------------
     Render: learning goals (Skills Wanted)
  ------------------------------------------------------------------ */
  function renderLearningGoals(skillsWanted) {
    if (!goalsListContainer) return;
    goalsListContainer.innerHTML = '';

    if (!skillsWanted || skillsWanted.length === 0) {
      goalsListContainer.innerHTML = emptyState(
        '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        'No learning goals set',
        'Tell us what skills you want to learn to get matched with the right mentors.',
        'my-skills.html',
        'Add Learning Goals'
      );
      return;
    }

    const goalColours   = ['', '--green', '--pink', '--amber'];
    const categoryEmoji = {
      'Programming & Development': '💻',
      'Design & Creative':         '🎨',
      'Business & Marketing':      '📊',
      'Languages':                 '🌍',
      'Music & Arts':              '🎵',
      'Data & Analytics':          '📈',
      'Writing & Content':         '✍️',
      'Personal Development':      '🧠',
      'Other':                     '📚',
    };

    // Show first 5 goals
    skillsWanted.slice(0, 5).forEach((skill, idx) => {
      const emoji      = categoryEmoji[skill.category_name] || '🎯';
      const colourMod  = goalColours[idx % goalColours.length];

      const item = document.createElement('div');
      item.className = 'dash-goal-item';
      item.innerHTML = `
        <div class="dash-goal-left">
          <span class="dash-goal-emoji">${emoji}</span>
          <div class="dash-goal-info">
            <span class="dash-goal-name">${skill.skill_name}</span>
            <span class="dash-goal-meta">
              ${skill.category_name || 'Skill to learn'}
            </span>
          </div>
        </div>
        <div class="dash-goal-right">
          <div class="dash-goal-progress-wrap">
            <div class="dash-goal-bar">
              <div class="dash-goal-fill${colourMod}"
                   style="width: 0%"
                   data-target-width="0%">
              </div>
            </div>
            <span class="dash-goal-pct dash-goal-new-badge">New</span>
          </div>
        </div>`;
      goalsListContainer.appendChild(item);
    });
  }

  /* ------------------------------------------------------------------
     Main loader
  ------------------------------------------------------------------ */
  async function loadDashboard() {
    // Fetch both endpoints in parallel for speed
    const [dashRes, skillsRes] = await Promise.all([
      Utils.apiRequest(CONFIG.ENDPOINTS.GET_DASHBOARD_DATA, { method: 'GET' }),
      Utils.apiRequest(CONFIG.ENDPOINTS.GET_MY_SKILLS,      { method: 'GET' }),
    ]);

    // ---- Dashboard aggregated data ----
    if (!dashRes.ok || !dashRes.data.success) {
      Utils.showToast(dashRes.data.message || 'Could not load your dashboard.', 'error');
      // Render empty states so UI is never blank
      renderUpcomingPreview([]);
      renderSessionsList([]);
      renderReviewsPreview([]);
      renderCompletion({ percent: 0, checks: {} });
    } else {
      const { stats, upcoming_preview, recent_reviews, profile_completion } = dashRes.data.data;
      renderStats(stats);
      renderCompletion(profile_completion);
      renderUpcomingPreview(upcoming_preview);
      renderSessionsList(upcoming_preview);   // same data, different card
      renderReviewsPreview(recent_reviews);
    }

    // ---- My Skills data ----
    if (!skillsRes.ok || !skillsRes.data.success) {
      // Non-fatal: just show empty states for skill widgets
      renderSkillProgress([]);
      renderLearningGoals([]);
    } else {
      const { skills_offered, skills_wanted } = skillsRes.data.data;
      renderSkillProgress(skills_offered);
      renderLearningGoals(skills_wanted);
    }
  }

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  (async function init() {
    const user = await AuthGuard.requireAuth();
    const firstName = user.name ? user.name.split(' ')[0] : 'there';
    greetingEl.textContent = `Welcome back, ${firstName} 👋`;
    await loadDashboard();
  })();
})();

/**
 * Skill Swap — Profile Page v2
 * Powers the premium redesigned profile page.
 * Sections: identity card, skills (offered/wanted), reviews,
 * completion widget, contact, experience track, edit modal.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Build an SVG star icon */
  function starSVG(filled) {
    const cls = filled ? 'profile-star' : 'profile-star profile-star--empty';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="${filled ? '#fbbf24' : 'none'}" stroke="${filled ? '#fbbf24' : 'rgba(255,255,255,0.2)'}" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  /** Build a row of 5 stars from a numeric rating */
  function buildStars(rating) {
    let html = '';
    const full = Math.floor(rating);
    for (let i = 1; i <= 5; i++) html += starSVG(i <= full);
    return html;
  }

  /** Format a date string to a human-readable month + year */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch { return '—'; }
  }

  /** Format a date to relative time (e.g. "3 months ago") */
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    const intervals = [
      [Math.floor(seconds / 31536000), 'year'],
      [Math.floor(seconds / 2592000),  'month'],
      [Math.floor(seconds / 86400),    'day'],
      [Math.floor(seconds / 3600),     'hour'],
      [Math.floor(seconds / 60),       'minute'],
    ];
    for (const [val, unit] of intervals) {
      if (val >= 1) return `${val} ${unit}${val > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  // -----------------------------------------------------------------------
  // Element refs
  // -----------------------------------------------------------------------
  const photoImg          = document.getElementById('profile-photo-img');
  const photoUploadBtn    = document.getElementById('profile-photo-upload-btn');
  const photoInput        = document.getElementById('profile-photo-input');

  const nameDisplay       = document.getElementById('profile-name-display');
  const emailText         = document.getElementById('profile-email-text');
  const contactEmailVal   = document.getElementById('contact-email-value');
  const memberSinceText   = document.getElementById('profile-member-since-text');
  const bioDisplay        = document.getElementById('profile-bio-display');
  const experienceBadge   = document.getElementById('profile-experience-badge');
  const expLevelLabel     = document.getElementById('exp-level-label');

  const statSessions      = document.getElementById('stat-sessions-completed');
  const statSkills        = document.getElementById('stat-skills-offered');
  const statRating        = document.getElementById('stat-avg-rating');
  const statReviews       = document.getElementById('stat-review-count');
  const profileStarRow    = document.getElementById('profile-star-row');

  const skillsOfferedList = document.getElementById('skills-offered-list');
  const skillsWantedList  = document.getElementById('skills-wanted-list');

  const reviewsList       = document.getElementById('profile-reviews-list');
  const reviewsSubtitle   = document.getElementById('reviews-count-subtitle');
  const seeAllLink        = document.getElementById('see-all-reviews-link');
  const profileReviewsLink= document.getElementById('profile-reviews-link');
  const ratingSummaryEl   = document.getElementById('profile-rating-summary');
  const ratingBigNum      = document.getElementById('rating-big-num');
  const ratingBigStars    = document.getElementById('rating-big-stars');
  const ratingBigCount    = document.getElementById('rating-big-count');
  const ratingBarsEl      = document.getElementById('profile-rating-bars');

  const completionPct     = document.getElementById('completion-pct');
  const completionRingPct = document.getElementById('completion-ring-pct');
  const ringFill          = document.getElementById('completion-ring-fill');
  const checksList        = document.getElementById('completion-checks-list');

  // Edit modal
  const editToggleBtn     = document.getElementById('profile-edit-toggle-btn');
  const modalOverlay      = document.getElementById('profile-modal-overlay');
  const modalCloseBtn     = document.getElementById('profile-modal-close');
  const cancelEditBtn     = document.getElementById('profile-cancel-edit-btn');
  const editForm          = document.getElementById('profile-edit-form');
  const editNameInput     = document.getElementById('edit-name');
  const editExpSelect     = document.getElementById('edit-experience');
  const editBioTextarea   = document.getElementById('edit-bio');
  const bioCharCount      = document.getElementById('bio-char-count');
  const saveBtn           = document.getElementById('profile-save-btn');
  const editAlert         = document.getElementById('profile-edit-alert');

  const EXPERIENCE_LABELS = {
    beginner:     '🌱 Beginner',
    intermediate: '⚡ Intermediate',
    expert:       '🚀 Expert',
  };

  let currentProfile = null;
  let currentUserId  = null;

  // -----------------------------------------------------------------------
  // Rendering helpers
  // -----------------------------------------------------------------------

  function renderExperienceTrack(level) {
    const levels = ['beginner', 'intermediate', 'expert'];
    const activeIdx = levels.indexOf(level);

    levels.forEach((lvl, i) => {
      const stepEl = document.getElementById(`exp-step-${lvl}`);
      if (!stepEl) return;
      stepEl.classList.remove('is-active', 'is-filled');
      if (i < activeIdx)  stepEl.classList.add('is-filled');
      if (i === activeIdx) stepEl.classList.add('is-active');
    });

    // Fill connector lines
    document.querySelectorAll('.profile-exp-line').forEach((line, i) => {
      line.classList.toggle('is-filled', i < activeIdx);
    });
  }

  function renderSkillPills(container, skills, type, emptyTitle, emptyBody) {
    container.innerHTML = '';

    if (!skills || skills.length === 0) {
      const iconSvg = type === 'offered'
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;

      container.innerHTML = `
        <div class="profile-skills-empty" role="status">
          <div class="profile-skills-empty-icon">${iconSvg}</div>
          <p class="profile-skills-empty-title">${emptyTitle}</p>
          <p class="profile-skills-empty-body">${emptyBody}</p>
        </div>`;
      return;
    }

    skills.forEach((skill) => {
      const pill = document.createElement('span');
      pill.className = `profile-skill-pill profile-skill-pill--${type}`;
      pill.setAttribute('role', 'listitem');
      pill.textContent = skill.skill_name;
      if (skill.category_name) {
        pill.innerHTML += `<span class="profile-skill-category">${skill.category_name}</span>`;
      }
      container.appendChild(pill);
    });
  }

  function renderStarsBar(avgRating) {
    if (!profileStarRow) return;
    profileStarRow.innerHTML = avgRating ? buildStars(avgRating) : '';
    profileStarRow.setAttribute('aria-label', avgRating ? `${avgRating.toFixed(1)} out of 5 stars` : '');
  }

  function renderCompletionWidget(profile) {
    const checks = [
      { label: 'Profile photo uploaded',     done: !!profile.profile_photo },
      { label: 'Bio written',                done: !!(profile.bio && profile.bio.trim()) },
      { label: 'Experience level set',       done: !!profile.experience_level },
      { label: 'Skills offered added',       done: (profile.skills_offered?.length || 0) > 0 },
      { label: 'Skills wanted added',        done: (profile.skills_wanted?.length  || 0) > 0 },
      { label: 'First session completed',    done: (profile.stats?.sessions_completed || 0) > 0 },
    ];

    const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

    // Update text indicators
    completionPct.textContent     = `${pct}%`;
    completionRingPct.textContent = `${pct}%`;

    // Update SVG ring
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    ringFill.setAttribute('stroke-dasharray', circumference);
    // Animate after a brief delay so the CSS transition fires
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        ringFill.setAttribute('stroke-dashoffset', circumference * (1 - pct / 100));
      }, 80);
    });

    // Render checklist
    checksList.innerHTML = '';
    checks.forEach(({ label, done }) => {
      const li = document.createElement('li');
      li.className = `profile-check-item${done ? ' is-done' : ''}`;
      li.innerHTML = `
        <div class="profile-check-icon" aria-hidden="true">${done ? '✓' : ''}</div>
        <span>${label}</span>`;
      checksList.appendChild(li);
    });
  }

  // -----------------------------------------------------------------------
  // Render profile
  // -----------------------------------------------------------------------
  function renderProfile(profile) {
    currentProfile = profile;

    // Name
    nameDisplay.textContent = profile.name;

    // Email
    emailText.textContent = profile.email || '';
    contactEmailVal.textContent = profile.email || '—';

    // Member since
    memberSinceText.textContent = `Member since ${formatDate(profile.member_since)}`;

    // Bio
    bioDisplay.textContent = profile.bio && profile.bio.trim()
      ? profile.bio
      : 'No bio yet — click "Edit Profile" to introduce yourself to the community.';

    // Experience badge
    const level = profile.experience_level || 'beginner';
    experienceBadge.textContent = EXPERIENCE_LABELS[level] || '🌱 Beginner';
    experienceBadge.className = `profile-experience-badge badge-exp-${level}`;
    expLevelLabel.textContent = EXPERIENCE_LABELS[level] || '—';
    renderExperienceTrack(level);

    // Photo
    if (profile.profile_photo) {
      photoImg.src = profile.profile_photo;
    }

    // Stats
    statSessions.textContent = profile.stats?.sessions_completed ?? 0;
    statSkills.textContent   = profile.stats?.skills_offered_count ?? 0;

    const avgRating = profile.stats?.average_rating ?? null;
    statRating.textContent = avgRating ? avgRating.toFixed(1) : '—';
    renderStarsBar(avgRating);

    // Skills
    renderSkillPills(
      skillsOfferedList, profile.skills_offered, 'offered',
      'No skills offered yet',
      'Add skills you can teach on the My Skills page.'
    );
    renderSkillPills(
      skillsWantedList, profile.skills_wanted, 'wanted',
      'No skills wanted yet',
      'Add skills you want to learn on the My Skills page.'
    );

    // Completion widget
    renderCompletionWidget(profile);

    // Pre-fill edit form
    editNameInput.value      = profile.name;
    editExpSelect.value      = level;
    editBioTextarea.value    = profile.bio || '';
    bioCharCount.textContent = String((profile.bio || '').length);
  }

  // -----------------------------------------------------------------------
  // Load profile from API
  // -----------------------------------------------------------------------
  async function loadProfile() {
    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.GET_PROFILE, { method: 'GET' });

    if (ok && data.success && data.data?.profile) {
      const profile = data.data.profile;
      currentUserId = profile.id;
      renderProfile(profile);

      // Now load reviews for this user
      await loadReviews(profile.id);

      // Show reviews link in header once loaded
      if (profileReviewsLink) {
        profileReviewsLink.href = `reviews.html?user_id=${profile.id}`;
        profileReviewsLink.style.display = '';
      }
    } else {
      Utils.showToast(data.message || 'Could not load your profile.', 'error');
      nameDisplay.textContent = 'Profile unavailable';
      bioDisplay.textContent  = 'Unable to load profile data. Please refresh the page.';
    }
  }

  // -----------------------------------------------------------------------
  // Reviews
  // -----------------------------------------------------------------------
  async function loadReviews(userId) {
    const url = `${CONFIG.ENDPOINTS.GET_REVIEWS}?user_id=${userId}`;
    const { ok, data } = await Utils.apiRequest(url, { method: 'GET' });

    if (!ok || !data.success) {
      reviewsList.innerHTML = `<p style="color:rgba(226,232,240,0.35);font-size:.8125rem;text-align:center;padding:1.5rem 0;">Could not load reviews.</p>`;
      reviewsSubtitle.textContent = '0 reviews';
      statReviews.textContent = '0';
      return;
    }

    const count   = data.data.review_count  || 0;
    const avgRaw  = data.data.average_rating || null;
    const reviews = data.data.reviews        || [];
    const breakdown = data.data.rating_breakdown || { 5:0, 4:0, 3:0, 2:0, 1:0 };

    // Update stat row
    statReviews.textContent = count;

    // Update reviews section subtitle
    reviewsSubtitle.textContent = count === 0
      ? 'No reviews yet'
      : `${count} review${count !== 1 ? 's' : ''}${avgRaw ? ` · ${avgRaw.toFixed(1)} avg` : ''}`;

    // Show "See all" link if there are reviews
    if (count > 0 && currentUserId) {
      seeAllLink.href = `reviews.html?user_id=${currentUserId}`;
      seeAllLink.style.display = '';
    }

    // Rating summary bar
    if (avgRaw && count > 0) {
      ratingSummaryEl.style.display = '';
      ratingBigNum.textContent = avgRaw.toFixed(1);
      ratingBigStars.innerHTML = buildStars(avgRaw);
      ratingBigCount.textContent = `${count} review${count !== 1 ? 's' : ''}`;

      // Rating bars
      ratingBarsEl.innerHTML = '';
      for (let star = 5; star >= 1; star--) {
        const cnt = breakdown[star] || 0;
        const width = count > 0 ? Math.round((cnt / count) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'profile-rating-bar-row';
        row.innerHTML = `
          <span class="profile-rating-bar-label">${star}</span>
          <div class="profile-rating-bar-track">
            <div class="profile-rating-bar-fill" style="width:0%;" data-target="${width}"></div>
          </div>
          <span class="profile-rating-bar-count">${cnt}</span>`;
        ratingBarsEl.appendChild(row);
      }
      // Animate bars in
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          ratingBarsEl.querySelectorAll('.profile-rating-bar-fill').forEach(el => {
            el.style.width = `${el.dataset.target}%`;
          });
        }, 100);
      });
    }

    // Render review rows (max 3 on profile page)
    reviewsList.innerHTML = '';

    if (reviews.length === 0) {
      reviewsList.innerHTML = `
        <div class="profile-reviews-empty" role="status">
          <div class="profile-reviews-empty-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <p class="profile-reviews-empty-title">No reviews yet</p>
          <p class="profile-reviews-empty-body">Complete sessions to earn your first review.</p>
        </div>`;
      return;
    }

    reviews.slice(0, 3).forEach((review) => {
      const row = document.createElement('div');
      row.className = 'profile-review-row';
      const photoSrc = review.reviewer_photo || 'assets/images/default-avatar.png';
      const stars    = buildStars(review.rating || 0);
      const comment  = review.comment ? escapeHtml(review.comment) : '<em style="opacity:.5;">No comment.</em>';

      row.innerHTML = `
        <div class="profile-review-header">
          <img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(review.reviewer_name)}" class="profile-review-avatar" loading="lazy" onerror="this.src='assets/images/default-avatar.png'">
          <div class="profile-review-meta">
            <div class="profile-review-author">${escapeHtml(review.reviewer_name)}</div>
            <div class="profile-review-date">${timeAgo(review.created_at)}</div>
          </div>
          <div class="profile-review-stars" aria-label="${review.rating} out of 5 stars">${stars}</div>
        </div>
        <p class="profile-review-comment">${comment}</p>`;
      reviewsList.appendChild(row);
    });
  }

  /** Minimal HTML escaping for safe insertion */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -----------------------------------------------------------------------
  // Modal open / close
  // -----------------------------------------------------------------------
  function openModal() {
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    editToggleBtn.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(() => modalCloseBtn.focus());
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    editToggleBtn.setAttribute('aria-expanded', 'false');
    editAlert.classList.remove('is-visible');
    Utils.clearAllFieldErrors(editForm);
    // Restore form to last-known values
    if (currentProfile) {
      editNameInput.value      = currentProfile.name;
      editExpSelect.value      = currentProfile.experience_level || 'beginner';
      editBioTextarea.value    = currentProfile.bio || '';
      bioCharCount.textContent = String((currentProfile.bio || '').length);
    }
    editToggleBtn.focus();
  }

  editToggleBtn.addEventListener('click', openModal);
  modalCloseBtn.addEventListener('click', closeModal);
  cancelEditBtn.addEventListener('click', closeModal);

  // Close on overlay click (outside modal box)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  // Bio character counter
  editBioTextarea.addEventListener('input', () => {
    bioCharCount.textContent = String(editBioTextarea.value.length);
  });

  // Clear field errors on input
  [editNameInput, editExpSelect].forEach((field) => {
    field.addEventListener('input',  () => Utils.clearFieldError(field));
    field.addEventListener('change', () => Utils.clearFieldError(field));
  });

  // -----------------------------------------------------------------------
  // Save profile info
  // -----------------------------------------------------------------------
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    editAlert.classList.remove('is-visible');
    Utils.clearAllFieldErrors(editForm);

    let isValid = true;

    if (!Utils.isNonEmpty(editNameInput.value)) {
      Utils.showFieldError(editNameInput, 'Please enter your name.');
      isValid = false;
    }

    if (!editExpSelect.value) {
      Utils.showFieldError(editExpSelect, 'Please select an experience level.');
      isValid = false;
    }

    if (editBioTextarea.value.length > 500) {
      Utils.showFieldError(editBioTextarea, 'Bio must be 500 characters or fewer.');
      isValid = false;
    }

    if (!isValid) return;

    const restoreBtn = Utils.setButtonLoading(saveBtn, 'Saving...');

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.UPDATE_PROFILE, {
      method: 'POST',
      body: {
        action:           'update_info',
        name:             editNameInput.value.trim(),
        bio:              editBioTextarea.value.trim(),
        experience_level: editExpSelect.value,
      },
    });

    restoreBtn();

    if (ok && data.success) {
      Utils.showToast('Profile updated successfully!', 'success');
      closeModal();
      await loadProfile();
      return;
    }

    if (data.errors && typeof data.errors === 'object') {
      const fieldMap = {
        name:             editNameInput,
        bio:              editBioTextarea,
        experience_level: editExpSelect,
      };
      Object.keys(data.errors).forEach((field) => {
        if (fieldMap[field]) Utils.showFieldError(fieldMap[field], data.errors[field]);
      });
    }

    editAlert.textContent = data.message || 'Could not save your changes. Please try again.';
    editAlert.classList.add('is-visible');
  });

  // -----------------------------------------------------------------------
  // Photo upload
  // -----------------------------------------------------------------------
  photoUploadBtn.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;

    const allowed  = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 2 * 1024 * 1024;

    if (!allowed.includes(file.type)) {
      Utils.showToast('Please upload a JPEG, PNG, or WebP image.', 'error');
      photoInput.value = '';
      return;
    }

    if (file.size > maxBytes) {
      Utils.showToast('Image must be smaller than 2MB.', 'error');
      photoInput.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('action', 'upload_photo');
    formData.append('profile_photo', file);

    Utils.showToast('Uploading photo…', 'info');

    try {
      const response = await fetch(CONFIG.ENDPOINTS.UPDATE_PROFILE, {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { Accept: 'application/json' },
        body:        formData,
      });
      const data = await response.json();

      if (response.ok && data.success) {
        photoImg.src = data.data.profile_photo_url;
        // Also update navbar avatar if present
        const navbarAvatar = document.getElementById('navbar-avatar-img');
        if (navbarAvatar) navbarAvatar.src = data.data.profile_photo_url;
        Utils.showToast('Profile photo updated.', 'success');
        // Refresh completion widget
        await loadProfile();
      } else {
        Utils.showToast(data.message || 'Could not upload photo. Please try again.', 'error');
      }
    } catch {
      Utils.showToast('Network error while uploading photo.', 'error');
    } finally {
      photoInput.value = '';
    }
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  (async function init() {
    // Initialise ring stroke values for animation
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    ringFill.setAttribute('stroke-dasharray', circumference);
    ringFill.setAttribute('stroke-dashoffset', circumference);

    await AuthGuard.requireAuth();
    await loadProfile();
  })();
})();

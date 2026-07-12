/**
 * Skill Swap - Skill Detail Page Logic
 * Loads a single skill's full detail (mentor info, reviews, available
 * slots) and handles slot selection ahead of booking (full booking
 * flow is wired in the Sessions phase).
 * Depends on: config.js, utils.js, auth-guard.js, navbar.js.
 */

(function () {
  'use strict';

  const breadcrumbSkillName = document.getElementById('breadcrumb-skill-name');
  const titleEl = document.getElementById('detail-skill-title');
  const categoryBadge = document.getElementById('detail-category-badge');
  const proficiencyBadge = document.getElementById('detail-proficiency-badge');
  const descriptionText = document.getElementById('detail-description-text');

  const mentorPhoto = document.getElementById('detail-mentor-photo');
  const mentorName = document.getElementById('detail-mentor-name');
  const mentorStars = document.getElementById('detail-mentor-stars');
  const mentorReviewCount = document.getElementById('detail-mentor-review-count');
  const mentorBio = document.getElementById('detail-mentor-bio');
  const mentorOtherSkills = document.getElementById('detail-mentor-other-skills');

  const reviewsList = document.getElementById('detail-reviews-list');
  const slotList = document.getElementById('detail-slot-list');
  const bookBtn = document.getElementById('detail-book-btn');

  const PROFICIENCY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

  let selectedSlotId = null;
  let currentSkillId = null;

  /**
   * Reads the skill id from the URL query string.
   * @returns {number}
   */
  function getSkillIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'), 10) || 0;
  }

  /**
   * Builds a star rating string for display.
   * @param {number|null} rating
   * @returns {string}
   */
  function renderStars(rating) {
    if (rating === null) return '';
    const fullStars = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= fullStars ? '★' : '<span class="star-empty">★</span>';
    }
    return html;
  }

  /**
   * Formats a date string (YYYY-MM-DD) into a readable label.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
   * Renders the list of bookable availability slots.
   * @param {Array<Object>} slots
   */
  function renderSlots(slots) {
    slotList.innerHTML = '';

    if (!slots || slots.length === 0) {
      slotList.innerHTML = '<p class="detail-no-slots">This mentor has no open slots right now.</p>';
      bookBtn.disabled = true;
      bookBtn.textContent = 'No slots available';
      return;
    }

    slots.forEach((slot) => {
      const item = document.createElement('div');
      item.className = 'detail-slot-item';
      item.dataset.slotId = String(slot.id);
      item.innerHTML = `
        <span class="detail-slot-date">${formatDate(slot.slot_date)}</span>
        <span class="detail-slot-time">${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}</span>
      `;

      item.addEventListener('click', function () {
        document.querySelectorAll('.detail-slot-item').forEach((el) => el.classList.remove('is-selected'));
        item.classList.add('is-selected');
        selectedSlotId = slot.id;
        bookBtn.disabled = false;
        bookBtn.textContent = 'Request this session';
      });

      slotList.appendChild(item);
    });
  }

  /**
   * Renders the mentor's recent reviews list.
   * @param {Array<Object>} reviews
   */
  function renderReviews(reviews) {
    reviewsList.innerHTML = '';

    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = '<p class="text-sm text-muted">No reviews yet for this mentor.</p>';
      return;
    }

    reviews.forEach((review) => {
      const item = document.createElement('div');
      item.className = 'detail-review-item';
      const photoSrc = review.reviewer_photo || 'assets/images/default-avatar.png';
      const date = new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

      item.innerHTML = `
        <div class="detail-review-header">
          <img src="${photoSrc}" alt="${review.reviewer_name}" class="avatar avatar-sm">
          <span class="detail-review-author">${review.reviewer_name}</span>
          <span class="star-rating text-sm">${renderStars(review.rating)}</span>
          <span class="detail-review-date">${date}</span>
        </div>
        <p class="detail-review-comment">${review.comment || ''}</p>
      `;
      reviewsList.appendChild(item);
    });
  }

  /**
   * Fetches and renders the full skill detail payload.
   */
  async function loadSkillDetail() {
    currentSkillId = getSkillIdFromUrl();

    if (!currentSkillId) {
      Utils.showToast('Invalid skill link.', 'error');
      window.location.href = 'browse-skills.html';
      return;
    }

    const url = `${CONFIG.ENDPOINTS.GET_SKILL_DETAIL}?id=${currentSkillId}`;
    const { ok, data } = await Utils.apiRequest(url, { method: 'GET' });

    if (!ok || !data.success) {
      Utils.showToast(data.message || 'This skill could not be found.', 'error');
      window.location.href = 'browse-skills.html';
      return;
    }

    const { skill, mentor, recent_reviews, available_slots } = data.data;

    breadcrumbSkillName.textContent = skill.skill_name;
    titleEl.textContent = skill.skill_name;
    categoryBadge.textContent = skill.category_name || 'Uncategorized';
    proficiencyBadge.textContent = PROFICIENCY_LABELS[skill.proficiency] || 'Intermediate';
    descriptionText.textContent = skill.description || 'No description provided for this skill yet.';

    mentorPhoto.src = mentor.profile_photo || 'assets/images/default-avatar.png';
    mentorName.textContent = mentor.name;
    mentorStars.innerHTML = renderStars(mentor.average_rating);
    mentorReviewCount.textContent = mentor.average_rating !== null
      ? `${mentor.average_rating} (${mentor.review_count} review${mentor.review_count === 1 ? '' : 's'})`
      : 'No ratings yet';
    mentorBio.textContent = mentor.bio || '';

    mentorOtherSkills.innerHTML = '';
    (mentor.other_skills || []).forEach((s) => {
      const pill = document.createElement('a');
      pill.href = `skill-detail.html?id=${s.id}`;
      pill.className = 'badge badge-skill';
      pill.textContent = s.skill_name;
      mentorOtherSkills.appendChild(pill);
    });

    renderReviews(recent_reviews);
    renderSlots(available_slots);
  }

  bookBtn.addEventListener('click', async function () {
    if (!selectedSlotId) return;

    const session = await AuthGuard.checkAuthOptional();
    if (!session.authenticated) {
      window.location.href = `login.html?redirect=skill-detail.html?id=${currentSkillId}`;
      return;
    }

    // Full booking submission is implemented on book-session.html
    // (Sessions phase). Carry the selected slot + skill forward.
    window.location.href = `book-session.html?skill_id=${currentSkillId}&slot_id=${selectedSlotId}`;
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  loadSkillDetail();
})();

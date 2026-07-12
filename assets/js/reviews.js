/**
 * Skill Swap - Reviews Page Logic
 * Two modes depending on URL params:
 *   - With session_id + reviewee_id: checks eligibility, shows the
 *     star-rating submission form if the session is reviewable.
 *   - Always: loads and renders the reviewee's public rating summary
 *     and review list (reviewee_id, falling back to user_id, identifies
 *     whose reviews to show).
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  const reviewFormCard = document.getElementById('review-form-card');
  const ineligibleState = document.getElementById('review-ineligible-state');
  const ineligibleTitle = document.getElementById('ineligible-title');
  const ineligibleMessage = document.getElementById('ineligible-message');

  const revieweePhoto = document.getElementById('review-reviewee-photo');
  const revieweeName = document.getElementById('review-reviewee-name');
  const formAlert = document.getElementById('review-form-alert');

  const form = document.getElementById('review-form');
  const starRow = document.getElementById('star-input-row');
  const starButtons = starRow.querySelectorAll('.star-input-btn');
  const starLabel = document.getElementById('star-input-label');
  const ratingFormError = document.getElementById('rating-form-error');
  const commentInput = document.getElementById('review-comment');
  const submitBtn = document.getElementById('review-submit-btn');

  const summaryScore = document.getElementById('rating-summary-score');
  const summaryStars = document.getElementById('rating-summary-stars');
  const summaryCount = document.getElementById('rating-summary-count');
  const breakdownContainer = document.getElementById('rating-breakdown-container');

  const reviewsListHeading = document.getElementById('reviews-list-heading');
  const reviewsListContainer = document.getElementById('reviews-list-container');
  const reviewsEmptyState = document.getElementById('reviews-empty-state');

  const STAR_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

  let sessionId = null;
  let revieweeId = null;
  let selectedRating = 0;

  /**
   * Reads relevant query params from the URL.
   */
  function readParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    sessionId = parseInt(params.get('session_id'), 10) || null;
    revieweeId = parseInt(params.get('reviewee_id'), 10) || parseInt(params.get('user_id'), 10) || null;
  }

  /**
   * Builds a static (non-interactive) star rating string for display.
   * @param {number|null} rating
   * @returns {string}
   */
  function renderStaticStars(rating) {
    if (rating === null) return '';
    const fullStars = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= fullStars ? '★' : '<span class="star-empty">★</span>';
    }
    return html;
  }

  // ------------------------------------------------------------------
  // Star input interaction
  // ------------------------------------------------------------------
  starButtons.forEach((btn) => {
    btn.addEventListener('click', function () {
      selectedRating = parseInt(btn.dataset.value, 10);
      updateStarDisplay();
      ratingFormError.textContent = '';
    });

    btn.addEventListener('mouseenter', function () {
      previewStars(parseInt(btn.dataset.value, 10));
    });
  });

  starRow.addEventListener('mouseleave', function () {
    updateStarDisplay();
  });

  /**
   * Highlights stars up to a hovered value, for preview on hover.
   * @param {number} value
   */
  function previewStars(value) {
    starButtons.forEach((btn) => {
      btn.classList.toggle('is-filled', parseInt(btn.dataset.value, 10) <= value);
    });
    starLabel.textContent = STAR_LABELS[value] || '';
  }

  /**
   * Renders the star display based on the currently selected rating.
   */
  function updateStarDisplay() {
    starButtons.forEach((btn) => {
      btn.classList.toggle('is-filled', parseInt(btn.dataset.value, 10) <= selectedRating);
    });
    starLabel.textContent = selectedRating > 0 ? STAR_LABELS[selectedRating] : 'Tap a star to rate';
  }

  // ------------------------------------------------------------------
  // Eligibility + form display
  // ------------------------------------------------------------------

  const INELIGIBLE_MESSAGES = {
    not_authenticated: 'Please log in to leave a review.',
    session_not_found: 'This session could not be found.',
    not_a_participant: 'You were not a participant in this session.',
    session_not_completed: 'Only completed sessions can be reviewed.',
    reviewee_mismatch: 'This review link is invalid.',
    already_reviewed: 'You have already reviewed this session.',
  };

  /**
   * Checks review eligibility via get_reviews.php's session_id param,
   * then shows either the submission form or the ineligible state.
   * @param {Object} revieweeUser
   * @param {Object|undefined} eligibility
   */
  function renderEligibility(revieweeUser, eligibility) {
    if (!sessionId) return; // No session context: just show public reviews.

    if (eligibility && eligibility.eligible) {
      revieweePhoto.src = revieweeUser.profile_photo || 'assets/images/default-avatar.png';
      revieweeName.textContent = revieweeUser.name;
      reviewFormCard.classList.remove('hidden');
    } else {
      const reason = eligibility ? eligibility.reason : 'session_not_found';
      ineligibleTitle.textContent = reason === 'already_reviewed' ? 'Already reviewed' : "This session can't be reviewed";
      ineligibleMessage.textContent = INELIGIBLE_MESSAGES[reason] || 'This session is not eligible for a review.';
      ineligibleState.classList.remove('hidden');
    }
  }

  // ------------------------------------------------------------------
  // Rating summary + review list rendering
  // ------------------------------------------------------------------

  /**
   * Renders the rating breakdown bars (5 stars down to 1).
   * @param {Object<string, number>} breakdown
   * @param {number} totalCount
   */
  function renderBreakdown(breakdown, totalCount) {
    breakdownContainer.innerHTML = '';

    for (let star = 5; star >= 1; star--) {
      const count = breakdown[star] || 0;
      const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'rating-breakdown-row';
      row.innerHTML = `
        <span>${star} star</span>
        <span class="rating-breakdown-track"><span class="rating-breakdown-fill" data-width="${percent}"></span></span>
        <span>${count}</span>
      `;
      breakdownContainer.appendChild(row);
    }

    // Apply widths after insertion (CSS custom property avoided to keep
    // strict separation; using inline width here would violate the
    // no-inline-CSS rule, so we set it via the style property in JS,
    // which is standard DOM manipulation, not an HTML inline attribute).
    breakdownContainer.querySelectorAll('.rating-breakdown-fill').forEach((el) => {
      el.style.width = `${el.dataset.width}%`;
    });
  }

  /**
   * Renders the full public review list.
   * @param {Array<Object>} reviews
   */
  function renderReviewsList(reviews) {
    reviewsListContainer.innerHTML = '';

    if (!reviews || reviews.length === 0) {
      reviewsEmptyState.classList.remove('hidden');
      return;
    }
    reviewsEmptyState.classList.add('hidden');

    reviews.forEach((review) => {
      const item = document.createElement('div');
      item.className = 'review-list-item';
      const photoSrc = review.reviewer_photo || 'assets/images/default-avatar.png';
      const date = new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

      item.innerHTML = `
        <div class="review-list-header">
          <img src="${photoSrc}" alt="${review.reviewer_name}" class="avatar avatar-sm">
          <span class="review-list-author">${review.reviewer_name}</span>
          <span class="star-rating text-sm">${renderStaticStars(review.rating)}</span>
          <span class="review-list-date">${date}</span>
        </div>
        ${review.comment ? `<p class="review-list-comment">${review.comment}</p>` : ''}
      `;
      reviewsListContainer.appendChild(item);
    });
  }

  /**
   * Loads reviews + summary for the reviewee, and eligibility if
   * a session_id is present in the URL.
   */
  async function loadReviews() {
    if (!revieweeId) {
      reviewsListContainer.innerHTML = '';
      reviewsEmptyState.classList.remove('hidden');
      summaryCount.textContent = 'No user specified';
      return;
    }

    const params = new URLSearchParams();
    params.set('user_id', String(revieweeId));
    if (sessionId) params.set('session_id', String(sessionId));

    const { ok, data } = await Utils.apiRequest(`${CONFIG.ENDPOINTS.GET_REVIEWS}?${params.toString()}`, { method: 'GET' });

    if (!ok || !data.success) {
      Utils.showToast(data.message || 'Could not load reviews.', 'error');
      return;
    }

    const { user, average_rating, review_count, rating_breakdown, reviews, session_eligibility } = data.data;

    reviewsListHeading.textContent = `Reviews for ${user.name}`;
    summaryScore.textContent = average_rating !== null ? average_rating.toFixed(1) : '—';
    summaryStars.innerHTML = renderStaticStars(average_rating);
    summaryCount.textContent = review_count > 0 ? `${review_count} review${review_count === 1 ? '' : 's'}` : 'No reviews yet';

    renderBreakdown(rating_breakdown, review_count);
    renderReviewsList(reviews);
    renderEligibility(user, session_eligibility);
  }

  // ------------------------------------------------------------------
  // Form submission
  // ------------------------------------------------------------------

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    formAlert.classList.remove('is-visible');
    ratingFormError.textContent = '';
    Utils.clearFieldError(commentInput);

    let isValid = true;

    if (selectedRating < 1 || selectedRating > 5) {
      ratingFormError.textContent = 'Please select a star rating.';
      isValid = false;
    }

    if (commentInput.value.length > 1000) {
      Utils.showFieldError(commentInput, 'Comment must be 1000 characters or fewer.');
      isValid = false;
    }

    if (!isValid) return;

    const restoreButton = Utils.setButtonLoading(submitBtn, 'Submitting...');

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.SUBMIT_REVIEW, {
      method: 'POST',
      body: {
        session_id: sessionId,
        rating: selectedRating,
        comment: commentInput.value.trim(),
      },
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast('Review submitted. Thank you!', 'success');
      reviewFormCard.classList.add('hidden');
      await loadReviews();
      return;
    }

    formAlert.textContent = data.message || 'Could not submit your review.';
    formAlert.classList.add('is-visible');
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  (async function init() {
    readParamsFromUrl();
    updateStarDisplay();
    await loadReviews();
  })();
})();

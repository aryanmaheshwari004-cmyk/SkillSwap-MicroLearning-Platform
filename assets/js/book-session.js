/**
 * Skill Swap - Book Session Page Logic
 * Reads skill_id and slot_id from the URL, validates the slot is
 * still available, renders a booking summary, and submits the
 * booking request with optional notes.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  const contentEl = document.getElementById('booksession-content');
  const unavailableState = document.getElementById('booksession-unavailable-state');

  const mentorPhoto = document.getElementById('booksession-mentor-photo');
  const mentorName = document.getElementById('booksession-mentor-name');
  const skillNameEl = document.getElementById('booksession-skill-name');
  const dateEl = document.getElementById('booksession-date');
  const timeEl = document.getElementById('booksession-time');

  const form = document.getElementById('booksession-form');
  const notesInput = document.getElementById('booksession-notes');
  const submitBtn = document.getElementById('booksession-submit-btn');
  const alertBox = document.getElementById('booksession-alert');

  let skillId = null;
  let slotId = null;

  /**
   * Formats a date string (YYYY-MM-DD) into a readable label.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
   * Shows the "slot no longer available" state and hides the form.
   */
  function showUnavailableState() {
    contentEl.classList.add('hidden');
    unavailableState.classList.remove('hidden');
  }

  /**
   * Reads skill_id and slot_id from the URL query string.
   */
  function readParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    skillId = parseInt(params.get('skill_id'), 10) || 0;
    slotId = parseInt(params.get('slot_id'), 10) || 0;
  }

  /**
   * Verifies the slot is still bookable, then loads skill detail
   * (for mentor name/photo/skill name) to build the summary card.
   */
  async function loadAndValidate() {
    if (!skillId || !slotId) {
      showUnavailableState();
      return;
    }

    const availabilityCheck = await Utils.apiRequest(
      `${CONFIG.ENDPOINTS.CHECK_AVAILABILITY}?slot_id=${slotId}`,
      { method: 'GET' }
    );

    if (!availabilityCheck.ok || !availabilityCheck.data.success || !availabilityCheck.data.data.available) {
      showUnavailableState();
      return;
    }

    const slot = availabilityCheck.data.data.slot;

    const skillDetailResult = await Utils.apiRequest(
      `${CONFIG.ENDPOINTS.GET_SKILL_DETAIL}?id=${skillId}`,
      { method: 'GET' }
    );

    if (!skillDetailResult.ok || !skillDetailResult.data.success) {
      showUnavailableState();
      return;
    }

    const { skill, mentor } = skillDetailResult.data.data;

    mentorPhoto.src = mentor.profile_photo || 'assets/images/default-avatar.png';
    mentorName.textContent = mentor.name;
    skillNameEl.textContent = skill.skill_name;
    dateEl.textContent = formatDate(slot.slot_date);
    timeEl.textContent = `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    alertBox.classList.remove('is-visible');
    Utils.clearAllFieldErrors(form);

    if (notesInput.value.length > 1000) {
      Utils.showFieldError(notesInput, 'Notes must be 1000 characters or fewer.');
      return;
    }

    const restoreButton = Utils.setButtonLoading(submitBtn, 'Sending request...');

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.BOOK_SESSION, {
      method: 'POST',
      body: {
        skill_id: skillId,
        slot_id: slotId,
        notes: notesInput.value.trim(),
      },
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast('Session request sent!', 'success');
      window.setTimeout(() => {
        window.location.href = 'upcoming-sessions.html';
      }, 800);
      return;
    }

    // Slot was taken by someone else in the gap between page load and submit.
    if (data.message && data.message.toLowerCase().includes('no longer exists') ||
        (data.message && data.message.toLowerCase().includes('booked by someone else'))) {
      showUnavailableState();
      return;
    }

    alertBox.textContent = data.message || 'Could not send this booking request.';
    alertBox.classList.add('is-visible');
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  (async function init() {
    await AuthGuard.requireAuth();
    readParamsFromUrl();
    await loadAndValidate();
  })();
})();

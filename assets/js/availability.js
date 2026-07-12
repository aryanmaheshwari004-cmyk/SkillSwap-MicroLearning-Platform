/**
 * Skill Swap - Availability Page Logic
 * Loads the mentor's own availability slots grouped by date,
 * handles new slot creation and deletion of unbooked slots.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  const form = document.getElementById('availability-form');
  const dateInput = document.getElementById('slot-date');
  const startTimeInput = document.getElementById('slot-start-time');
  const endTimeInput = document.getElementById('slot-end-time');
  const addBtn = document.getElementById('availability-add-btn');
  const formAlert = document.getElementById('availability-form-alert');

  const listContainer = document.getElementById('availability-list-container');
  const emptyState = document.getElementById('availability-empty-state');

  // Prevent picking a date in the past.
  dateInput.min = new Date().toISOString().split('T')[0];

  /**
   * Formats a date string into a readable group heading.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDateHeading(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  /**
   * Formats a time string (HH:MM:SS) into a readable 12-hour label.
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
   * Groups a flat slot array by slot_date.
   * @param {Array<Object>} slots
   * @returns {Object<string, Array<Object>>}
   */
  function groupSlotsByDate(slots) {
    const groups = {};
    slots.forEach((slot) => {
      if (!groups[slot.slot_date]) groups[slot.slot_date] = [];
      groups[slot.slot_date].push(slot);
    });
    return groups;
  }

  /**
   * Renders the grouped slot list.
   * @param {Array<Object>} slots
   */
  function renderSlots(slots) {
    listContainer.innerHTML = '';

    if (!slots || slots.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const grouped = groupSlotsByDate(slots);

    Object.keys(grouped).forEach((dateStr) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'availability-date-group';

      const heading = document.createElement('div');
      heading.className = 'availability-date-heading';
      heading.textContent = formatDateHeading(dateStr);
      groupEl.appendChild(heading);

      grouped[dateStr].forEach((slot) => {
        const row = document.createElement('div');
        row.className = 'availability-slot-row';
        row.innerHTML = `
          <span class="availability-slot-time">${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}</span>
          <div class="availability-slot-status">
            <span class="badge ${slot.is_booked ? 'badge-success' : 'badge-neutral'}">${slot.is_booked ? 'Booked' : 'Open'}</span>
            <button type="button" class="availability-delete-btn" ${slot.is_booked ? 'disabled title="Booked slots cannot be deleted"' : ''} aria-label="Delete slot">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        `;

        if (!slot.is_booked) {
          row.querySelector('.availability-delete-btn').addEventListener('click', () => deleteSlot(slot.id));
        }

        groupEl.appendChild(row);
      });

      listContainer.appendChild(groupEl);
    });
  }

  /**
   * Fetches and renders the current user's availability slots.
   */
  async function loadSlots() {
    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.GET_AVAILABILITY, { method: 'GET' });

    if (!ok || !data.success) {
      Utils.showToast(data.message || 'Could not load your availability.', 'error');
      return;
    }

    renderSlots(data.data.slots);
  }

  /**
   * Sends a delete request for a slot, then refreshes the list.
   * @param {number} slotId
   */
  async function deleteSlot(slotId) {
    const confirmed = window.confirm('Remove this availability slot?');
    if (!confirmed) return;

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.SET_AVAILABILITY, {
      method: 'POST',
      body: { action: 'delete', id: slotId },
    });

    if (ok && data.success) {
      Utils.showToast('Slot removed.', 'success');
      await loadSlots();
    } else {
      Utils.showToast(data.message || 'Could not remove this slot.', 'error');
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    Utils.clearAllFieldErrors(form);
    formAlert.classList.remove('is-visible');

    let isValid = true;
    if (!Utils.isNonEmpty(dateInput.value)) {
      Utils.showFieldError(dateInput, 'Please select a date.');
      isValid = false;
    }
    if (!Utils.isNonEmpty(startTimeInput.value)) {
      Utils.showFieldError(startTimeInput, 'Please select a start time.');
      isValid = false;
    }
    if (!Utils.isNonEmpty(endTimeInput.value)) {
      Utils.showFieldError(endTimeInput, 'Please select an end time.');
      isValid = false;
    }
    if (isValid && startTimeInput.value >= endTimeInput.value) {
      Utils.showFieldError(endTimeInput, 'End time must be after start time.');
      isValid = false;
    }

    if (!isValid) return;

    const restoreButton = Utils.setButtonLoading(addBtn, 'Adding...');

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.SET_AVAILABILITY, {
      method: 'POST',
      body: {
        action: 'create',
        slot_date: dateInput.value,
        start_time: startTimeInput.value,
        end_time: endTimeInput.value,
      },
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast('Availability slot added.', 'success');
      form.reset();
      await loadSlots();
      return;
    }

    if (data.errors && typeof data.errors === 'object') {
      const fieldMap = { slot_date: dateInput, start_time: startTimeInput, end_time: endTimeInput };
      Object.keys(data.errors).forEach((field) => {
        const inputEl = fieldMap[field];
        if (inputEl) Utils.showFieldError(inputEl, data.errors[field]);
      });
    }

    formAlert.textContent = data.message || 'Could not add this slot.';
    formAlert.classList.add('is-visible');
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  (async function init() {
    await AuthGuard.requireAuth();
    await loadSlots();
  })();
})();

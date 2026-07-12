/**
 * Skill Swap — Availability UI Enhancements
 * Handles:
 *   1. Weekly grid population (visual layer over existing availability.js data)
 *   2. Hero quick-stats computation from slot data
 *   3. Analytics animated counters
 *   4. Week navigation for the grid header dates
 *
 * TECHNICAL CONTRACT:
 *   - Does NOT touch form submission, API calls, or slot list rendering.
 *   - Reads rendered DOM / hooks into the same slot data via a MutationObserver.
 *   - All existing IDs / form hooks in availability.js remain untouched.
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Week navigation state
     ----------------------------------------------------------------------- */
  let weekOffset = 0; // 0 = current week, -1 = last week, etc.

  const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const GRID_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // ISO Mon-first

  function getWeekDates(offset) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
    // Shift so Monday = 0
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates; // Mon … Sun
  }

  function toISODate(date) {
    return date.toISOString().split('T')[0];
  }

  function renderWeekHeader(offset) {
    const dates = getWeekDates(offset);
    const today = toISODate(new Date());

    // Update the week label
    const label = document.getElementById('avail-week-label');
    if (label) {
      if (offset === 0) {
        label.textContent = 'This Week';
      } else if (offset === 1) {
        label.textContent = 'Next Week';
      } else if (offset === -1) {
        label.textContent = 'Last Week';
      } else {
        const start = dates[0];
        label.textContent = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    }

    // Update each column header
    GRID_ORDER.forEach((abbr, idx) => {
      const dateEl = document.getElementById('grid-date-' + abbr.toLowerCase());
      const headerEl = document.querySelector('.avail-grid-day-header[data-day="' + abbr + '"]');
      const date = dates[idx];

      if (dateEl) {
        dateEl.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      if (headerEl) {
        headerEl.classList.toggle('is-today', toISODate(date) === today);
        headerEl.dataset.isoDate = toISODate(date);
      }
    });

    return dates;
  }

  /* -----------------------------------------------------------------------
     Determine time period for a slot
     ----------------------------------------------------------------------- */
  function getTimePeriod(timeStr) {
    if (!timeStr) return null;
    const [h] = timeStr.split(':').map(Number);
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 23) return 'evening';
    return null;
  }

  /* -----------------------------------------------------------------------
     Format time string (HH:MM:SS) → readable label
     ----------------------------------------------------------------------- */
  function fmtTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /* -----------------------------------------------------------------------
     Populate the weekly grid from slot data
     ----------------------------------------------------------------------- */
  function populateWeeklyGrid(slots, weekDates) {
    // Clear all cells
    document.querySelectorAll('.avail-grid-cell').forEach(cell => {
      cell.innerHTML = '';
    });

    if (!slots || slots.length === 0) return;

    // Build a map: isoDate -> slots[]
    const byDate = {};
    slots.forEach(slot => {
      if (!byDate[slot.slot_date]) byDate[slot.slot_date] = [];
      byDate[slot.slot_date].push(slot);
    });

    // For each day column in the current week
    GRID_ORDER.forEach((dayAbbr, idx) => {
      const isoDate = toISODate(weekDates[idx]);
      const daySlots = byDate[isoDate] || [];

      daySlots.forEach(slot => {
        const period = getTimePeriod(slot.start_time);
        if (!period) return;

        const cell = document.querySelector(
          `.avail-grid-cell[data-day="${dayAbbr}"][data-period="${period}"]`
        );
        if (!cell) return;

        const pill = document.createElement('div');
        pill.className = slot.is_booked
          ? 'avail-slot-pill avail-slot-pill--booked'
          : 'avail-slot-pill avail-slot-pill--available';

        pill.innerHTML = `
          <span class="avail-pill-time">${fmtTime(slot.start_time)} – ${fmtTime(slot.end_time)}</span>
          <span class="avail-pill-status">${slot.is_booked ? '● Booked' : '● Open'}</span>
        `;
        cell.appendChild(pill);
      });
    });
  }

  /* -----------------------------------------------------------------------
     Compute & update quick stats
     ----------------------------------------------------------------------- */
  function updateQuickStats(slots) {
    const openSlots = slots ? slots.filter(s => !s.is_booked) : [];
    const bookedSlots = slots ? slots.filter(s => s.is_booked) : [];

    // Available Slots
    const statSlots = document.getElementById('stat-available-slots');
    if (statSlots) {
      animateCounter(statSlots, 0, openSlots.length, 800, false);
    }

    // This week sessions (booked slots whose date is within current week)
    const weekDates = getWeekDates(0);
    const weekISO = weekDates.map(toISODate);
    const thisWeekBooked = bookedSlots.filter(s => weekISO.includes(s.slot_date));
    const statWeek = document.getElementById('stat-week-sessions');
    if (statWeek) {
      animateCounter(statWeek, 0, thisWeekBooked.length, 800, false);
    }

    // Booking rate
    const statRate = document.getElementById('stat-booking-rate');
    if (statRate) {
      const total = slots ? slots.length : 0;
      const rate = total > 0 ? Math.round((bookedSlots.length / total) * 100) : 0;
      animateCounter(statRate, 0, rate, 900, true);
    }
  }

  /* -----------------------------------------------------------------------
     Compute & update analytics
     ----------------------------------------------------------------------- */
  function updateAnalytics(slots) {
    // Total available hours
    const hoursEl = document.getElementById('analytics-total-hours');
    if (hoursEl && slots) {
      let totalMinutes = 0;
      slots.forEach(s => {
        if (!s.start_time || !s.end_time) return;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
      });
      const hours = Math.max(0, Math.round(totalMinutes / 60));
      animateCounter(hoursEl, 0, hours, 1000, false, 'h');
    }

    // Most booked day
    const dayEl = document.getElementById('analytics-booked-day');
    if (dayEl && slots) {
      const booked = slots.filter(s => s.is_booked);
      const dayCounts = {};
      booked.forEach(s => {
        const d = new Date(s.slot_date + 'T00:00:00');
        const name = d.toLocaleDateString(undefined, { weekday: 'short' });
        dayCounts[name] = (dayCounts[name] || 0) + 1;
      });
      const topDay = Object.keys(dayCounts).sort((a, b) => dayCounts[b] - dayCounts[a])[0];
      dayEl.textContent = topDay || '—';
    }

    // Completion rate
    const complEl = document.getElementById('analytics-completion');
    if (complEl && slots) {
      const booked = slots.filter(s => s.is_booked).length;
      const total = slots.length;
      const rate = total > 0 ? Math.round((booked / total) * 100) : 0;
      animateCounter(complEl, 0, rate, 1000, true);
    }
  }

  /* -----------------------------------------------------------------------
     Animated counter utility
     ----------------------------------------------------------------------- */
  function animateCounter(el, from, to, duration, isPercent, suffix) {
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current = Math.round(from + (to - from) * eased);
      el.textContent = current + (isPercent ? '%' : (suffix || ''));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* -----------------------------------------------------------------------
     Intercept slot data from availability.js via MutationObserver
     We watch for the list container to be populated, then derive stats.
     ----------------------------------------------------------------------- */
  let cachedSlots = null;

  function extractSlotsFromDOM() {
    // Parse the rendered slot rows to rebuild slot data for stats
    const groups = document.querySelectorAll('.availability-date-group');
    const slots = [];
    groups.forEach(group => {
      const dateText = group.querySelector('.availability-date-heading')?.textContent || '';
      const rows = group.querySelectorAll('.availability-slot-row');
      rows.forEach(row => {
        const timeEl = row.querySelector('.availability-slot-time');
        const isBooked = row.querySelector('.badge-success') !== null;
        // Extract date from heading (parse back)
        slots.push({
          slot_date: '', // we can't reliably reverse-parse the display heading
          timeText: timeEl ? timeEl.textContent : '',
          is_booked: isBooked,
          start_time: null,
          end_time: null,
        });
      });
    });
    return slots;
  }

  /* -----------------------------------------------------------------------
     We patch the global data flow by hooking into CONFIG / Utils after
     availability.js loads its slots. We use a MutationObserver on the
     list container to detect when rendering is complete, then fire our
     analytics updates.
     ----------------------------------------------------------------------- */
  function observeSlotList() {
    const container = document.getElementById('availability-list-container');
    if (!container) return;

    const observer = new MutationObserver(() => {
      // Give the DOM a tick to settle
      requestAnimationFrame(() => {
        const slots = extractSlotsFromDOM();
        const bookedCount = slots.filter(s => s.is_booked).length;
        const total = slots.length;
        const openCount = total - bookedCount;

        // Update quick stats
        const statSlots = document.getElementById('stat-available-slots');
        if (statSlots) animateCounter(statSlots, 0, openCount, 700, false);

        const statRate = document.getElementById('stat-booking-rate');
        if (statRate) {
          const rate = total > 0 ? Math.round((bookedCount / total) * 100) : 0;
          animateCounter(statRate, 0, rate, 800, true);
        }

        // Analytics
        const complEl = document.getElementById('analytics-completion');
        if (complEl) {
          const rate = total > 0 ? Math.round((bookedCount / total) * 100) : 0;
          animateCounter(complEl, 0, rate, 900, true);
        }
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  /* -----------------------------------------------------------------------
     Week navigation
     ----------------------------------------------------------------------- */
  function initWeekNav() {
    let currentWeekDates = renderWeekHeader(weekOffset);

    const prevBtn = document.getElementById('avail-prev-week');
    const nextBtn = document.getElementById('avail-next-week');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        weekOffset--;
        currentWeekDates = renderWeekHeader(weekOffset);
        if (cachedSlots) populateWeeklyGrid(cachedSlots, currentWeekDates);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        weekOffset++;
        currentWeekDates = renderWeekHeader(weekOffset);
        if (cachedSlots) populateWeeklyGrid(cachedSlots, currentWeekDates);
      });
    }

    return currentWeekDates;
  }

  /* -----------------------------------------------------------------------
     Intercept Utils.apiRequest to capture slot data for weekly grid
     This is a non-breaking enhancement: if Utils is unavailable, it skips.
     ----------------------------------------------------------------------- */
  function hookIntoAPIResponse() {
    if (typeof Utils === 'undefined' || typeof CONFIG === 'undefined') return;

    const originalApiRequest = Utils.apiRequest.bind(Utils);
    Utils.apiRequest = async function (url, options) {
      const result = await originalApiRequest(url, options);

      // Only intercept GET_AVAILABILITY responses
      if (
        url === CONFIG.ENDPOINTS.GET_AVAILABILITY &&
        result.ok &&
        result.data &&
        result.data.success &&
        result.data.data &&
        result.data.data.slots
      ) {
        cachedSlots = result.data.data.slots;
        const weekDates = getWeekDates(weekOffset);
        populateWeeklyGrid(cachedSlots, weekDates);
        updateQuickStats(cachedSlots);
        updateAnalytics(cachedSlots);
      }

      return result;
    };
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  function init() {
    // Render week header dates immediately
    initWeekNav();

    // Hook API to capture live data
    hookIntoAPIResponse();

    // Observe DOM for when availability.js renders slot rows
    observeSlotList();

    // Set placeholder values while loading
    const statEls = ['stat-available-slots', 'stat-week-sessions'];
    statEls.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '—') {
        el.textContent = '…';
      }
    });

    const rateEl = document.getElementById('stat-booking-rate');
    if (rateEl && rateEl.textContent === '—') rateEl.textContent = '…';

    // Hero stats: set "This Week" badge
    const statWeek = document.getElementById('stat-week-sessions');
    if (statWeek) animateCounter(statWeek, 0, 0, 0, false);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

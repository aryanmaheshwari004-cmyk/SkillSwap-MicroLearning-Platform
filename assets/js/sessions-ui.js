/**
 * Skill Swap — Sessions UI Enhancements (upcoming-sessions.html only)
 *
 * Handles:
 *   1. Hero quick stats (Upcoming / Pending / Accepted counts)
 *   2. "Next Session" spotlight card with avatar initials fallback
 *   3. Countdown timer to the next accepted session
 *   4. Mini calendar widget (renders current month, highlights session dates)
 *
 * TECHNICAL CONTRACT:
 *   - Does NOT touch any form, API, or list rendering logic.
 *   - Does NOT modify upcoming-sessions.js.
 *   - Intercepts Utils.apiRequest non-destructively to read session data.
 *   - All sidebar rendering is additive; removing this file leaves the page functional.
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     State
     ----------------------------------------------------------------------- */
  let cachedSessions = [];
  let countdownInterval = null;
  let calendarOffset = 0; // months from current

  /* -----------------------------------------------------------------------
     Utility: format date string
     ----------------------------------------------------------------------- */
  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtTime(timeStr) {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10), parseInt(m, 10));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function toISODate(d) {
    return d.toISOString().split('T')[0];
  }

  /* -----------------------------------------------------------------------
     1. HERO STATS
     ----------------------------------------------------------------------- */
  function updateHeroStats(sessions) {
    const upcoming  = sessions.length;
    const pending   = sessions.filter(s => s.status === 'pending').length;
    const accepted  = sessions.filter(s => s.status === 'accepted').length;

    animateCounter(document.getElementById('stat-upcoming'),  0, upcoming,  600, false);
    animateCounter(document.getElementById('stat-pending'),   0, pending,   700, false);
    animateCounter(document.getElementById('stat-accepted'),  0, accepted,  800, false);
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

  /* -----------------------------------------------------------------------
     2. NEXT SESSION SPOTLIGHT
     ----------------------------------------------------------------------- */
  function getNextSession(sessions) {
    const now = new Date();
    const future = sessions
      .filter(s => s.status === 'accepted')
      .map(s => ({
        ...s,
        _dt: new Date(s.scheduled_date + 'T' + s.scheduled_time),
      }))
      .filter(s => s._dt > now)
      .sort((a, b) => a._dt - b._dt);
    return future[0] || null;
  }

  function renderNextSession(session) {
    const bodyEl = document.getElementById('sess-next-body');
    if (!bodyEl) return;

    if (!session) {
      bodyEl.innerHTML = `
        <div style="padding:0.5rem 0; text-align:center;">
          <p style="font-size:0.8125rem;color:rgba(226,232,240,0.35);line-height:1.5;">
            No upcoming accepted sessions.<br>Accept a pending request to see it here.
          </p>
        </div>
      `;
      return;
    }

    const photoSrc = session.counterpart_photo || '';
    const name     = session.counterpart_name || 'Unknown';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = session.my_role === 'learner' ? 'Mentor' : 'Learner';

    const avatarHtml = photoSrc
      ? `<img src="${photoSrc}" alt="${name}" class="sess-next-avatar">`
      : `<div class="sess-next-avatar-initials">${initials}</div>`;

    bodyEl.innerHTML = `
      <div class="sess-next-avatar-row">
        ${avatarHtml}
        <div>
          <div class="sess-next-role">${roleLabel}</div>
          <div class="sess-next-name">${name}</div>
        </div>
      </div>
      <div class="sess-next-skill">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        ${session.skill_name || 'Skill Session'}
      </div>
      <div class="sess-next-datetime">
        <div class="sess-next-date">📅 ${fmtDate(session.scheduled_date)}</div>
        <div class="sess-next-time">🕒 ${fmtTime(session.scheduled_time)}</div>
      </div>
    `;

    // Start countdown
    startCountdown(session._dt);
  }

  /* -----------------------------------------------------------------------
     3. COUNTDOWN TIMER
     ----------------------------------------------------------------------- */
  function startCountdown(targetDt) {
    const countdownEl = document.getElementById('sess-countdown');
    if (!countdownEl) return;

    if (countdownInterval) clearInterval(countdownInterval);

    function tick() {
      const diff = targetDt - new Date();
      if (diff <= 0) {
        clearInterval(countdownInterval);
        countdownEl.style.display = 'none';
        return;
      }
      countdownEl.style.display = 'block';

      const totalSecs = Math.floor(diff / 1000);
      const days  = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins  = Math.floor((totalSecs % 3600) / 60);

      const pad = n => String(n).padStart(2, '0');
      document.getElementById('cd-days').textContent  = pad(days);
      document.getElementById('cd-hours').textContent = pad(hours);
      document.getElementById('cd-mins').textContent  = pad(mins);
    }

    tick();
    countdownInterval = setInterval(tick, 30000); // update every 30s
  }

  /* -----------------------------------------------------------------------
     4. MINI CALENDAR
     ----------------------------------------------------------------------- */
  function buildCalendar(sessions, offset) {
    const gridEl = document.getElementById('sess-cal-grid');
    const labelEl = document.getElementById('cal-month-label');
    if (!gridEl || !labelEl) return;

    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);

    labelEl.textContent = targetMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Build set of session dates → status
    const sessionDates = {};
    sessions.forEach(s => {
      const key = s.scheduled_date; // YYYY-MM-DD
      if (!sessionDates[key]) sessionDates[key] = s.status;
      else if (s.status === 'accepted') sessionDates[key] = 'accepted'; // accepted trumps pending
    });

    const firstDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const lastDay  = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    const todayISO = toISODate(now);

    // Remove old day cells (keep the 7 header cells)
    const existingDays = gridEl.querySelectorAll('.sess-cal-day, .sess-cal-empty');
    existingDays.forEach(el => el.remove());

    // Leading empty cells
    const startDow = firstDay.getDay(); // 0=Sun
    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'sess-cal-empty';
      gridEl.appendChild(empty);
    }

    // Day cells
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const cellDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), d);
      const isoDate  = toISODate(cellDate);
      const cell = document.createElement('div');
      cell.className = 'sess-cal-day';
      cell.textContent = d;

      if (isoDate === todayISO) cell.classList.add('is-today');

      if (sessionDates[isoDate]) {
        cell.classList.add(`has-session-${sessionDates[isoDate]}`);
        cell.title = `Session on ${fmtDate(isoDate)} (${sessionDates[isoDate]})`;
      }

      gridEl.appendChild(cell);
    }
  }

  function initCalendar(sessions) {
    buildCalendar(sessions, calendarOffset);

    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calendarOffset--;
        buildCalendar(cachedSessions, calendarOffset);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calendarOffset++;
        buildCalendar(cachedSessions, calendarOffset);
      });
    }
  }

  /* -----------------------------------------------------------------------
     Intercept Utils.apiRequest (non-breaking)
     ----------------------------------------------------------------------- */
  function hookAPIResponse() {
    if (typeof Utils === 'undefined' || typeof CONFIG === 'undefined') return;

    const orig = Utils.apiRequest.bind(Utils);
    Utils.apiRequest = async function (url, options) {
      const result = await orig(url, options);

      if (
        url === CONFIG.ENDPOINTS.GET_UPCOMING_SESSIONS &&
        result.ok &&
        result.data &&
        result.data.success &&
        result.data.data &&
        result.data.data.sessions
      ) {
        cachedSessions = result.data.data.sessions;
        updateHeroStats(cachedSessions);
        renderNextSession(getNextSession(cachedSessions));
        initCalendar(cachedSessions);
      }

      return result;
    };
  }

  /* -----------------------------------------------------------------------
     Fallback: observe DOM for skeleton removal (if hook missed)
     ----------------------------------------------------------------------- */
  function observeListForStats() {
    const container = document.getElementById('upcoming-sessions-list');
    if (!container) return;

    const observer = new MutationObserver(() => {
      // Already handled by API hook — skip if we have cached data
      if (cachedSessions.length > 0) return;

      // Count rendered cards as rough stat
      const cards = container.querySelectorAll('.session-card');
      const pending  = container.querySelectorAll('.status-pending').length;
      const accepted = container.querySelectorAll('.status-accepted').length;

      animateCounter(document.getElementById('stat-upcoming'),  0, cards.length, 500, false);
      animateCounter(document.getElementById('stat-pending'),   0, pending,       600, false);
      animateCounter(document.getElementById('stat-accepted'),  0, accepted,      700, false);
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  function init() {
    hookAPIResponse();
    observeListForStats();

    // Build empty calendar immediately
    buildCalendar([], 0);

    // Set placeholder stat values
    ['stat-upcoming', 'stat-pending', 'stat-accepted'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/**
 * Skill Swap - Upcoming Sessions Page Logic
 * Loads the user's pending/accepted sessions (as learner or mentor)
 * and wires accept/reject/cancel actions per card.
 * Depends on: config.js, utils.js, auth-guard.js.
 */

(function () {
  'use strict';

  const listContainer = document.getElementById('upcoming-sessions-list');
  const emptyState = document.getElementById('upcoming-empty-state');

  const STATUS_LABELS = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

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
   * Builds the action buttons appropriate for a session's status and
   * the current user's role on it.
   * @param {Object} session
   * @returns {HTMLElement}
   */
  function buildActions(session) {
    const wrap = document.createElement('div');
    wrap.className = 'session-card-actions';

    if (session.status === 'pending' && session.my_role === 'mentor') {
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'btn btn-primary btn-sm';
      acceptBtn.textContent = 'Accept';
      acceptBtn.addEventListener('click', () => performAction(session.id, 'accept', acceptBtn));
      wrap.appendChild(acceptBtn);

      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'btn btn-outline btn-sm';
      rejectBtn.textContent = 'Reject';
      rejectBtn.addEventListener('click', () => performAction(session.id, 'reject', rejectBtn));
      wrap.appendChild(rejectBtn);
    }

    if (session.status === 'pending' && session.my_role === 'learner') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost btn-sm';
      cancelBtn.textContent = 'Cancel request';
      cancelBtn.addEventListener('click', () => performAction(session.id, 'cancel', cancelBtn));
      wrap.appendChild(cancelBtn);
    }

    if (session.status === 'accepted') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost btn-sm';
      cancelBtn.textContent = 'Cancel session';
      cancelBtn.addEventListener('click', () => performAction(session.id, 'cancel', cancelBtn));
      wrap.appendChild(cancelBtn);
    }

    return wrap.children.length > 0 ? wrap : null;
  }

  /**
   * Renders a single session card.
   * @param {Object} session
   * @returns {HTMLElement}
   */
  function renderSessionCard(session) {
    const card = document.createElement('article');
    card.className = 'card session-card';

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
    `;

    const actions = buildActions(session);
    if (actions) card.appendChild(actions);

    return card;
  }

  /**
   * Fetches and renders the upcoming sessions list.
   */
  async function loadSessions() {
    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.GET_UPCOMING_SESSIONS, { method: 'GET' });

    if (!ok || !data.success) {
      Utils.showToast(data.message || 'Could not load your sessions.', 'error');
      return;
    }

    const sessions = data.data.sessions;
    listContainer.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    sessions.forEach((session) => {
      listContainer.appendChild(renderSessionCard(session));
    });
  }

  /**
   * Performs an accept/reject/cancel action on a session, then refreshes.
   * @param {number} sessionId
   * @param {string} action
   * @param {HTMLButtonElement} triggerBtn
   */
  async function performAction(sessionId, action, triggerBtn) {
    const confirmMessages = {
      reject: 'Reject this session request?',
      cancel: 'Cancel this session?',
    };

    if (confirmMessages[action] && !window.confirm(confirmMessages[action])) {
      return;
    }

    const restoreButton = Utils.setButtonLoading(triggerBtn, 'Working...');

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.SESSION_ACTION, {
      method: 'POST',
      body: { session_id: sessionId, action },
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast(data.message || 'Session updated.', 'success');
      await loadSessions();
    } else {
      Utils.showToast(data.message || 'Could not update this session.', 'error');
    }
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  (async function init() {
    await AuthGuard.requireAuth();
    await loadSessions();
  })();
})();

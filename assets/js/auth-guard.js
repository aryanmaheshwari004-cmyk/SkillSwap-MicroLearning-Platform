/**
 * Skill Swap - Auth Guard
 * Shared helper for pages that require an authenticated session
 * (profile, dashboard, sessions, etc). Checks session state via
 * the backend and redirects to login if not authenticated.
 * Depends on: config.js, utils.js (must load before this file).
 */

const AuthGuard = {
  /**
   * Cached result of the most recent session check, so multiple
   * scripts on the same page (e.g. navbar.js + page script) don't
   * each fire a separate request.
   * @type {{authenticated: boolean, user: Object|null}|null}
   */
  _cachedSession: null,

  /**
   * Fetches the current session state from the backend.
   * Caches the result for the lifetime of the page.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{authenticated: boolean, user: Object|null}>}
   */
  async getSession(forceRefresh = false) {
    if (this._cachedSession && !forceRefresh) {
      return this._cachedSession;
    }

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.CHECK_SESSION, { method: 'GET' });

    if (ok && data.success && data.data) {
      this._cachedSession = {
        authenticated: Boolean(data.data.authenticated),
        user: data.data.user || null,
      };
    } else {
      this._cachedSession = { authenticated: false, user: null };
    }

    return this._cachedSession;
  },

  /**
   * Requires the visitor to be logged in. Redirects to login.html
   * (preserving the current page as a return target) if not.
   * Call this at the top of any protected page's script.
   * @returns {Promise<Object>} the authenticated user object
   */
  async requireAuth() {
    const session = await this.getSession();

    if (!session.authenticated) {
      const currentPage = window.location.pathname.split('/').pop();
      window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
      // Return a never-resolving promise's worth of nothing further runs,
      // since the browser is navigating away.
      return new Promise(() => {});
    }

    return session.user;
  },

  /**
   * For public pages (e.g. landing page) that want to adjust their UI
   * (show dashboard link vs login/register) without forcing a redirect.
   * @returns {Promise<{authenticated: boolean, user: Object|null}>}
   */
  async checkAuthOptional() {
    return this.getSession();
  },
};

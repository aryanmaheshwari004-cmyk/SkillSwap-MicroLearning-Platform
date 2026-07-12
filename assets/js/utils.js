/**
 * Skill Swap - Shared Frontend Utilities
 * Fetch wrapper, toast notifications, and reusable validators.
 * Depends on: config.js (must load before this file).
 */

const Utils = {
  /**
   * Wraps fetch() for JSON APIs. Always sends/expects JSON,
   * always includes credentials so the PHP session cookie travels.
   *
   * @param {string} url
   * @param {Object} [options]
   * @param {string} [options.method='GET']
   * @param {Object|null} [options.body=null]
   * @returns {Promise<{ok: boolean, status: number, data: any}>}
   */
  async apiRequest(url, { method = 'GET', body = null } = {}) {
    const fetchOptions = {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    };

    if (body !== null) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (networkError) {
      return {
        ok: false,
        status: 0,
        data: { success: false, message: 'Network error. Please check your connection and try again.' },
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      data = { success: false, message: 'Unexpected server response.' };
    }

    return { ok: response.ok, status: response.status, data };
  },

  /**
   * Shows a toast notification. Requires a <div id="toast-container"> on the page.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast${type !== 'info' ? ` toast-${type}` : ''}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, CONFIG.TOAST_DURATION_MS);
  },

  /**
   * Sets a button into a loading state (disabled + text swap) and
   * returns a restore function to call when the request finishes.
   * @param {HTMLButtonElement} button
   * @param {string} loadingText
   * @returns {Function} restore()
   */
  setButtonLoading(button, loadingText) {
    const originalText = button.textContent;
    const originalDisabled = button.disabled;

    button.disabled = true;
    button.textContent = loadingText;

    return function restore() {
      button.disabled = originalDisabled;
      button.textContent = originalText;
    };
  },

  /**
   * Validates an email address format.
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email.trim());
  },

  /**
   * Validates password meets minimum length requirement.
   * @param {string} password
   * @returns {boolean}
   */
  isValidPassword(password) {
    return typeof password === 'string' && password.length >= CONFIG.MIN_PASSWORD_LENGTH;
  },

  /**
   * Checks a string is non-empty after trimming.
   * @param {string} value
   * @returns {boolean}
   */
  isNonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
  },

  /**
   * Shows a field-level error: adds 'has-error' to the closest .form-group
   * and sets the message text inside its .form-error element.
   * @param {HTMLElement} inputEl
   * @param {string} message
   */
  showFieldError(inputEl, message) {
    const group = inputEl.closest('.form-group');
    if (!group) return;
    group.classList.add('has-error');
    const errorEl = group.querySelector('.form-error');
    if (errorEl) errorEl.textContent = message;
  },

  /**
   * Clears a field-level error state.
   * @param {HTMLElement} inputEl
   */
  clearFieldError(inputEl) {
    const group = inputEl.closest('.form-group');
    if (!group) return;
    group.classList.remove('has-error');
  },

  /**
   * Clears all field-level errors within a form.
   * @param {HTMLFormElement} formEl
   */
  clearAllFieldErrors(formEl) {
    formEl.querySelectorAll('.form-group.has-error').forEach((group) => {
      group.classList.remove('has-error');
    });
  },
};

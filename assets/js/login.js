/**
 * Skill Swap - Login Page Logic
 * Handles client-side validation, password visibility toggle,
 * and submission to the backend.
 * Depends on: config.js, utils.js (must load before this file).
 */

(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const rememberCheckbox = document.getElementById('login-remember');
  const submitBtn = document.getElementById('login-submit-btn');
  const alertBox = document.getElementById('login-alert');
  const passwordToggleBtn = document.getElementById('login-password-toggle');

  /**
   * Hides the top-level alert banner.
   */
  function hideAlert() {
    alertBox.classList.remove('is-visible');
    alertBox.textContent = '';
  }

  /**
   * Shows the top-level alert banner with a message.
   * @param {string} message
   */
  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.classList.add('is-visible');
  }

  /**
   * Validates the login form. Shows field-level errors for anything invalid.
   * @returns {boolean} true if the form is valid
   */
  function validateForm() {
    Utils.clearAllFieldErrors(form);
    let isValid = true;

    if (!Utils.isNonEmpty(emailInput.value)) {
      Utils.showFieldError(emailInput, 'Please enter your email address.');
      isValid = false;
    } else if (!Utils.isValidEmail(emailInput.value)) {
      Utils.showFieldError(emailInput, 'Please enter a valid email address.');
      isValid = false;
    }

    if (!Utils.isNonEmpty(passwordInput.value)) {
      Utils.showFieldError(passwordInput, 'Please enter your password.');
      isValid = false;
    }

    return isValid;
  }

  passwordToggleBtn.addEventListener('click', function () {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    passwordToggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  });

  [emailInput, passwordInput].forEach((field) => {
    field.addEventListener('input', () => Utils.clearFieldError(field));
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideAlert();

    if (!validateForm()) {
      return;
    }

    const restoreButton = Utils.setButtonLoading(submitBtn, 'Logging in...');

    const payload = {
      email: emailInput.value.trim().toLowerCase(),
      password: passwordInput.value,
      remember: rememberCheckbox.checked,
    };

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: payload,
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast('Welcome back! Redirecting...', 'success');
      window.setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
      return;
    }

    showAlert(data.message || 'Invalid email or password. Please try again.');
  });
})();

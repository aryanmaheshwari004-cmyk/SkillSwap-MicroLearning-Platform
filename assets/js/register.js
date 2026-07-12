/**
 * Skill Swap - Register Page Logic
 * Handles client-side validation, password strength meter,
 * password visibility toggle, and submission to the backend.
 * Depends on: config.js, utils.js (must load before this file).
 */

(function () {
  'use strict';

  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const confirmPasswordInput = document.getElementById('register-confirm-password');
  const experienceSelect = document.getElementById('register-experience');
  const termsCheckbox = document.getElementById('register-terms');
  const submitBtn = document.getElementById('register-submit-btn');
  const alertBox = document.getElementById('register-alert');
  const passwordToggleBtn = document.getElementById('register-password-toggle');
  const strengthBars = document.querySelectorAll('#password-strength-meter .auth-password-strength-bar');

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
   * Computes a 0-3 strength score for a password and updates the meter bars.
   * @param {string} password
   */
  function updateStrengthMeter(password) {
    let score = 0;

    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    strengthBars.forEach((bar, index) => {
      bar.classList.remove('is-weak', 'is-medium', 'is-strong');
      if (index >= score) return;

      if (score === 1) bar.classList.add('is-weak');
      else if (score === 2) bar.classList.add('is-medium');
      else if (score === 3) bar.classList.add('is-strong');
    });
  }

  /**
   * Validates the full form. Shows field-level errors for anything invalid.
   * @returns {boolean} true if the form is valid
   */
  function validateForm() {
    Utils.clearAllFieldErrors(form);
    let isValid = true;

    if (!Utils.isNonEmpty(nameInput.value)) {
      Utils.showFieldError(nameInput, 'Please enter your full name.');
      isValid = false;
    }

    if (!Utils.isNonEmpty(emailInput.value)) {
      Utils.showFieldError(emailInput, 'Please enter your email address.');
      isValid = false;
    } else if (!Utils.isValidEmail(emailInput.value)) {
      Utils.showFieldError(emailInput, 'Please enter a valid email address.');
      isValid = false;
    }

    if (!Utils.isValidPassword(passwordInput.value)) {
      Utils.showFieldError(passwordInput, `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters.`);
      isValid = false;
    }

    if (confirmPasswordInput.value !== passwordInput.value || !Utils.isNonEmpty(confirmPasswordInput.value)) {
      Utils.showFieldError(confirmPasswordInput, 'Passwords do not match.');
      isValid = false;
    }

    if (!experienceSelect.value) {
      Utils.showFieldError(experienceSelect, 'Please select your experience level.');
      isValid = false;
    }

    if (!termsCheckbox.checked) {
      showAlert('Please agree to the Terms & Privacy Policy to continue.');
      isValid = false;
    }

    return isValid;
  }

  /**
   * Toggles password field visibility for both password fields.
   */
  passwordToggleBtn.addEventListener('click', function () {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    confirmPasswordInput.type = isHidden ? 'text' : 'password';
    passwordToggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  });

  passwordInput.addEventListener('input', function () {
    updateStrengthMeter(passwordInput.value);
    Utils.clearFieldError(passwordInput);
  });

  [nameInput, emailInput, confirmPasswordInput, experienceSelect].forEach((field) => {
    field.addEventListener('input', () => Utils.clearFieldError(field));
    field.addEventListener('change', () => Utils.clearFieldError(field));
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideAlert();

    if (!validateForm()) {
      return;
    }

    const restoreButton = Utils.setButtonLoading(submitBtn, 'Creating account...');

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim().toLowerCase(),
      password: passwordInput.value,
      experience_level: experienceSelect.value,
    };

    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.REGISTER, {
      method: 'POST',
      body: payload,
    });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast('Account created! Redirecting...', 'success');
      window.setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 900);
      return;
    }

    // Map known field-level errors returned by the backend, if present.
    if (data.errors && typeof data.errors === 'object') {
      const fieldMap = {
        name: nameInput,
        email: emailInput,
        password: passwordInput,
        experience_level: experienceSelect,
      };

      Object.keys(data.errors).forEach((field) => {
        const inputEl = fieldMap[field];
        if (inputEl) {
          Utils.showFieldError(inputEl, data.errors[field]);
        }
      });
    }

    showAlert(data.message || 'Something went wrong. Please try again.');
  });
})();

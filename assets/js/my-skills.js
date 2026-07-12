/**
 * Skill Swap - My Skills Page Logic
 * Loads the current user's skills offered/wanted, handles tab
 * switching, and the add/edit/delete modal CRUD flow.
 * Depends on: config.js, utils.js, auth-guard.js, navbar.js.
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Element references
  // ------------------------------------------------------------------
  const tabButtons = document.querySelectorAll('.myskills-tab-btn');
  const offeredList = document.getElementById('offered-skills-list');
  const wantedList = document.getElementById('wanted-skills-list');
  const offeredEmptyState = document.getElementById('offered-empty-state');
  const wantedEmptyState = document.getElementById('wanted-empty-state');

  const addBtn = document.getElementById('myskills-add-btn');
  const modalOverlay = document.getElementById('myskills-modal-overlay');
  const modalTitle = document.getElementById('myskills-modal-title');
  const modalCloseBtn = document.getElementById('myskills-modal-close-btn');
  const modalCancelBtn = document.getElementById('myskills-modal-cancel-btn');
  const modalAlert = document.getElementById('myskills-modal-alert');

  const form = document.getElementById('myskills-form');
  const formIdInput = document.getElementById('skill-form-id');
  const formTypeInput = document.getElementById('skill-form-type');
  const formNameInput = document.getElementById('skill-form-name');
  const formCategorySelect = document.getElementById('skill-form-category');
  const formProficiencySelect = document.getElementById('skill-form-proficiency');
  const formDescriptionTextarea = document.getElementById('skill-form-description');
  const offeredOnlyFields = document.querySelectorAll('.myskills-offered-only');
  const saveBtn = document.getElementById('myskills-save-btn');

  const PROFICIENCY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

  let categoriesCache = [];

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', function () {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      document.querySelectorAll('.myskills-tab-panel').forEach((panel) => panel.classList.remove('is-active'));
      document.getElementById(`tab-panel-${targetTab}`).classList.add('is-active');
    });
  });

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  /**
   * Renders the Skills Offered list.
   * @param {Array<Object>} skills
   */
  function renderOffered(skills) {
    offeredList.innerHTML = '';

    if (!skills || skills.length === 0) {
      offeredEmptyState.classList.remove('hidden');
      return;
    }
    offeredEmptyState.classList.add('hidden');

    skills.forEach((skill) => {
      const card = document.createElement('div');
      card.className = 'card myskills-item-card';
      card.innerHTML = `
        <div class="myskills-item-info">
          <h4>${skill.skill_name}</h4>
          <div class="myskills-item-meta">
            <span class="badge badge-skill">${skill.category_name || 'Uncategorized'}</span>
            <span class="badge badge-neutral">${PROFICIENCY_LABELS[skill.proficiency] || 'Intermediate'}</span>
            ${skill.is_active === 0 ? '<span class="badge badge-warning">Inactive</span>' : ''}
          </div>
          ${skill.description ? `<p class="myskills-item-description">${skill.description}</p>` : ''}
        </div>
        <div class="myskills-item-actions">
          <button type="button" class="myskills-icon-btn" data-action="edit" aria-label="Edit">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="myskills-icon-btn is-danger" data-action="delete" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal('offered', skill));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDelete('offered', skill.id, skill.skill_name));

      offeredList.appendChild(card);
    });
  }

  /**
   * Renders the Skills Wanted list.
   * @param {Array<Object>} skills
   */
  function renderWanted(skills) {
    wantedList.innerHTML = '';

    if (!skills || skills.length === 0) {
      wantedEmptyState.classList.remove('hidden');
      return;
    }
    wantedEmptyState.classList.add('hidden');

    skills.forEach((skill) => {
      const card = document.createElement('div');
      card.className = 'card myskills-item-card';
      card.innerHTML = `
        <div class="myskills-item-info">
          <h4>${skill.skill_name}</h4>
          <div class="myskills-item-meta">
            <span class="badge badge-skill">${skill.category_name || 'Uncategorized'}</span>
          </div>
        </div>
        <div class="myskills-item-actions">
          <button type="button" class="myskills-icon-btn" data-action="edit" aria-label="Edit">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="myskills-icon-btn is-danger" data-action="delete" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal('wanted', skill));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDelete('wanted', skill.id, skill.skill_name));

      wantedList.appendChild(card);
    });
  }

  /**
   * Populates the category <select> with cached categories.
   */
  function populateCategorySelect() {
    formCategorySelect.innerHTML = '<option value="">Select a category</option>';
    categoriesCache.forEach((cat) => {
      const option = document.createElement('option');
      option.value = String(cat.id);
      option.textContent = cat.name;
      formCategorySelect.appendChild(option);
    });
  }

  /**
   * Fetches the user's skills + categories and renders both lists.
   */
  async function loadMySkills() {
    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.GET_MY_SKILLS, { method: 'GET' });

    if (!ok || !data.success) {
      Utils.showToast(data.message || 'Could not load your skills.', 'error');
      return;
    }

    categoriesCache = data.data.categories || [];
    populateCategorySelect();
    renderOffered(data.data.skills_offered);
    renderWanted(data.data.skills_wanted);
  }

  // ------------------------------------------------------------------
  // Modal: open/close
  // ------------------------------------------------------------------

  function toggleOfferedOnlyFields(isOffered) {
    offeredOnlyFields.forEach((field) => field.classList.toggle('is-visible', isOffered));
  }

  function resetForm() {
    Utils.clearAllFieldErrors(form);
    modalAlert.classList.remove('is-visible');
    form.reset();
    formIdInput.value = '';
  }

  function openAddModal(type) {
    resetForm();
    formTypeInput.value = type;
    modalTitle.textContent = type === 'offered' ? 'Add a skill you teach' : 'Add a skill you want to learn';
    toggleOfferedOnlyFields(type === 'offered');
    modalOverlay.classList.add('is-open');
  }

  function openEditModal(type, skill) {
    resetForm();
    formTypeInput.value = type;
    formIdInput.value = String(skill.id);
    formNameInput.value = skill.skill_name;
    formCategorySelect.value = skill.category_id ? String(skill.category_id) : '';

    if (type === 'offered') {
      formProficiencySelect.value = skill.proficiency || 'intermediate';
      formDescriptionTextarea.value = skill.description || '';
    }

    modalTitle.textContent = type === 'offered' ? 'Edit skill offered' : 'Edit skill wanted';
    toggleOfferedOnlyFields(type === 'offered');
    modalOverlay.classList.add('is-open');
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
  }

  addBtn.addEventListener('click', function () {
    const activeTab = document.querySelector('.myskills-tab-btn.is-active').dataset.tab;
    openAddModal(activeTab);
  });

  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (event) {
    if (event.target === modalOverlay) closeModal();
  });

  [formNameInput, formCategorySelect].forEach((field) => {
    field.addEventListener('input', () => Utils.clearFieldError(field));
    field.addEventListener('change', () => Utils.clearFieldError(field));
  });

  // ------------------------------------------------------------------
  // Save (add or edit)
  // ------------------------------------------------------------------

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    Utils.clearAllFieldErrors(form);
    modalAlert.classList.remove('is-visible');

    const type = formTypeInput.value;
    const skillId = formIdInput.value;
    const isEdit = skillId !== '';

    if (!Utils.isNonEmpty(formNameInput.value)) {
      Utils.showFieldError(formNameInput, 'Skill name is required.');
      return;
    }

    const payload = {
      type,
      skill_name: formNameInput.value.trim(),
      category_id: formCategorySelect.value || null,
    };

    if (type === 'offered') {
      payload.proficiency = formProficiencySelect.value;
      payload.description = formDescriptionTextarea.value.trim();
    }

    if (isEdit) {
      payload.id = parseInt(skillId, 10);
    }

    const endpoint = isEdit ? CONFIG.ENDPOINTS.EDIT_SKILL : CONFIG.ENDPOINTS.ADD_SKILL;
    const restoreButton = Utils.setButtonLoading(saveBtn, 'Saving...');

    const { ok, data } = await Utils.apiRequest(endpoint, { method: 'POST', body: payload });

    restoreButton();

    if (ok && data.success) {
      Utils.showToast(data.message || 'Skill saved.', 'success');
      closeModal();
      await loadMySkills();
      return;
    }

    if (data.errors && typeof data.errors === 'object') {
      const fieldMap = {
        skill_name: formNameInput,
        category_id: formCategorySelect,
        proficiency: formProficiencySelect,
        description: formDescriptionTextarea,
      };
      Object.keys(data.errors).forEach((field) => {
        const inputEl = fieldMap[field];
        if (inputEl) Utils.showFieldError(inputEl, data.errors[field]);
      });
    }

    modalAlert.textContent = data.message || 'Could not save this skill.';
    modalAlert.classList.add('is-visible');
  });

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  /**
   * Confirms and performs deletion of a skill.
   * @param {string} type
   * @param {number} id
   * @param {string} skillName
   */
  function confirmDelete(type, id, skillName) {
    const confirmed = window.confirm(`Remove "${skillName}" from your ${type === 'offered' ? 'offerings' : 'wishlist'}?`);
    if (!confirmed) return;

    deleteSkill(type, id);
  }

  /**
   * Sends the delete request and refreshes the lists.
   * @param {string} type
   * @param {number} id
   */
  async function deleteSkill(type, id) {
    const { ok, data } = await Utils.apiRequest(CONFIG.ENDPOINTS.DELETE_SKILL, {
      method: 'POST',
      body: { type, id },
    });

    if (ok && data.success) {
      Utils.showToast(data.message || 'Skill removed.', 'success');
      await loadMySkills();
    } else {
      Utils.showToast(data.message || 'Could not remove this skill.', 'error');
    }
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  (async function init() {
    await AuthGuard.requireAuth();
    await loadMySkills();
  })();
})();

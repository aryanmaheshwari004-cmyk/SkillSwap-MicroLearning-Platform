/**
 * Skill Swap - Frontend Config
 * Shared constants used by every page-specific JS file.
 * Loaded first, before utils.js and any page script.
 */

const CONFIG = {
  // Base path to the backend folder, relative to any HTML page at the project root.
  API_BASE: 'backend',

  ENDPOINTS: {
    // Auth
    REGISTER: 'backend/auth/register_process.php',
    LOGIN: 'backend/auth/login_process.php',
    LOGOUT: 'backend/auth/logout.php',

    // Session / profile
    CHECK_SESSION: 'backend/api/check_session.php',
    GET_PROFILE: 'backend/api/get_profile.php',
    UPDATE_PROFILE: 'backend/profile/update_profile.php',

    // Dashboard
    GET_DASHBOARD_DATA: 'backend/api/get_dashboard_data.php',

    // Skills / marketplace
    SEARCH_SKILLS: 'backend/api/search_skills.php',
    FILTER_SKILLS: 'backend/api/filter_skills.php',
    GET_SKILL_DETAIL: 'backend/api/get_skill_detail.php',
    GET_MY_SKILLS: 'backend/api/get_my_skills.php',
    ADD_SKILL: 'backend/skills/add_skill.php',
    EDIT_SKILL: 'backend/skills/edit_skill.php',
    DELETE_SKILL: 'backend/api/delete_skill.php',

    // Sessions / scheduling
    GET_AVAILABILITY: 'backend/api/get_availability.php',
    SET_AVAILABILITY: 'backend/sessions/set_availability.php',
    CHECK_AVAILABILITY: 'backend/api/check_availability.php',
    BOOK_SESSION: 'backend/sessions/book_session.php',
    SESSION_ACTION: 'backend/sessions/session_action.php',
    GET_UPCOMING_SESSIONS: 'backend/api/get_upcoming_sessions.php',
    GET_SESSION_HISTORY: 'backend/api/get_session_history.php',

    // Reviews
    GET_REVIEWS: 'backend/api/get_reviews.php',
    SUBMIT_REVIEW: 'backend/reviews/submit_review.php',
  },

  // Minimum password length enforced client-side (mirrors backend rule).
  MIN_PASSWORD_LENGTH: 8,

  // Toast auto-dismiss duration in milliseconds.
  TOAST_DURATION_MS: 4000,
};

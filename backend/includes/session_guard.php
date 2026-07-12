<?php
/**
 * Skill Swap - Session Guard Helpers
 * Functions for checking authentication state and enforcing
 * login requirements on protected backend endpoints.
 * No business logic beyond auth state. No HTML.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

/**
 * Returns the currently authenticated user's ID, or null if not logged in.
 * Assumes skillswap_start_session() has already been called.
 *
 * @return int|null
 */
function get_current_user_id(): ?int
{
    if (isset($_SESSION['user_id']) && is_int($_SESSION['user_id'])) {
        return $_SESSION['user_id'];
    }

    return null;
}

/**
 * Returns true if a user is currently authenticated.
 *
 * @return bool
 */
function is_authenticated(): bool
{
    return get_current_user_id() !== null;
}

/**
 * Enforces that a request comes from an authenticated user.
 * Sends a 401 JSON error and exits if not logged in.
 *
 * @return int The authenticated user's ID (only reached if authenticated).
 */
function require_authentication(): int
{
    $userId = get_current_user_id();

    if ($userId === null) {
        send_error('You must be logged in to perform this action.', [], 401);
    }

    return $userId;
}

/**
 * Regenerates the session ID to prevent session fixation,
 * preserving existing session data.
 */
function regenerate_session_id(): void
{
    session_regenerate_id(true);
}

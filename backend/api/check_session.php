<?php
/**
 * Skill Swap - Check Session
 * GET endpoint. Returns the currently authenticated user's public data,
 * or a logged-out state if no valid session exists.
 * Used by every page's navbar.js / auth-guard.js to determine UI state.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/session_guard.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

skillswap_start_session();

require_http_method('GET');

$userId = get_current_user_id();

if ($userId === null) {
    send_success('No active session.', [
        'authenticated' => false,
        'user'          => null,
    ], 200);
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare(
        'SELECT id, name, email, profile_photo, bio, experience_level, is_active
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    // Session points to a user that no longer exists or was deactivated —
    // treat as logged out and clear the stale session.
    if ($user === false || (int) $user['is_active'] !== 1) {
        $_SESSION = [];
        session_destroy();

        send_success('Session expired.', [
            'authenticated' => false,
            'user'          => null,
        ], 200);
    }

    send_success('Active session found.', [
        'authenticated' => true,
        'user' => [
            'id'               => (int) $user['id'],
            'name'             => $user['name'],
            'email'            => $user['email'],
            'profile_photo'    => $user['profile_photo'],
            'bio'              => $user['bio'],
            'experience_level' => $user['experience_level'],
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during session check.';
    error_log('[check_session] ' . $logMessage);
    send_error('Something went wrong while checking your session.', [], 500);
}

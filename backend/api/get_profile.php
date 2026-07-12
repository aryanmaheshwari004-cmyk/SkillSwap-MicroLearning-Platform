<?php
/**
 * Skill Swap - Get Profile
 * GET endpoint. Returns the authenticated user's full profile:
 * basic info, skills offered, skills wanted, and summary stats.
 * Requires an authenticated session.
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

$userId = require_authentication();

try {
    $pdo = Database::getConnection();

    // ------------------------------------------------------------
    // Core profile fields
    // ------------------------------------------------------------
    $userStmt = $pdo->prepare(
        'SELECT id, name, email, profile_photo, bio, experience_level, created_at
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();

    if ($user === false) {
        send_error('Profile not found.', [], 404);
    }

    // ------------------------------------------------------------
    // Skills offered
    // ------------------------------------------------------------
    $offeredStmt = $pdo->prepare(
        'SELECT so.id, so.skill_name, so.description, so.proficiency, c.name AS category_name
         FROM skills_offered so
         LEFT JOIN categories c ON c.id = so.category_id
         WHERE so.user_id = :user_id AND so.is_active = 1
         ORDER BY so.created_at DESC'
    );
    $offeredStmt->execute(['user_id' => $userId]);
    $skillsOffered = $offeredStmt->fetchAll();

    // ------------------------------------------------------------
    // Skills wanted
    // ------------------------------------------------------------
    $wantedStmt = $pdo->prepare(
        'SELECT sw.id, sw.skill_name, c.name AS category_name
         FROM skills_wanted sw
         LEFT JOIN categories c ON c.id = sw.category_id
         WHERE sw.user_id = :user_id
         ORDER BY sw.created_at DESC'
    );
    $wantedStmt->execute(['user_id' => $userId]);
    $skillsWanted = $wantedStmt->fetchAll();

    // ------------------------------------------------------------
    // Stats: completed sessions count, skills offered count, avg rating
    // ------------------------------------------------------------
    $statsStmt = $pdo->prepare(
        'SELECT
            (SELECT COUNT(*) FROM sessions
                WHERE (mentor_id = :uid1 OR learner_id = :uid2) AND status = "completed"
            ) AS sessions_completed,
            (SELECT COUNT(*) FROM skills_offered WHERE user_id = :uid3 AND is_active = 1
            ) AS skills_offered_count,
            (SELECT AVG(rating) FROM reviews WHERE reviewee_id = :uid4
            ) AS average_rating'
    );
    $statsStmt->execute([
        'uid1' => $userId,
        'uid2' => $userId,
        'uid3' => $userId,
        'uid4' => $userId,
    ]);
    $stats = $statsStmt->fetch();

    send_success('Profile loaded successfully.', [
        'profile' => [
            'id'               => (int) $user['id'],
            'name'             => $user['name'],
            'email'            => $user['email'],
            'profile_photo'    => $user['profile_photo'],
            'bio'              => $user['bio'],
            'experience_level' => $user['experience_level'],
            'member_since'     => $user['created_at'],
            'skills_offered'   => $skillsOffered,
            'skills_wanted'    => $skillsWanted,
            'stats' => [
                'sessions_completed'  => (int) $stats['sessions_completed'],
                'skills_offered_count' => (int) $stats['skills_offered_count'],
                'average_rating'      => $stats['average_rating'] !== null ? (float) $stats['average_rating'] : null,
            ],
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching profile.';
    error_log('[get_profile] ' . $logMessage);
    send_error('Something went wrong while loading your profile.', [], 500);
}

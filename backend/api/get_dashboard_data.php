<?php
/**
 * Skill Swap - Get Dashboard Data
 * GET endpoint. Requires authentication.
 * Returns a single aggregated payload for dashboard.html:
 *   - active sessions count (pending + accepted)
 *   - completed sessions count
 *   - average rating + review count
 *   - skills offered / wanted counts
 *   - upcoming sessions preview (next 3)
 *   - recent reviews preview (latest 3 received)
 *   - profile completion status (which fields are filled in)
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
    // Core stats: active/completed sessions, ratings, skill counts
    // ------------------------------------------------------------
    $statsStmt = $pdo->prepare(
        'SELECT
            (SELECT COUNT(*) FROM sessions
                WHERE (mentor_id = :uid1 OR learner_id = :uid2) AND status IN ("pending", "accepted")
            ) AS active_sessions_count,
            (SELECT COUNT(*) FROM sessions
                WHERE (mentor_id = :uid3 OR learner_id = :uid4) AND status = "completed"
            ) AS completed_sessions_count,
            (SELECT AVG(rating) FROM reviews WHERE reviewee_id = :uid5
            ) AS average_rating,
            (SELECT COUNT(*) FROM reviews WHERE reviewee_id = :uid6
            ) AS review_count,
            (SELECT COUNT(*) FROM skills_offered WHERE user_id = :uid7 AND is_active = 1
            ) AS skills_offered_count,
            (SELECT COUNT(*) FROM skills_wanted WHERE user_id = :uid8
            ) AS skills_wanted_count'
    );
    $statsStmt->execute([
        'uid1' => $userId, 'uid2' => $userId, 'uid3' => $userId, 'uid4' => $userId,
        'uid5' => $userId, 'uid6' => $userId, 'uid7' => $userId, 'uid8' => $userId,
    ]);
    $stats = $statsStmt->fetch();

    // ------------------------------------------------------------
    // Upcoming sessions preview (next 3 by date/time)
    // ------------------------------------------------------------
    $upcomingStmt = $pdo->prepare(
        'SELECT s.id, s.status, s.scheduled_date, s.scheduled_time, so.skill_name,
                CASE WHEN s.learner_id = :uid1 THEN "learner" ELSE "mentor" END AS my_role,
                CASE WHEN s.learner_id = :uid2 THEN mentor.name ELSE learner.name END AS counterpart_name,
                CASE WHEN s.learner_id = :uid3 THEN mentor.profile_photo ELSE learner.profile_photo END AS counterpart_photo
         FROM sessions s
         INNER JOIN skills_offered so ON so.id = s.skill_id
         INNER JOIN users learner ON learner.id = s.learner_id
         INNER JOIN users mentor ON mentor.id = s.mentor_id
         WHERE (s.learner_id = :uid4 OR s.mentor_id = :uid5)
           AND s.status IN ("pending", "accepted")
         ORDER BY s.scheduled_date ASC, s.scheduled_time ASC
         LIMIT 3'
    );
    $upcomingStmt->execute([
        'uid1' => $userId, 'uid2' => $userId, 'uid3' => $userId, 'uid4' => $userId, 'uid5' => $userId,
    ]);
    $upcomingPreview = $upcomingStmt->fetchAll();

    // ------------------------------------------------------------
    // Recent reviews preview (latest 3 received by this user)
    // ------------------------------------------------------------
    $reviewsStmt = $pdo->prepare(
        'SELECT r.rating, r.comment, r.created_at, reviewer.name AS reviewer_name,
                reviewer.profile_photo AS reviewer_photo
         FROM reviews r
         INNER JOIN users reviewer ON reviewer.id = r.reviewer_id
         WHERE r.reviewee_id = :user_id
         ORDER BY r.created_at DESC
         LIMIT 3'
    );
    $reviewsStmt->execute(['user_id' => $userId]);
    $recentReviews = $reviewsStmt->fetchAll();

    // ------------------------------------------------------------
    // Profile completion status
    // ------------------------------------------------------------
    $userStmt = $pdo->prepare(
        'SELECT name, profile_photo, bio, experience_level FROM users WHERE id = :id LIMIT 1'
    );
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();

    if ($user === false) {
        send_error('Profile not found.', [], 404);
    }

    $completionChecks = [
        'has_photo'           => !empty($user['profile_photo']),
        'has_bio'             => !empty(trim((string) $user['bio'])),
        'has_experience_level' => !empty($user['experience_level']),
        'has_skill_offered'   => (int) $stats['skills_offered_count'] > 0,
        'has_skill_wanted'    => (int) $stats['skills_wanted_count'] > 0,
    ];
    $completedCount = count(array_filter($completionChecks));
    $totalChecks = count($completionChecks);
    $completionPercent = (int) round(($completedCount / $totalChecks) * 100);

    send_success('Dashboard data loaded.', [
        'stats' => [
            'active_sessions_count'    => (int) $stats['active_sessions_count'],
            'completed_sessions_count' => (int) $stats['completed_sessions_count'],
            'average_rating'           => $stats['average_rating'] !== null ? round((float) $stats['average_rating'], 1) : null,
            'review_count'             => (int) $stats['review_count'],
            'skills_offered_count'     => (int) $stats['skills_offered_count'],
            'skills_wanted_count'      => (int) $stats['skills_wanted_count'],
        ],
        'upcoming_preview' => $upcomingPreview,
        'recent_reviews'   => $recentReviews,
        'profile_completion' => [
            'percent' => $completionPercent,
            'checks'  => $completionChecks,
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while loading dashboard data.';
    error_log('[get_dashboard_data] ' . $logMessage);
    send_error('Something went wrong while loading your dashboard.', [], 500);
}

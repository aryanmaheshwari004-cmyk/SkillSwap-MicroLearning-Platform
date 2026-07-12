<?php
/**
 * Skill Swap - Get Session History
 * GET endpoint. Requires authentication.
 * Returns the current user's past sessions: "completed", "rejected",
 * or "cancelled", as either learner or mentor, with skill info,
 * counterparty info, and whether the user has already left a review
 * for that session.
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

    $stmt = $pdo->prepare(
        'SELECT s.id, s.status, s.scheduled_date, s.scheduled_time, s.notes, s.updated_at,
                so.skill_name,
                s.learner_id, s.mentor_id,
                CASE WHEN s.learner_id = :uid THEN "learner" ELSE "mentor" END AS my_role,
                CASE WHEN s.learner_id = :uid2 THEN mentor.id ELSE learner.id END AS counterpart_id,
                CASE WHEN s.learner_id = :uid3 THEN mentor.name ELSE learner.name END AS counterpart_name,
                CASE WHEN s.learner_id = :uid4 THEN mentor.profile_photo ELSE learner.profile_photo END AS counterpart_photo,
                (SELECT COUNT(*) FROM reviews r WHERE r.session_id = s.id AND r.reviewer_id = :uid5) AS has_reviewed
         FROM sessions s
         INNER JOIN skills_offered so ON so.id = s.skill_id
         INNER JOIN users learner ON learner.id = s.learner_id
         INNER JOIN users mentor ON mentor.id = s.mentor_id
         WHERE (s.learner_id = :uid6 OR s.mentor_id = :uid7)
           AND s.status IN ("completed", "rejected", "cancelled")
         ORDER BY s.scheduled_date DESC, s.scheduled_time DESC'
    );
    $stmt->execute([
        'uid' => $userId, 'uid2' => $userId, 'uid3' => $userId, 'uid4' => $userId,
        'uid5' => $userId, 'uid6' => $userId, 'uid7' => $userId,
    ]);
    $sessions = $stmt->fetchAll();

    foreach ($sessions as &$row) {
        $row['id'] = (int) $row['id'];
        $row['learner_id'] = (int) $row['learner_id'];
        $row['mentor_id'] = (int) $row['mentor_id'];
        $row['counterpart_id'] = (int) $row['counterpart_id'];
        $row['has_reviewed'] = (int) $row['has_reviewed'] > 0;
    }

    send_success('Session history loaded.', ['sessions' => $sessions], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching session history.';
    error_log('[get_session_history] ' . $logMessage);
    send_error('Something went wrong while loading your session history.', [], 500);
}

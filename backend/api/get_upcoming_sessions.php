<?php
/**
 * Skill Swap - Get Upcoming Sessions
 * GET endpoint. Requires authentication.
 * Returns the current user's sessions with status "pending" or
 * "accepted", as either learner or mentor, with skill and
 * counterparty info joined in.
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
        'SELECT s.id, s.status, s.scheduled_date, s.scheduled_time, s.notes, s.created_at,
                so.skill_name,
                s.learner_id, s.mentor_id,
                CASE WHEN s.learner_id = :uid THEN "learner" ELSE "mentor" END AS my_role,
                CASE WHEN s.learner_id = :uid2 THEN mentor.id ELSE learner.id END AS counterpart_id,
                CASE WHEN s.learner_id = :uid3 THEN mentor.name ELSE learner.name END AS counterpart_name,
                CASE WHEN s.learner_id = :uid4 THEN mentor.profile_photo ELSE learner.profile_photo END AS counterpart_photo
         FROM sessions s
         INNER JOIN skills_offered so ON so.id = s.skill_id
         INNER JOIN users learner ON learner.id = s.learner_id
         INNER JOIN users mentor ON mentor.id = s.mentor_id
         WHERE (s.learner_id = :uid5 OR s.mentor_id = :uid6)
           AND s.status IN ("pending", "accepted")
         ORDER BY s.scheduled_date ASC, s.scheduled_time ASC'
    );
    $stmt->execute([
        'uid' => $userId, 'uid2' => $userId, 'uid3' => $userId,
        'uid4' => $userId, 'uid5' => $userId, 'uid6' => $userId,
    ]);
    $sessions = $stmt->fetchAll();

    foreach ($sessions as &$row) {
        $row['id'] = (int) $row['id'];
        $row['learner_id'] = (int) $row['learner_id'];
        $row['mentor_id'] = (int) $row['mentor_id'];
        $row['counterpart_id'] = (int) $row['counterpart_id'];
    }

    send_success('Upcoming sessions loaded.', ['sessions' => $sessions], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching upcoming sessions.';
    error_log('[get_upcoming_sessions] ' . $logMessage);
    send_error('Something went wrong while loading your sessions.', [], 500);
}

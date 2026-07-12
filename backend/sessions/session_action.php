<?php
/**
 * Skill Swap - Session Action
 * POST endpoint. Requires authentication.
 * JSON body: { session_id, action }
 * Supported actions:
 *   "accept"   - mentor accepts a pending request
 *   "reject"   - mentor rejects a pending request (releases the slot)
 *   "cancel"   - learner or mentor cancels an accepted/pending session (releases the slot)
 *   "complete" - either party marks an accepted session as completed
 *                (only allowed once the scheduled time has passed)
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

require_http_method('POST');

$userId = require_authentication();
$input = get_json_request_body();

$sessionId = isset($input['session_id']) ? (int) $input['session_id'] : 0;
$action    = isset($input['action']) ? trim((string) $input['action']) : '';

$allowedActions = ['accept', 'reject', 'cancel', 'complete'];

if ($sessionId <= 0) {
    send_error('A valid session id is required.', ['session_id' => 'Invalid session id.'], 422);
}
if (!in_array($action, $allowedActions, true)) {
    send_error('Unknown action.', ['action' => 'Action must be one of: accept, reject, cancel, complete.'], 422);
}

try {
    $pdo = Database::getConnection();
    $pdo->beginTransaction();

    $sessionStmt = $pdo->prepare(
        'SELECT id, learner_id, mentor_id, slot_id, status, scheduled_date, scheduled_time
         FROM sessions
         WHERE id = :id
         FOR UPDATE'
    );
    $sessionStmt->execute(['id' => $sessionId]);
    $session = $sessionStmt->fetch();

    if ($session === false) {
        $pdo->rollBack();
        send_error('This session was not found.', [], 404);
    }

    $isMentor = (int) $session['mentor_id'] === $userId;
    $isLearner = (int) $session['learner_id'] === $userId;

    if (!$isMentor && !$isLearner) {
        $pdo->rollBack();
        send_error('You do not have permission to act on this session.', [], 403);
    }

    $currentStatus = $session['status'];

    switch ($action) {
        case 'accept':
            if (!$isMentor) {
                $pdo->rollBack();
                send_error('Only the mentor can accept a session request.', [], 403);
            }
            if ($currentStatus !== 'pending') {
                $pdo->rollBack();
                send_error('Only pending sessions can be accepted.', [], 409);
            }
            $newStatus = 'accepted';
            break;

        case 'reject':
            if (!$isMentor) {
                $pdo->rollBack();
                send_error('Only the mentor can reject a session request.', [], 403);
            }
            if ($currentStatus !== 'pending') {
                $pdo->rollBack();
                send_error('Only pending sessions can be rejected.', [], 409);
            }
            $newStatus = 'rejected';
            break;

        case 'cancel':
            if (!in_array($currentStatus, ['pending', 'accepted'], true)) {
                $pdo->rollBack();
                send_error('Only pending or accepted sessions can be cancelled.', [], 409);
            }
            $newStatus = 'cancelled';
            break;

        case 'complete':
            if ($currentStatus !== 'accepted') {
                $pdo->rollBack();
                send_error('Only accepted sessions can be marked completed.', [], 409);
            }
            $scheduledTimestamp = strtotime($session['scheduled_date'] . ' ' . $session['scheduled_time']);
            if ($scheduledTimestamp > time()) {
                $pdo->rollBack();
                send_error('This session cannot be marked completed before its scheduled time.', [], 409);
            }
            $newStatus = 'completed';
            break;

        default:
            $pdo->rollBack();
            send_error('Unknown action.', [], 422);
    }

    $updateStmt = $pdo->prepare('UPDATE sessions SET status = :status, updated_at = NOW() WHERE id = :id');
    $updateStmt->execute(['status' => $newStatus, 'id' => $sessionId]);

    // Releasing the slot on reject/cancel so it becomes bookable again.
    if (in_array($newStatus, ['rejected', 'cancelled'], true)) {
        $releaseStmt = $pdo->prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = :id');
        $releaseStmt->execute(['id' => $session['slot_id']]);
    }

    $pdo->commit();

    $messages = [
        'accepted'  => 'Session accepted.',
        'rejected'  => 'Session rejected.',
        'cancelled' => 'Session cancelled.',
        'completed' => 'Session marked as completed.',
    ];

    send_success($messages[$newStatus], ['session_id' => $sessionId, 'status' => $newStatus], 200);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during session action.';
    error_log('[session_action] ' . $logMessage);
    send_error('Something went wrong while updating this session.', [], 500);
}

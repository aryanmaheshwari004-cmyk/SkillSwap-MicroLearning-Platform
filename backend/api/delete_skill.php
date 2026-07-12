<?php
/**
 * Skill Swap - Delete Skill
 * POST endpoint. Requires authentication.
 * JSON body: { type: "offered"|"wanted", id }
 * Deletes a skill row, but only if it belongs to the authenticated user.
 * Skills offered with active session bookings are soft-deactivated
 * instead of hard-deleted, to preserve session history integrity.
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

$type    = isset($input['type']) ? trim((string) $input['type']) : '';
$skillId = isset($input['id']) ? (int) $input['id'] : 0;

$errors = [];
if (!in_array($type, ['offered', 'wanted'], true)) {
    $errors['type'] = 'Skill type must be "offered" or "wanted".';
}
if ($skillId <= 0) {
    $errors['id'] = 'A valid skill id is required.';
}
if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

try {
    $pdo = Database::getConnection();
    $table = $type === 'offered' ? 'skills_offered' : 'skills_wanted';

    $ownerCheck = $pdo->prepare("SELECT user_id FROM $table WHERE id = :id LIMIT 1");
    $ownerCheck->execute(['id' => $skillId]);
    $existingRow = $ownerCheck->fetch();

    if ($existingRow === false) {
        send_error('This skill listing was not found.', [], 404);
    }

    if ((int) $existingRow['user_id'] !== $userId) {
        send_error('You do not have permission to delete this skill.', [], 403);
    }

    if ($type === 'wanted') {
        // No FK dependents reference skills_wanted — safe to hard-delete.
        $deleteStmt = $pdo->prepare('DELETE FROM skills_wanted WHERE id = :id AND user_id = :user_id');
        $deleteStmt->execute(['id' => $skillId, 'user_id' => $userId]);

        send_success('Skill removed from your wishlist.', [], 200);
    }

    // For "offered" skills, sessions.skill_id has a FK reference, so a
    // skill with any booked/completed session history cannot be hard-deleted
    // without breaking that history. Check for dependent sessions first.
    $sessionCheckStmt = $pdo->prepare('SELECT COUNT(*) FROM sessions WHERE skill_id = :skill_id');
    $sessionCheckStmt->execute(['skill_id' => $skillId]);
    $hasSessions = (int) $sessionCheckStmt->fetchColumn() > 0;

    if ($hasSessions) {
        // Soft-delete: deactivate so it no longer appears in marketplace/profile,
        // but preserve the row for session/review history integrity.
        $deactivateStmt = $pdo->prepare(
            'UPDATE skills_offered SET is_active = 0, updated_at = NOW() WHERE id = :id AND user_id = :user_id'
        );
        $deactivateStmt->execute(['id' => $skillId, 'user_id' => $userId]);

        send_success('Skill removed from your offerings. (Kept in your session history.)', [], 200);
    }

    $deleteStmt = $pdo->prepare('DELETE FROM skills_offered WHERE id = :id AND user_id = :user_id');
    $deleteStmt->execute(['id' => $skillId, 'user_id' => $userId]);

    send_success('Skill removed from your offerings.', [], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while deleting skill.';
    error_log('[delete_skill] ' . $logMessage);
    send_error('Something went wrong while deleting your skill.', [], 500);
}

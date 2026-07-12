<?php
/**
 * Skill Swap - Set Availability
 * POST endpoint. Requires authentication.
 * JSON body actions:
 *   { action: "create", slot_date, start_time, end_time }
 *   { action: "delete", id }
 * Creates a new availability slot for the current user (as mentor),
 * or deletes one of their own unbooked slots.
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

$action = isset($input['action']) ? trim((string) $input['action']) : '';

if ($action === 'create') {
    handle_create_slot($userId, $input);
} elseif ($action === 'delete') {
    handle_delete_slot($userId, $input);
} else {
    send_error('Unknown or missing action.', [], 400);
}

/**
 * Validates and inserts a new availability slot.
 *
 * @param int   $userId
 * @param array $input
 */
function handle_create_slot(int $userId, array $input): void
{
    $slotDate  = isset($input['slot_date']) ? trim((string) $input['slot_date']) : '';
    $startTime = isset($input['start_time']) ? trim((string) $input['start_time']) : '';
    $endTime   = isset($input['end_time']) ? trim((string) $input['end_time']) : '';

    $errors = [];

    $dateObj = DateTime::createFromFormat('Y-m-d', $slotDate);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $slotDate) {
        $errors['slot_date'] = 'Please provide a valid date (YYYY-MM-DD).';
    } elseif ($slotDate < date('Y-m-d')) {
        $errors['slot_date'] = 'Date must be today or in the future.';
    }

    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $startTime)) {
        $errors['start_time'] = 'Please provide a valid start time.';
    }
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $endTime)) {
        $errors['end_time'] = 'Please provide a valid end time.';
    }

    if (empty($errors) && $startTime >= $endTime) {
        $errors['end_time'] = 'End time must be after start time.';
    }

    if (!empty($errors)) {
        send_error('Please correct the errors below.', $errors, 422);
    }

    try {
        $pdo = Database::getConnection();

        // Prevent exact-duplicate slot creation for the same mentor.
        $dupeCheck = $pdo->prepare(
            'SELECT id FROM availability_slots
             WHERE mentor_id = :mentor_id AND slot_date = :slot_date
               AND start_time = :start_time AND end_time = :end_time
             LIMIT 1'
        );
        $dupeCheck->execute([
            'mentor_id'  => $userId,
            'slot_date'  => $slotDate,
            'start_time' => $startTime,
            'end_time'   => $endTime,
        ]);
        if ($dupeCheck->fetch() !== false) {
            send_error('You already have this exact slot listed.', [], 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO availability_slots (mentor_id, slot_date, start_time, end_time, is_booked, created_at)
             VALUES (:mentor_id, :slot_date, :start_time, :end_time, 0, NOW())'
        );
        $stmt->execute([
            'mentor_id'  => $userId,
            'slot_date'  => $slotDate,
            'start_time' => $startTime,
            'end_time'   => $endTime,
        ]);

        send_success('Availability slot added.', [
            'slot' => [
                'id' => (int) $pdo->lastInsertId(),
                'slot_date' => $slotDate, 'start_time' => $startTime, 'end_time' => $endTime,
            ],
        ], 201);
    } catch (PDOException $e) {
        $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while creating slot.';
        error_log('[set_availability:create] ' . $logMessage);
        send_error('Something went wrong while adding this slot.', [], 500);
    }
}

/**
 * Deletes an availability slot owned by the user, only if unbooked.
 *
 * @param int   $userId
 * @param array $input
 */
function handle_delete_slot(int $userId, array $input): void
{
    $slotId = isset($input['id']) ? (int) $input['id'] : 0;

    if ($slotId <= 0) {
        send_error('A valid slot id is required.', ['id' => 'Invalid slot id.'], 422);
    }

    try {
        $pdo = Database::getConnection();

        $checkStmt = $pdo->prepare(
            'SELECT mentor_id, is_booked FROM availability_slots WHERE id = :id LIMIT 1'
        );
        $checkStmt->execute(['id' => $slotId]);
        $slot = $checkStmt->fetch();

        if ($slot === false) {
            send_error('This slot was not found.', [], 404);
        }

        if ((int) $slot['mentor_id'] !== $userId) {
            send_error('You do not have permission to delete this slot.', [], 403);
        }

        if ((bool) $slot['is_booked']) {
            send_error('This slot is already booked and cannot be deleted. Cancel the session instead.', [], 409);
        }

        $deleteStmt = $pdo->prepare('DELETE FROM availability_slots WHERE id = :id AND mentor_id = :mentor_id');
        $deleteStmt->execute(['id' => $slotId, 'mentor_id' => $userId]);

        send_success('Availability slot removed.', [], 200);
    } catch (PDOException $e) {
        $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while deleting slot.';
        error_log('[set_availability:delete] ' . $logMessage);
        send_error('Something went wrong while removing this slot.', [], 500);
    }
}

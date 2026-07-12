<?php
/**
 * Skill Swap - Book Session
 * POST endpoint. Requires authentication.
 * JSON body: { skill_id, slot_id, notes }
 * Creates a pending session request for the authenticated user (as
 * learner) against a mentor's open availability slot. Uses a DB
 * transaction with a row lock to atomically verify the slot is still
 * open and mark it booked, preventing two learners from booking the
 * same slot in a race condition.
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

$learnerId = require_authentication();
$input = get_json_request_body();

$skillId = isset($input['skill_id']) ? (int) $input['skill_id'] : 0;
$slotId  = isset($input['slot_id']) ? (int) $input['slot_id'] : 0;
$notes   = isset($input['notes']) ? trim((string) $input['notes']) : '';

$errors = [];
if ($skillId <= 0) {
    $errors['skill_id'] = 'A valid skill is required.';
}
if ($slotId <= 0) {
    $errors['slot_id'] = 'A valid time slot is required.';
}
if (mb_strlen($notes) > 1000) {
    $errors['notes'] = 'Notes must be 1000 characters or fewer.';
}
if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

try {
    $pdo = Database::getConnection();
    $pdo->beginTransaction();

    // Lock the slot row for the duration of this transaction so a
    // concurrent booking attempt on the same slot must wait, then
    // see is_booked = 1 and fail cleanly rather than double-booking.
    $slotStmt = $pdo->prepare(
        'SELECT id, mentor_id, slot_date, start_time, end_time, is_booked
         FROM availability_slots
         WHERE id = :id
         FOR UPDATE'
    );
    $slotStmt->execute(['id' => $slotId]);
    $slot = $slotStmt->fetch();

    if ($slot === false) {
        $pdo->rollBack();
        send_error('This time slot no longer exists.', [], 404);
    }

    if ((bool) $slot['is_booked']) {
        $pdo->rollBack();
        send_error('This time slot has just been booked by someone else. Please pick another.', [], 409);
    }

    $slotDateTime = strtotime($slot['slot_date'] . ' ' . $slot['start_time']);
    if ($slotDateTime < time()) {
        $pdo->rollBack();
        send_error('This time slot is in the past.', [], 409);
    }

    $mentorId = (int) $slot['mentor_id'];

    if ($mentorId === $learnerId) {
        $pdo->rollBack();
        send_error('You cannot book a session with yourself.', [], 422);
    }

    // Confirm the skill exists, belongs to this mentor, and is active.
    $skillStmt = $pdo->prepare(
        'SELECT id, user_id FROM skills_offered WHERE id = :id AND is_active = 1 LIMIT 1'
    );
    $skillStmt->execute(['id' => $skillId]);
    $skill = $skillStmt->fetch();

    if ($skill === false) {
        $pdo->rollBack();
        send_error('This skill listing is no longer available.', [], 404);
    }

    if ((int) $skill['user_id'] !== $mentorId) {
        $pdo->rollBack();
        send_error('This skill does not belong to the mentor of the selected slot.', [], 422);
    }

    // Mark the slot booked.
    $lockStmt = $pdo->prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = :id');
    $lockStmt->execute(['id' => $slotId]);

    // Create the pending session.
    $insertStmt = $pdo->prepare(
        'INSERT INTO sessions (learner_id, mentor_id, skill_id, slot_id, status, scheduled_date, scheduled_time, notes, created_at, updated_at)
         VALUES (:learner_id, :mentor_id, :skill_id, :slot_id, "pending", :scheduled_date, :scheduled_time, :notes, NOW(), NOW())'
    );
    $insertStmt->execute([
        'learner_id'      => $learnerId,
        'mentor_id'       => $mentorId,
        'skill_id'        => $skillId,
        'slot_id'         => $slotId,
        'scheduled_date'  => $slot['slot_date'],
        'scheduled_time'  => $slot['start_time'],
        'notes'           => $notes !== '' ? $notes : null,
    ]);

    $newSessionId = (int) $pdo->lastInsertId();

    $pdo->commit();

    send_success('Session request sent! The mentor will respond shortly.', [
        'session' => [
            'id'             => $newSessionId,
            'status'         => 'pending',
            'scheduled_date' => $slot['slot_date'],
            'scheduled_time' => $slot['start_time'],
        ],
    ], 201);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while booking session.';
    error_log('[book_session] ' . $logMessage);
    send_error('Something went wrong while booking this session.', [], 500);
}

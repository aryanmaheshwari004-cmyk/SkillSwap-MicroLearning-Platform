<?php
/**
 * Skill Swap - Check Availability
 * GET endpoint. Query param: slot_id.
 * Verifies a specific availability slot still exists, is in the
 * future, and is not already booked. Used by book-session.html
 * immediately before submitting a booking request, to give the
 * user fast feedback if someone else booked the slot first.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/response.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

require_http_method('GET');

$slotId = isset($_GET['slot_id']) ? (int) $_GET['slot_id'] : 0;

if ($slotId <= 0) {
    send_error('A valid slot id is required.', [], 422);
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare(
        'SELECT id, mentor_id, slot_date, start_time, end_time, is_booked
         FROM availability_slots
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $slotId]);
    $slot = $stmt->fetch();

    if ($slot === false) {
        send_success('Slot not found.', ['available' => false, 'reason' => 'not_found'], 200);
    }

    $isPast = strtotime($slot['slot_date'] . ' ' . $slot['start_time']) < time();

    if ((bool) $slot['is_booked']) {
        send_success('Slot already booked.', ['available' => false, 'reason' => 'already_booked'], 200);
    }

    if ($isPast) {
        send_success('Slot is in the past.', ['available' => false, 'reason' => 'expired'], 200);
    }

    send_success('Slot is available.', [
        'available' => true,
        'slot' => [
            'id'         => (int) $slot['id'],
            'mentor_id'  => (int) $slot['mentor_id'],
            'slot_date'  => $slot['slot_date'],
            'start_time' => $slot['start_time'],
            'end_time'   => $slot['end_time'],
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while checking availability.';
    error_log('[check_availability] ' . $logMessage);
    send_error('Something went wrong while checking this slot.', [], 500);
}

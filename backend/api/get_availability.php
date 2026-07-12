<?php
/**
 * Skill Swap - Get Availability
 * GET endpoint. Query param: mentor_id (optional; defaults to current user).
 * Returns all upcoming availability slots for a mentor, both booked
 * and open, ordered chronologically. Used by availability.html to
 * manage one's own slots.
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

$currentUserId = require_authentication();

$mentorId = isset($_GET['mentor_id']) && $_GET['mentor_id'] !== ''
    ? (int) $_GET['mentor_id']
    : $currentUserId;

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare(
        'SELECT id, slot_date, start_time, end_time, is_booked, created_at
         FROM availability_slots
         WHERE mentor_id = :mentor_id AND slot_date >= CURDATE()
         ORDER BY slot_date ASC, start_time ASC'
    );
    $stmt->execute(['mentor_id' => $mentorId]);
    $slots = $stmt->fetchAll();

    foreach ($slots as &$slot) {
        $slot['is_booked'] = (bool) $slot['is_booked'];
    }

    send_success('Availability loaded.', [
        'mentor_id' => $mentorId,
        'is_own'    => $mentorId === $currentUserId,
        'slots'     => $slots,
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching availability.';
    error_log('[get_availability] ' . $logMessage);
    send_error('Something went wrong while loading availability.', [], 500);
}

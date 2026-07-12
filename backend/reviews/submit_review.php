<?php
/**
 * Skill Swap - Submit Review
 * POST endpoint. Requires authentication.
 * JSON body: { session_id, rating, comment }
 * Validates that:
 *   - the session exists and the current user is a participant
 *   - the session status is "completed"
 *   - the current user has not already reviewed this session
 * Inserts the review with reviewee_id derived from the session
 * (the other participant), not from client input.
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

$reviewerId = require_authentication();
$input = get_json_request_body();

$sessionId = isset($input['session_id']) ? (int) $input['session_id'] : 0;
$rating    = isset($input['rating']) ? (int) $input['rating'] : 0;
$comment   = isset($input['comment']) ? trim((string) $input['comment']) : '';

$errors = [];
if ($sessionId <= 0) {
    $errors['session_id'] = 'A valid session id is required.';
}
if ($rating < 1 || $rating > 5) {
    $errors['rating'] = 'Rating must be between 1 and 5.';
}
if (mb_strlen($comment) > 1000) {
    $errors['comment'] = 'Comment must be 1000 characters or fewer.';
}
if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

try {
    $pdo = Database::getConnection();
    $pdo->beginTransaction();

    $sessionStmt = $pdo->prepare(
        'SELECT id, learner_id, mentor_id, status FROM sessions WHERE id = :id FOR UPDATE'
    );
    $sessionStmt->execute(['id' => $sessionId]);
    $session = $sessionStmt->fetch();

    if ($session === false) {
        $pdo->rollBack();
        send_error('This session was not found.', [], 404);
    }

    $learnerId = (int) $session['learner_id'];
    $mentorId = (int) $session['mentor_id'];
    $isParticipant = $reviewerId === $learnerId || $reviewerId === $mentorId;

    if (!$isParticipant) {
        $pdo->rollBack();
        send_error('You were not a participant in this session.', [], 403);
    }

    if ($session['status'] !== 'completed') {
        $pdo->rollBack();
        send_error('Only completed sessions can be reviewed.', [], 409);
    }

    // The reviewee is always "the other participant" — never trust a
    // client-supplied reviewee id, derive it server-side.
    $revieweeId = $reviewerId === $learnerId ? $mentorId : $learnerId;

    // Enforce one review per session per reviewer (also backed by the
    // uq_review_per_session_per_reviewer unique constraint in the DB).
    $dupeCheck = $pdo->prepare(
        'SELECT id FROM reviews WHERE session_id = :session_id AND reviewer_id = :reviewer_id LIMIT 1'
    );
    $dupeCheck->execute(['session_id' => $sessionId, 'reviewer_id' => $reviewerId]);

    if ($dupeCheck->fetch() !== false) {
        $pdo->rollBack();
        send_error('You have already reviewed this session.', [], 409);
    }

    $insertStmt = $pdo->prepare(
        'INSERT INTO reviews (session_id, reviewer_id, reviewee_id, rating, comment, created_at)
         VALUES (:session_id, :reviewer_id, :reviewee_id, :rating, :comment, NOW())'
    );
    $insertStmt->execute([
        'session_id'  => $sessionId,
        'reviewer_id' => $reviewerId,
        'reviewee_id' => $revieweeId,
        'rating'      => $rating,
        'comment'     => $comment !== '' ? $comment : null,
    ]);

    $newReviewId = (int) $pdo->lastInsertId();

    $pdo->commit();

    send_success('Review submitted. Thank you!', [
        'review' => [
            'id' => $newReviewId, 'session_id' => $sessionId,
            'reviewee_id' => $revieweeId, 'rating' => $rating, 'comment' => $comment,
        ],
    ], 201);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // A race condition could still trip the DB's unique constraint
    // even after our own check above — handle that gracefully.
    if ((int) $e->getCode() === 23000) {
        send_error('You have already reviewed this session.', [], 409);
    }

    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while submitting review.';
    error_log('[submit_review] ' . $logMessage);
    send_error('Something went wrong while submitting your review.', [], 500);
}

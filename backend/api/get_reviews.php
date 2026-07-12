<?php
/**
 * Skill Swap - Get Reviews
 * GET endpoint. Query param: user_id.
 * Returns all public reviews received by a user, plus the
 * average rating and total count. Also accepts an optional
 * session_id to check review eligibility for that specific session
 * (used by reviews.html before showing the submission form).
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

$userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
$sessionId = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;

if ($userId <= 0) {
    send_error('A valid user id is required.', [], 422);
}

try {
    $pdo = Database::getConnection();

    // Confirm the user exists.
    $userCheck = $pdo->prepare('SELECT id, name, profile_photo FROM users WHERE id = :id LIMIT 1');
    $userCheck->execute(['id' => $userId]);
    $user = $userCheck->fetch();

    if ($user === false) {
        send_error('This user was not found.', [], 404);
    }

    // Rating summary.
    $summaryStmt = $pdo->prepare(
        'SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
         FROM reviews WHERE reviewee_id = :user_id'
    );
    $summaryStmt->execute(['user_id' => $userId]);
    $summary = $summaryStmt->fetch();

    // Breakdown by star count (5 down to 1), for a ratings distribution bar.
    $breakdownStmt = $pdo->prepare(
        'SELECT rating, COUNT(*) AS count FROM reviews WHERE reviewee_id = :user_id GROUP BY rating'
    );
    $breakdownStmt->execute(['user_id' => $userId]);
    $breakdownRows = $breakdownStmt->fetchAll();

    $breakdown = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
    foreach ($breakdownRows as $row) {
        $breakdown[(int) $row['rating']] = (int) $row['count'];
    }

    // Full review list, most recent first.
    $reviewsStmt = $pdo->prepare(
        'SELECT r.id, r.rating, r.comment, r.created_at,
                reviewer.id AS reviewer_id, reviewer.name AS reviewer_name,
                reviewer.profile_photo AS reviewer_photo
         FROM reviews r
         INNER JOIN users reviewer ON reviewer.id = r.reviewer_id
         WHERE r.reviewee_id = :user_id
         ORDER BY r.created_at DESC'
    );
    $reviewsStmt->execute(['user_id' => $userId]);
    $reviews = $reviewsStmt->fetchAll();

    $response = [
        'user' => [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'profile_photo' => $user['profile_photo'],
        ],
        'average_rating' => $summary['avg_rating'] !== null ? round((float) $summary['avg_rating'], 1) : null,
        'review_count'   => (int) $summary['review_count'],
        'rating_breakdown' => $breakdown,
        'reviews' => $reviews,
    ];

    // Optional: check whether a specific session is eligible for review
    // by the currently authenticated user (used by reviews.html's form).
    if ($sessionId > 0) {
        $currentUserId = get_current_user_id();
        $response['session_eligibility'] = check_session_eligibility($pdo, $sessionId, $currentUserId, $userId);
    }

    send_success('Reviews loaded.', $response, 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching reviews.';
    error_log('[get_reviews] ' . $logMessage);
    send_error('Something went wrong while loading reviews.', [], 500);
}

/**
 * Determines whether the current user may submit a review for the
 * given session against the given reviewee.
 *
 * @param PDO      $pdo
 * @param int      $sessionId
 * @param int|null $currentUserId
 * @param int      $revieweeId
 * @return array{eligible: bool, reason: string}
 */
function check_session_eligibility(PDO $pdo, int $sessionId, ?int $currentUserId, int $revieweeId): array
{
    if ($currentUserId === null) {
        return ['eligible' => false, 'reason' => 'not_authenticated'];
    }

    $stmt = $pdo->prepare(
        'SELECT learner_id, mentor_id, status FROM sessions WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $sessionId]);
    $session = $stmt->fetch();

    if ($session === false) {
        return ['eligible' => false, 'reason' => 'session_not_found'];
    }

    $isParticipant = (int) $session['learner_id'] === $currentUserId || (int) $session['mentor_id'] === $currentUserId;
    if (!$isParticipant) {
        return ['eligible' => false, 'reason' => 'not_a_participant'];
    }

    if ($session['status'] !== 'completed') {
        return ['eligible' => false, 'reason' => 'session_not_completed'];
    }

    $expectedRevieweeId = (int) $session['learner_id'] === $currentUserId
        ? (int) $session['mentor_id']
        : (int) $session['learner_id'];

    if ($expectedRevieweeId !== $revieweeId) {
        return ['eligible' => false, 'reason' => 'reviewee_mismatch'];
    }

    $reviewCheck = $pdo->prepare(
        'SELECT id FROM reviews WHERE session_id = :session_id AND reviewer_id = :reviewer_id LIMIT 1'
    );
    $reviewCheck->execute(['session_id' => $sessionId, 'reviewer_id' => $currentUserId]);

    if ($reviewCheck->fetch() !== false) {
        return ['eligible' => false, 'reason' => 'already_reviewed'];
    }

    return ['eligible' => true, 'reason' => 'ok'];
}

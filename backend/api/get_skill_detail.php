<?php
/**
 * Skill Swap - Get Skill Detail
 * GET endpoint. Query param: id (skill id).
 * Returns full skill info, mentor profile summary, and recent reviews
 * for the mentor.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/response.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

require_http_method('GET');

$skillId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($skillId <= 0) {
    send_error('A valid skill id is required.', [], 422);
}

try {
    $pdo = Database::getConnection();

    $skillStmt = $pdo->prepare(
        'SELECT so.id, so.skill_name, so.description, so.proficiency, so.created_at,
                c.id AS category_id, c.name AS category_name,
                u.id AS mentor_id, u.name AS mentor_name, u.profile_photo AS mentor_photo,
                u.bio AS mentor_bio, u.experience_level AS mentor_experience
         FROM skills_offered so
         INNER JOIN users u ON u.id = so.user_id
         LEFT JOIN categories c ON c.id = so.category_id
         WHERE so.id = :id AND so.is_active = 1
         LIMIT 1'
    );
    $skillStmt->execute(['id' => $skillId]);
    $skill = $skillStmt->fetch();

    if ($skill === false) {
        send_error('This skill listing was not found.', [], 404);
    }

    $mentorId = (int) $skill['mentor_id'];

    // Mentor's other active skill listings (excluding this one).
    $otherSkillsStmt = $pdo->prepare(
        'SELECT id, skill_name FROM skills_offered
         WHERE user_id = :mentor_id AND id != :skill_id AND is_active = 1
         ORDER BY created_at DESC
         LIMIT 5'
    );
    $otherSkillsStmt->execute(['mentor_id' => $mentorId, 'skill_id' => $skillId]);
    $otherSkills = $otherSkillsStmt->fetchAll();

    // Rating summary for the mentor.
    $ratingStmt = $pdo->prepare(
        'SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
         FROM reviews WHERE reviewee_id = :mentor_id'
    );
    $ratingStmt->execute(['mentor_id' => $mentorId]);
    $ratingSummary = $ratingStmt->fetch();

    // Most recent reviews for the mentor (public).
    $reviewsStmt = $pdo->prepare(
        'SELECT r.rating, r.comment, r.created_at, reviewer.name AS reviewer_name,
                reviewer.profile_photo AS reviewer_photo
         FROM reviews r
         INNER JOIN users reviewer ON reviewer.id = r.reviewer_id
         WHERE r.reviewee_id = :mentor_id
         ORDER BY r.created_at DESC
         LIMIT 5'
    );
    $reviewsStmt->execute(['mentor_id' => $mentorId]);
    $recentReviews = $reviewsStmt->fetchAll();

    // Mentor's open availability slots (not yet booked, in the future).
    $slotsStmt = $pdo->prepare(
        'SELECT id, slot_date, start_time, end_time
         FROM availability_slots
         WHERE mentor_id = :mentor_id AND is_booked = 0 AND slot_date >= CURDATE()
         ORDER BY slot_date ASC, start_time ASC
         LIMIT 10'
    );
    $slotsStmt->execute(['mentor_id' => $mentorId]);
    $availableSlots = $slotsStmt->fetchAll();

    send_success('Skill detail loaded.', [
        'skill' => [
            'id'            => (int) $skill['id'],
            'skill_name'    => $skill['skill_name'],
            'description'   => $skill['description'],
            'proficiency'   => $skill['proficiency'],
            'category_id'   => $skill['category_id'] !== null ? (int) $skill['category_id'] : null,
            'category_name' => $skill['category_name'],
            'created_at'    => $skill['created_at'],
        ],
        'mentor' => [
            'id'               => $mentorId,
            'name'             => $skill['mentor_name'],
            'profile_photo'    => $skill['mentor_photo'],
            'bio'              => $skill['mentor_bio'],
            'experience_level' => $skill['mentor_experience'],
            'average_rating'   => $ratingSummary['avg_rating'] !== null ? round((float) $ratingSummary['avg_rating'], 1) : null,
            'review_count'     => (int) $ratingSummary['review_count'],
            'other_skills'     => $otherSkills,
        ],
        'recent_reviews'  => $recentReviews,
        'available_slots' => $availableSlots,
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching skill detail.';
    error_log('[get_skill_detail] ' . $logMessage);
    send_error('Something went wrong while loading this skill.', [], 500);
}

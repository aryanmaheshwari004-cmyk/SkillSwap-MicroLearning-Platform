<?php
/**
 * Skill Swap - Get My Skills
 * GET endpoint. Requires authentication.
 * Returns the current user's skills_offered and skills_wanted,
 * plus the full categories list (used to populate add/edit forms).
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

    $offeredStmt = $pdo->prepare(
        'SELECT so.id, so.skill_name, so.description, so.proficiency, so.is_active, so.created_at,
                c.id AS category_id, c.name AS category_name
         FROM skills_offered so
         LEFT JOIN categories c ON c.id = so.category_id
         WHERE so.user_id = :user_id
         ORDER BY so.created_at DESC'
    );
    $offeredStmt->execute(['user_id' => $userId]);
    $skillsOffered = $offeredStmt->fetchAll();

    $wantedStmt = $pdo->prepare(
        'SELECT sw.id, sw.skill_name, sw.created_at,
                c.id AS category_id, c.name AS category_name
         FROM skills_wanted sw
         LEFT JOIN categories c ON c.id = sw.category_id
         WHERE sw.user_id = :user_id
         ORDER BY sw.created_at DESC'
    );
    $wantedStmt->execute(['user_id' => $userId]);
    $skillsWanted = $wantedStmt->fetchAll();

    $categoriesStmt = $pdo->query('SELECT id, name FROM categories ORDER BY name ASC');
    $categories = $categoriesStmt->fetchAll();

    send_success('Your skills loaded.', [
        'skills_offered' => $skillsOffered,
        'skills_wanted'  => $skillsWanted,
        'categories'     => $categories,
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while fetching my skills.';
    error_log('[get_my_skills] ' . $logMessage);
    send_error('Something went wrong while loading your skills.', [], 500);
}

<?php
/**
 * Skill Swap - Filter Skills
 * GET endpoint. Query params (all optional): category, experience_level,
 * proficiency, q (keyword), page (default 1).
 * Returns skills_offered matching all provided filters, with mentor info.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/response.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

require_http_method('GET');

$categoryId      = isset($_GET['category']) ? (int) $_GET['category'] : null;
$experienceLevel = isset($_GET['experience_level']) ? trim((string) $_GET['experience_level']) : '';
$proficiency     = isset($_GET['proficiency']) ? trim((string) $_GET['proficiency']) : '';
$keyword         = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$page            = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
$pageSize        = DEFAULT_PAGE_SIZE;
$offset          = ($page - 1) * $pageSize;

$allowedLevels = ['beginner', 'intermediate', 'expert'];

if ($experienceLevel !== '' && !in_array($experienceLevel, $allowedLevels, true)) {
    send_error('Invalid experience level filter.', [], 422);
}
if ($proficiency !== '' && !in_array($proficiency, $allowedLevels, true)) {
    send_error('Invalid proficiency filter.', [], 422);
}

$rating = null;
if (isset($_GET['rating']) && $_GET['rating'] !== '') {
    $rating = (float) $_GET['rating'];
    $allowedRatings = [3.0, 3.5, 4.0, 4.5];
    if (!in_array($rating, $allowedRatings, true)) {
        send_error('Invalid rating filter.', [], 422);
    }
}

$availability = isset($_GET['availability']) && $_GET['availability'] === 'true';

try {
    $pdo = Database::getConnection();

    // Build WHERE clause dynamically based on which filters were supplied.
    $conditions = ['so.is_active = 1'];
    $params = [];

    if ($categoryId !== null && $categoryId > 0) {
        $conditions[] = 'so.category_id = :category_id';
        $params['category_id'] = $categoryId;
    }
    if ($experienceLevel !== '') {
        $conditions[] = 'u.experience_level = :experience_level';
        $params['experience_level'] = $experienceLevel;
    }
    if ($proficiency !== '') {
        $conditions[] = 'so.proficiency = :proficiency';
        $params['proficiency'] = $proficiency;
    }
    if ($keyword !== '') {
        $conditions[] = '(so.skill_name LIKE :kw OR so.description LIKE :kw2)';
        $params['kw'] = '%' . $keyword . '%';
        $params['kw2'] = '%' . $keyword . '%';
    }
    if ($rating !== null) {
        $conditions[] = '(SELECT AVG(r.rating) FROM reviews r WHERE r.reviewee_id = u.id) >= :rating';
        $params['rating'] = $rating;
    }
    if ($availability) {
        $conditions[] = 'EXISTS (
            SELECT 1 FROM availability_slots av
            WHERE av.mentor_id = u.id
              AND av.slot_date >= CURDATE()
              AND av.is_booked = 0
        )';
    }

    $whereClause = implode(' AND ', $conditions);

    $countSql = "SELECT COUNT(*) FROM skills_offered so
                 INNER JOIN users u ON u.id = so.user_id
                 WHERE $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalResults = (int) $countStmt->fetchColumn();

    $dataSql = "SELECT so.id, so.skill_name, so.description, so.proficiency, so.created_at,
                       c.id AS category_id, c.name AS category_name,
                       u.id AS mentor_id, u.name AS mentor_name, u.profile_photo AS mentor_photo,
                       u.experience_level AS mentor_experience,
                       (SELECT AVG(r.rating) FROM reviews r WHERE r.reviewee_id = u.id) AS mentor_rating,
                       (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = u.id) AS mentor_review_count
                FROM skills_offered so
                INNER JOIN users u ON u.id = so.user_id
                LEFT JOIN categories c ON c.id = so.category_id
                WHERE $whereClause
                ORDER BY so.created_at DESC
                LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($dataSql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue('limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $results = $stmt->fetchAll();

    foreach ($results as &$row) {
        $row['mentor_rating'] = $row['mentor_rating'] !== null ? round((float) $row['mentor_rating'], 1) : null;
        $row['mentor_review_count'] = (int) $row['mentor_review_count'];
    }

    send_success('Filter applied.', [
        'results' => $results,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total_results' => $totalResults,
            'total_pages' => (int) ceil($totalResults / $pageSize),
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during skill filtering.';
    error_log('[filter_skills] ' . $logMessage);
    send_error('Something went wrong while filtering skills.', [], 500);
}

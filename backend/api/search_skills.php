<?php
/**
 * Skill Swap - Search Skills
 * GET endpoint. Query params: q (keyword), page (default 1).
 * Searches skills_offered by skill_name/description, returns mentor info.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/response.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

require_http_method('GET');

$keyword = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
$pageSize = DEFAULT_PAGE_SIZE;
$offset = ($page - 1) * $pageSize;

if ($keyword === '') {
    send_error('Please provide a search keyword.', ['q' => 'Search keyword is required.'], 422);
}

try {
    $pdo = Database::getConnection();
    $likeTerm = '%' . $keyword . '%';

    $countStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM skills_offered so
         WHERE so.is_active = 1 AND (so.skill_name LIKE :kw1 OR so.description LIKE :kw2)'
    );
    $countStmt->execute(['kw1' => $likeTerm, 'kw2' => $likeTerm]);
    $totalResults = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT so.id, so.skill_name, so.description, so.proficiency, so.created_at,
                c.name AS category_name,
                u.id AS mentor_id, u.name AS mentor_name, u.profile_photo AS mentor_photo,
                u.experience_level AS mentor_experience,
                (SELECT AVG(r.rating) FROM reviews r WHERE r.reviewee_id = u.id) AS mentor_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = u.id) AS mentor_review_count
         FROM skills_offered so
         INNER JOIN users u ON u.id = so.user_id
         LEFT JOIN categories c ON c.id = so.category_id
         WHERE so.is_active = 1 AND (so.skill_name LIKE :kw1 OR so.description LIKE :kw2)
         ORDER BY so.created_at DESC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue('kw1', $likeTerm, PDO::PARAM_STR);
    $stmt->bindValue('kw2', $likeTerm, PDO::PARAM_STR);
    $stmt->bindValue('limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $results = $stmt->fetchAll();

    foreach ($results as &$row) {
        $row['mentor_rating'] = $row['mentor_rating'] !== null ? round((float) $row['mentor_rating'], 1) : null;
        $row['mentor_review_count'] = (int) $row['mentor_review_count'];
    }

    send_success('Search complete.', [
        'results' => $results,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total_results' => $totalResults,
            'total_pages' => (int) ceil($totalResults / $pageSize),
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during skill search.';
    error_log('[search_skills] ' . $logMessage);
    send_error('Something went wrong while searching skills.', [], 500);
}

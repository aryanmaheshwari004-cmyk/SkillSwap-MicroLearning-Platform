<?php
/**
 * Skill Swap - Add Skill
 * POST endpoint. Requires authentication.
 * JSON body: { type: "offered"|"wanted", skill_name, category_id,
 *              description (offered only), proficiency (offered only) }
 * Inserts a new row into skills_offered or skills_wanted for the
 * current user.
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

$type       = isset($input['type']) ? trim((string) $input['type']) : '';
$skillName  = isset($input['skill_name']) ? trim((string) $input['skill_name']) : '';
$categoryId = isset($input['category_id']) && $input['category_id'] !== '' ? (int) $input['category_id'] : null;
$description = isset($input['description']) ? trim((string) $input['description']) : '';
$proficiency = isset($input['proficiency']) ? trim((string) $input['proficiency']) : 'intermediate';

$errors = [];
$allowedTypes = ['offered', 'wanted'];
$allowedProficiency = ['beginner', 'intermediate', 'expert'];

if (!in_array($type, $allowedTypes, true)) {
    $errors['type'] = 'Skill type must be "offered" or "wanted".';
}

if ($skillName === '') {
    $errors['skill_name'] = 'Skill name is required.';
} elseif (mb_strlen($skillName) > 120) {
    $errors['skill_name'] = 'Skill name must be 120 characters or fewer.';
}

if ($type === 'offered' && !in_array($proficiency, $allowedProficiency, true)) {
    $errors['proficiency'] = 'Please select a valid proficiency level.';
}

if ($type === 'offered' && mb_strlen($description) > 2000) {
    $errors['description'] = 'Description must be 2000 characters or fewer.';
}

if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

try {
    $pdo = Database::getConnection();

    // Validate category exists, if provided.
    if ($categoryId !== null) {
        $catCheck = $pdo->prepare('SELECT id FROM categories WHERE id = :id LIMIT 1');
        $catCheck->execute(['id' => $categoryId]);
        if ($catCheck->fetch() === false) {
            send_error('Selected category does not exist.', ['category_id' => 'Invalid category.'], 422);
        }
    }

    if ($type === 'offered') {
        $stmt = $pdo->prepare(
            'INSERT INTO skills_offered (user_id, category_id, skill_name, description, proficiency, is_active, created_at, updated_at)
             VALUES (:user_id, :category_id, :skill_name, :description, :proficiency, 1, NOW(), NOW())'
        );
        $stmt->execute([
            'user_id'     => $userId,
            'category_id' => $categoryId,
            'skill_name'  => $skillName,
            'description' => $description !== '' ? $description : null,
            'proficiency' => $proficiency,
        ]);
        $newId = (int) $pdo->lastInsertId();

        send_success('Skill added to your offerings.', [
            'skill' => [
                'id' => $newId, 'skill_name' => $skillName, 'description' => $description,
                'proficiency' => $proficiency, 'category_id' => $categoryId,
            ],
        ], 201);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO skills_wanted (user_id, category_id, skill_name, created_at)
             VALUES (:user_id, :category_id, :skill_name, NOW())'
        );
        $stmt->execute([
            'user_id'     => $userId,
            'category_id' => $categoryId,
            'skill_name'  => $skillName,
        ]);
        $newId = (int) $pdo->lastInsertId();

        send_success('Skill added to your wishlist.', [
            'skill' => ['id' => $newId, 'skill_name' => $skillName, 'category_id' => $categoryId],
        ], 201);
    }
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while adding skill.';
    error_log('[add_skill] ' . $logMessage);
    send_error('Something went wrong while adding your skill.', [], 500);
}

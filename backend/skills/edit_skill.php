<?php
/**
 * Skill Swap - Edit Skill
 * POST endpoint. Requires authentication.
 * JSON body: { type: "offered"|"wanted", id, skill_name, category_id,
 *              description (offered only), proficiency (offered only) }
 * Updates an existing skill row, but only if it belongs to the
 * authenticated user.
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

$type        = isset($input['type']) ? trim((string) $input['type']) : '';
$skillId     = isset($input['id']) ? (int) $input['id'] : 0;
$skillName   = isset($input['skill_name']) ? trim((string) $input['skill_name']) : '';
$categoryId  = isset($input['category_id']) && $input['category_id'] !== '' ? (int) $input['category_id'] : null;
$description = isset($input['description']) ? trim((string) $input['description']) : '';
$proficiency = isset($input['proficiency']) ? trim((string) $input['proficiency']) : 'intermediate';

$errors = [];
$allowedTypes = ['offered', 'wanted'];
$allowedProficiency = ['beginner', 'intermediate', 'expert'];

if (!in_array($type, $allowedTypes, true)) {
    $errors['type'] = 'Skill type must be "offered" or "wanted".';
}
if ($skillId <= 0) {
    $errors['id'] = 'A valid skill id is required.';
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

    if ($categoryId !== null) {
        $catCheck = $pdo->prepare('SELECT id FROM categories WHERE id = :id LIMIT 1');
        $catCheck->execute(['id' => $categoryId]);
        if ($catCheck->fetch() === false) {
            send_error('Selected category does not exist.', ['category_id' => 'Invalid category.'], 422);
        }
    }

    $table = $type === 'offered' ? 'skills_offered' : 'skills_wanted';

    // Ownership check: only the skill's creator can edit it.
    $ownerCheck = $pdo->prepare("SELECT user_id FROM $table WHERE id = :id LIMIT 1");
    $ownerCheck->execute(['id' => $skillId]);
    $existingRow = $ownerCheck->fetch();

    if ($existingRow === false) {
        send_error('This skill listing was not found.', [], 404);
    }

    if ((int) $existingRow['user_id'] !== $userId) {
        send_error('You do not have permission to edit this skill.', [], 403);
    }

    if ($type === 'offered') {
        $stmt = $pdo->prepare(
            'UPDATE skills_offered
             SET skill_name = :skill_name, description = :description,
                 proficiency = :proficiency, category_id = :category_id, updated_at = NOW()
             WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            'skill_name'  => $skillName,
            'description' => $description !== '' ? $description : null,
            'proficiency' => $proficiency,
            'category_id' => $categoryId,
            'id'          => $skillId,
            'user_id'     => $userId,
        ]);
    } else {
        $stmt = $pdo->prepare(
            'UPDATE skills_wanted
             SET skill_name = :skill_name, category_id = :category_id
             WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            'skill_name'  => $skillName,
            'category_id' => $categoryId,
            'id'          => $skillId,
            'user_id'     => $userId,
        ]);
    }

    send_success('Skill updated successfully.', [
        'skill' => [
            'id' => $skillId, 'type' => $type, 'skill_name' => $skillName,
            'category_id' => $categoryId, 'description' => $description, 'proficiency' => $proficiency,
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while editing skill.';
    error_log('[edit_skill] ' . $logMessage);
    send_error('Something went wrong while updating your skill.', [], 500);
}

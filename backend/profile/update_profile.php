<?php
/**
 * Skill Swap - Update Profile
 * POST endpoint with two supported actions:
 *
 *   1. action = "update_info"  (JSON body: { action, name, bio, experience_level })
 *      Updates the authenticated user's name, bio, and experience level.
 *
 *   2. action = "upload_photo" (multipart/form-data: action, profile_photo file)
 *      Validates and stores a new profile photo, removing the old file.
 *
 * Requires an authenticated session.
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

// ------------------------------------------------------------------
// Determine which action this request is performing.
// Multipart requests (photo upload) populate $_POST['action'];
// JSON requests populate the decoded body.
// ------------------------------------------------------------------
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isMultipart = stripos($contentType, 'multipart/form-data') !== false;

$action = $isMultipart
    ? ($_POST['action'] ?? '')
    : (get_json_request_body()['action'] ?? '');

if ($action === 'upload_photo') {
    handle_photo_upload($userId);
} elseif ($action === 'update_info') {
    handle_info_update($userId);
} else {
    send_error('Unknown or missing action.', [], 400);
}

// ====================================================================
// Action handlers
// ====================================================================

/**
 * Updates the user's name, bio, and experience level.
 *
 * @param int $userId
 */
function handle_info_update(int $userId): void
{
    $input = get_json_request_body();

    $name            = isset($input['name']) ? trim((string) $input['name']) : '';
    $bio             = isset($input['bio']) ? trim((string) $input['bio']) : '';
    $experienceLevel = isset($input['experience_level']) ? trim((string) $input['experience_level']) : '';

    $errors = [];
    $allowedExperienceLevels = ['beginner', 'intermediate', 'expert'];

    if ($name === '') {
        $errors['name'] = 'Full name is required.';
    } elseif (mb_strlen($name) > 100) {
        $errors['name'] = 'Full name must be 100 characters or fewer.';
    }

    if (mb_strlen($bio) > 500) {
        $errors['bio'] = 'Bio must be 500 characters or fewer.';
    }

    if (!in_array($experienceLevel, $allowedExperienceLevels, true)) {
        $errors['experience_level'] = 'Please select a valid experience level.';
    }

    if (!empty($errors)) {
        send_error('Please correct the errors below.', $errors, 422);
    }

    try {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            'UPDATE users
             SET name = :name, bio = :bio, experience_level = :experience_level, updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'name'             => $name,
            'bio'              => $bio,
            'experience_level' => $experienceLevel,
            'id'               => $userId,
        ]);

        // Keep session display name in sync for navbar/greeting use.
        $_SESSION['user_name'] = $name;

        send_success('Profile updated successfully.', [
            'name'             => $name,
            'bio'              => $bio,
            'experience_level' => $experienceLevel,
        ], 200);
    } catch (PDOException $e) {
        $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while updating profile.';
        error_log('[update_profile:update_info] ' . $logMessage);
        send_error('Something went wrong while saving your profile.', [], 500);
    }
}

/**
 * Validates and stores an uploaded profile photo, replacing any
 * previous photo file on disk.
 *
 * @param int $userId
 */
function handle_photo_upload(int $userId): void
{
    if (!isset($_FILES['profile_photo']) || $_FILES['profile_photo']['error'] === UPLOAD_ERR_NO_FILE) {
        send_error('No photo file was provided.', [], 400);
    }

    $file = $_FILES['profile_photo'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        send_error('There was a problem uploading your photo. Please try again.', [], 400);
    }

    if ($file['size'] > MAX_UPLOAD_SIZE_BYTES) {
        send_error('Image must be smaller than 2MB.', [], 422);
    }

    // Verify the actual file content is an image (not just the extension/MIME header,
    // which can be spoofed by the client).
    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        send_error('The uploaded file is not a valid image.', [], 422);
    }

    $detectedMime = $imageInfo['mime'];
    if (!in_array($detectedMime, ALLOWED_IMAGE_TYPES, true)) {
        send_error('Please upload a JPEG, PNG, or WebP image.', [], 422);
    }

    $extensionMap = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];
    $extension = $extensionMap[$detectedMime] ?? 'jpg';

    try {
        $pdo = Database::getConnection();

        // Fetch existing photo path so it can be cleaned up after a successful save.
        $existingStmt = $pdo->prepare('SELECT profile_photo FROM users WHERE id = :id LIMIT 1');
        $existingStmt->execute(['id' => $userId]);
        $existingPhoto = $existingStmt->fetchColumn();

        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }

        $newFilename = 'user_' . $userId . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $destinationPath = UPLOAD_DIR . $newFilename;

        if (!move_uploaded_file($file['tmp_name'], $destinationPath)) {
            send_error('Could not save the uploaded photo. Please try again.', [], 500);
        }

        $publicUrl = UPLOAD_URL_PATH . $newFilename;

        $updateStmt = $pdo->prepare(
            'UPDATE users SET profile_photo = :photo, updated_at = NOW() WHERE id = :id'
        );
        $updateStmt->execute([
            'photo' => $publicUrl,
            'id'    => $userId,
        ]);

        // Remove the old photo file now that the new one is confirmed saved,
        // but only if it was a local upload (not an external/default URL).
        if ($existingPhoto && str_starts_with($existingPhoto, UPLOAD_URL_PATH)) {
            $oldFilePath = BASE_PATH . $existingPhoto;
            if (is_file($oldFilePath)) {
                @unlink($oldFilePath);
            }
        }

        send_success('Profile photo updated successfully.', [
            'profile_photo_url' => $publicUrl,
        ], 200);
    } catch (PDOException $e) {
        $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error while uploading photo.';
        error_log('[update_profile:upload_photo] ' . $logMessage);
        send_error('Something went wrong while saving your photo.', [], 500);
    }
}

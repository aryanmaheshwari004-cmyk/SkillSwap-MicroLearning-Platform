<?php
/**
 * Skill Swap - Register Process
 * POST endpoint. Accepts JSON body: { name, email, password, experience_level }
 * Validates input, checks for duplicate email, hashes the password,
 * inserts the new user, and starts an authenticated session.
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

$input = get_json_request_body();

// ------------------------------------------------------------------
// Extract and normalize input
// ------------------------------------------------------------------
$name            = isset($input['name']) ? trim((string) $input['name']) : '';
$email           = isset($input['email']) ? trim((string) $input['email']) : '';
$password        = isset($input['password']) ? (string) $input['password'] : '';
$experienceLevel = isset($input['experience_level']) ? trim((string) $input['experience_level']) : '';

$email = strtolower($email);

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------
$errors = [];
$allowedExperienceLevels = ['beginner', 'intermediate', 'expert'];

if ($name === '') {
    $errors['name'] = 'Full name is required.';
} elseif (mb_strlen($name) > 100) {
    $errors['name'] = 'Full name must be 100 characters or fewer.';
}

if ($email === '') {
    $errors['email'] = 'Email address is required.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please provide a valid email address.';
} elseif (mb_strlen($email) > 150) {
    $errors['email'] = 'Email address is too long.';
}

if ($password === '') {
    $errors['password'] = 'Password is required.';
} elseif (mb_strlen($password) < 8) {
    $errors['password'] = 'Password must be at least 8 characters.';
}

if (!in_array($experienceLevel, $allowedExperienceLevels, true)) {
    $errors['experience_level'] = 'Please select a valid experience level.';
}

if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

// ------------------------------------------------------------------
// Persist user
// ------------------------------------------------------------------
try {
    $pdo = Database::getConnection();

    // Check for an existing account with this email.
    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $checkStmt->execute(['email' => $email]);

    if ($checkStmt->fetch() !== false) {
        send_error(
            'An account with this email already exists.',
            ['email' => 'This email is already registered.'],
            409
        );
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $insertStmt = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, experience_level, created_at, updated_at)
         VALUES (:name, :email, :password_hash, :experience_level, NOW(), NOW())'
    );

    $insertStmt->execute([
        'name'             => $name,
        'email'            => $email,
        'password_hash'    => $passwordHash,
        'experience_level' => $experienceLevel,
    ]);

    $newUserId = (int) $pdo->lastInsertId();

    // ------------------------------------------------------------
    // Start authenticated session
    // ------------------------------------------------------------
    regenerate_session_id();
    $_SESSION['user_id'] = $newUserId;
    $_SESSION['user_name'] = $name;
    $_SESSION['user_email'] = $email;

    send_success('Account created successfully.', [
        'user' => [
            'id'               => $newUserId,
            'name'             => $name,
            'email'            => $email,
            'experience_level' => $experienceLevel,
            'profile_photo'    => null,
        ],
    ], 201);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during registration.';
    error_log('[register_process] ' . $logMessage);
    send_error('Something went wrong while creating your account. Please try again.', [], 500);
}

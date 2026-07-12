<?php
/**
 * Skill Swap - Login Process
 * POST endpoint. Accepts JSON body: { email, password, remember }
 * Verifies credentials against the stored password hash and
 * starts an authenticated session on success.
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
$email    = isset($input['email']) ? trim((string) $input['email']) : '';
$password = isset($input['password']) ? (string) $input['password'] : '';
$remember = isset($input['remember']) && $input['remember'] === true;

$email = strtolower($email);

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------
$errors = [];

if ($email === '') {
    $errors['email'] = 'Email address is required.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please provide a valid email address.';
}

if ($password === '') {
    $errors['password'] = 'Password is required.';
}

if (!empty($errors)) {
    send_error('Please correct the errors below.', $errors, 422);
}

// ------------------------------------------------------------------
// Verify credentials
// ------------------------------------------------------------------
try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare(
        'SELECT id, name, email, password_hash, profile_photo, experience_level, is_active
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    // Generic message for both "no such user" and "wrong password" —
    // never reveal which one failed, to avoid leaking account existence.
    $invalidCredentialsMessage = 'Incorrect email or password.';

    if ($user === false) {
        send_error($invalidCredentialsMessage, [], 401);
    }

    if (!password_verify($password, $user['password_hash'])) {
        send_error($invalidCredentialsMessage, [], 401);
    }

    if ((int) $user['is_active'] !== 1) {
        send_error('This account has been deactivated. Please contact support.', [], 403);
    }

    // ------------------------------------------------------------
    // Start authenticated session
    // ------------------------------------------------------------
    regenerate_session_id();
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];

    // Extend session cookie lifetime if "remember me" was checked.
    if ($remember) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            session_id(),
            [
                'expires'  => time() + (60 * 60 * 24 * 30), // 30 days
                'path'     => $params['path'],
                'domain'   => $params['domain'],
                'secure'   => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'],
            ]
        );
    }

    send_success('Logged in successfully.', [
        'user' => [
            'id'               => (int) $user['id'],
            'name'             => $user['name'],
            'email'            => $user['email'],
            'profile_photo'    => $user['profile_photo'],
            'experience_level' => $user['experience_level'],
        ],
    ], 200);
} catch (PDOException $e) {
    $logMessage = APP_DEBUG ? $e->getMessage() : 'Database error during login.';
    error_log('[login_process] ' . $logMessage);
    send_error('Something went wrong while logging in. Please try again.', [], 500);
}

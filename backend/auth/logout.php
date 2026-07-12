<?php
/**
 * Skill Swap - Logout
 * POST endpoint. Destroys the current session and clears the session cookie.
 * Outputs JSON only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/response.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Credentials: true');

skillswap_start_session();

require_http_method('POST');

// ------------------------------------------------------------------
// Clear all session data
// ------------------------------------------------------------------
$_SESSION = [];

// Remove the session cookie from the browser.
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        [
            'expires'  => time() - 42000,
            'path'     => $params['path'],
            'domain'   => $params['domain'],
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'],
        ]
    );
}

session_destroy();

send_success('Logged out successfully.');

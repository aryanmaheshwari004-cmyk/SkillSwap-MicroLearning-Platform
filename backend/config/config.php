<?php
/**
 * Skill Swap - Application Configuration
 * Holds global constants and session bootstrap settings only.
 * No business logic. No HTML output. No DB connection (see database.php).
 */

declare(strict_types=1);

// ------------------------------------------------------------------
// Environment
// ------------------------------------------------------------------
// Set to false in production to suppress detailed PHP errors from output.
define('APP_DEBUG', true);

define('APP_NAME', 'Skill Swap');
define('APP_TIMEZONE', 'Asia/Kolkata');

date_default_timezone_set(APP_TIMEZONE);

// ------------------------------------------------------------------
// Error reporting
// ------------------------------------------------------------------
if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// ------------------------------------------------------------------
// Filesystem / URL paths
// ------------------------------------------------------------------
// BASE_PATH = absolute filesystem path to project root (one level above /backend)
define('BASE_PATH', dirname(__DIR__, 2));

// Where uploaded profile photos are physically stored.
define('UPLOAD_DIR', BASE_PATH . '/assets/images/uploads/');

// Public-facing relative URL path used when returning photo URLs in JSON.
define('UPLOAD_URL_PATH', 'assets/images/uploads/');

// Allowed profile photo upload constraints.
define('MAX_UPLOAD_SIZE_BYTES', 2 * 1024 * 1024); // 2MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']);

// ------------------------------------------------------------------
// Session configuration
// ------------------------------------------------------------------
// These settings must be applied before session_start() is called anywhere.
define('SESSION_NAME', 'skillswap_session');
define('SESSION_LIFETIME_SECONDS', 60 * 60 * 24 * 7); // 7 days

/**
 * Bootstraps a secure PHP session. Safe to call multiple times;
 * only configures + starts the session once per request.
 */
function skillswap_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name(SESSION_NAME);

    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME_SECONDS,
        'path'     => '/',
        'domain'   => '',
        'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

// ------------------------------------------------------------------
// CORS / JSON API defaults
// ------------------------------------------------------------------
// IMPORTANT: A wildcard origin ('*') cannot be combined with
// Access-Control-Allow-Credentials: true — browsers reject that
// combination outright per the CORS spec. Since every endpoint in
// this app sends credentials (the session cookie), ALLOWED_ORIGIN
// must resolve to a specific origin on every request, never '*'.
//
// In local development, the frontend and backend are normally served
// from the same origin, so this list mainly matters if you split them
// across different ports/domains (e.g. a live-server frontend on
// :5500 talking to a PHP backend on :8000). Add any origin you serve
// the frontend from here.
define('CORS_ALLOWED_ORIGINS', [
    'http://localhost',
    'http://localhost:8000',
    'http://127.0.0.1',
    'http://127.0.0.1:8000',
]);

/**
 * Resolves the correct Access-Control-Allow-Origin value for the
 * current request. Reflects the request's Origin header back only if
 * it appears in CORS_ALLOWED_ORIGINS (the standard, credential-safe
 * pattern), and otherwise falls back to the server's own origin so
 * same-origin requests (the default deployment for this app) always
 * keep working without any configuration.
 *
 * @return string
 */
function resolve_allowed_origin(): string
{
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($requestOrigin !== '' && in_array($requestOrigin, CORS_ALLOWED_ORIGINS, true)) {
        return $requestOrigin;
    }

    // No Origin header (same-origin request) or an origin not on the
    // allow-list: reflect the current server's own origin. This keeps
    // same-origin deployments working out of the box.
    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    return $scheme . '://' . $host;
}

// Backwards-compatible constant name used throughout backend/*.php via
// `header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);`. Resolved
// dynamically per-request rather than hardcoded, so every endpoint
// keeps working unmodified while no longer sending an invalid wildcard.
define('ALLOWED_ORIGIN', resolve_allowed_origin());

// ------------------------------------------------------------------
// Pagination defaults
// ------------------------------------------------------------------
define('DEFAULT_PAGE_SIZE', 12);
define('MAX_PAGE_SIZE', 50);

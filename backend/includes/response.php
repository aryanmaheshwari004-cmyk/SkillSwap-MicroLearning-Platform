<?php
/**
 * Skill Swap - JSON Response Helper
 * Standardizes every backend endpoint's HTTP output as JSON.
 * No business logic. No HTML. No database access.
 */

declare(strict_types=1);

/**
 * Sends a JSON response and terminates the script.
 *
 * @param bool   $success    Whether the request succeeded.
 * @param string $message    Human-readable message for the frontend.
 * @param array  $data       Optional payload (e.g. user object, list of items).
 * @param array  $errors     Optional field-level validation errors, e.g. ['email' => '...'].
 * @param int    $httpStatus HTTP status code to send.
 */
function send_json_response(
    bool $success,
    string $message = '',
    array $data = [],
    array $errors = [],
    int $httpStatus = 200
): void {
    if (!headers_sent()) {
        http_response_code($httpStatus);
        header('Content-Type: application/json; charset=utf-8');
    }

    $response = [
        'success' => $success,
        'message' => $message,
    ];

    if (!empty($data)) {
        $response['data'] = $data;
    }

    if (!empty($errors)) {
        $response['errors'] = $errors;
    }

    echo json_encode($response, JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Shortcut for a successful JSON response.
 *
 * @param string $message
 * @param array  $data
 * @param int    $httpStatus
 */
function send_success(string $message = '', array $data = [], int $httpStatus = 200): void
{
    send_json_response(true, $message, $data, [], $httpStatus);
}

/**
 * Shortcut for a failed JSON response.
 *
 * @param string $message
 * @param array  $errors
 * @param int    $httpStatus
 */
function send_error(string $message = '', array $errors = [], int $httpStatus = 400): void
{
    send_json_response(false, $message, [], $errors, $httpStatus);
}

/**
 * Reads and decodes the raw JSON request body into an associative array.
 * Returns an empty array if the body is missing or invalid JSON.
 *
 * @return array
 */
function get_json_request_body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    return is_array($decoded) ? $decoded : [];
}

/**
 * Restricts the current request to a specific HTTP method.
 * Sends a 405 JSON error and exits if the method does not match.
 *
 * @param string $allowedMethod e.g. 'POST', 'GET'
 */
function require_http_method(string $allowedMethod): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $allowedMethod) {
        send_error('Method not allowed.', [], 405);
    }
}

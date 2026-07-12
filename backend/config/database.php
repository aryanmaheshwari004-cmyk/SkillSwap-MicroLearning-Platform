<?php
/**
 * Skill Swap - Database Connection
 * Provides a single shared PDO instance via the Database singleton.
 * No business logic lives here — connection setup only.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

final class Database
{
    private static ?PDO $instance = null;

    // ------------------------------------------------------------
    // Update these to match your local / hosting environment.
    // ------------------------------------------------------------
    private const DB_HOST = '127.0.0.1';
    private const DB_PORT = '3306';
    private const DB_NAME = 'skillswap';
    private const DB_USER = 'root';
    private const DB_PASS = '';
    private const DB_CHARSET = 'utf8mb4';

    private function __construct()
    {
        // Prevent direct instantiation; use Database::getConnection().
    }

    private function __clone()
    {
        // Prevent cloning of the singleton instance.
    }

    /**
     * Returns a shared PDO connection, creating it on first use.
     *
     * @throws PDOException if the connection cannot be established.
     */
    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                self::DB_HOST,
                self::DB_PORT,
                self::DB_NAME,
                self::DB_CHARSET
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, self::DB_USER, self::DB_PASS, $options);
            } catch (PDOException $e) {
                // Re-throw; calling endpoint is responsible for catching
                // this and returning a clean JSON error response.
                throw new PDOException(
                    'Database connection failed: ' . $e->getMessage(),
                    (int) $e->getCode()
                );
            }
        }

        return self::$instance;
    }
}

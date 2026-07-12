<?php
/**
 * Skill Swap - Database Connection (EXAMPLE / TEMPLATE)
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy this file:  cp database.example.php database.php
 * 2. Fill in your real DB credentials below.
 * 3. database.php is gitignored — never commit it with real credentials.
 *
 * This example file is safe to commit to version control.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

final class Database
{
    private static ?PDO $instance = null;

    // ------------------------------------------------------------------
    // Fill in your local or hosting credentials below.
    // ------------------------------------------------------------------
    private const DB_HOST    = 'localhost';        // e.g. '127.0.0.1' or 'localhost'
    private const DB_PORT    = '3306';             // default MySQL port
    private const DB_NAME    = 'skillswap';        // must match the database you created
    private const DB_USER    = 'your_db_username'; // e.g. 'root' for XAMPP local dev
    private const DB_PASS    = 'your_db_password'; // leave empty string '' for XAMPP default
    private const DB_CHARSET = 'utf8mb4';

    private function __construct() {}
    private function __clone() {}

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
                throw new PDOException(
                    'Database connection failed: ' . $e->getMessage(),
                    (int) $e->getCode()
                );
            }
        }

        return self::$instance;
    }
}

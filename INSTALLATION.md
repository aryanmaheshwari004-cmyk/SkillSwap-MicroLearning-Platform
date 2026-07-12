# Installation Guide for SkillSwap

This document provides step‑by‑step instructions to get the SkillSwap web application up and running on a local development environment using XAMPP.

---

## Prerequisites

1. **XAMPP** (Apache, MySQL, PHP) installed on your machine. You can download it from [https://www.apachefriends.org/index.html](https://www.apachefriends.org/index.html).
2. **Git** (optional, for cloning the repository).
3. A **MySQL client** (e.g., phpMyAdmin, MySQL Workbench, or the command‑line client).
4. A modern web browser.

---

## 1. Copy the Source Files
Extract the zip file or clone the project files directly to your local XAMPP web server directory:
`c:/xampp/htdocs/SkillSwap`

---

## 2. Configure Database Connection Constants
1. Locate the database config example file in [backend/config/database.example.php](backend/config/database.example.php).
2. Copy or rename this file to `backend/config/database.php` in the same directory:
   ```bash
   # Windows PowerShell or Command Prompt copy command
   copy backend/config/database.example.php backend/config/database.php
   ```
3. Open `backend/config/database.php` and verify the credentials. By default, it connects to a standard XAMPP database configuration:
   - Host: `127.0.0.1`
   - Port: `3306`
   - Database name: `skillswap`
   - Username: `root`
   - Password: `""` (blank)

---

## 3. Database Schema Import
1. Open **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Navigate to **phpMyAdmin** in your browser: `http://localhost/phpmyadmin`.
3. Create a new database named **`skillswap`** (ensure UTF-8 collation is selected, e.g., `utf8mb4_unicode_ci`).
4. Select the newly created `skillswap` database, click the **Import** tab:
   - Choose the file **`database/skillswap.sql`** from the project files.
   - Click **Import** (or **Go**).
5. The schema and initial seed categories table are now populated.

---

## 4. Run the Application
Open your browser and navigate to:
- **`http://localhost/SkillSwap`**

You should see the SkillSwap landing page. You can now register a new account, configure your profile, set time slots on the availability page, and explore the skill marketplace.

---

## 5. Troubleshooting
- **Database connection failure** – ensure MySQL is running in XAMPP, that the database name matches `skillswap` exactly, and that your `backend/config/database.php` constants match.
- **Port Conflicts** – if Apache fails to start, verify that no other software is using port 80 (e.g. Skype, IIS, or system processes). You can change Apache's listening port in XAMPP configuration if necessary.
- **Permissions** – ensure the upload folder directory `assets/images/uploads/` is writable by Apache so that user avatars can be uploaded successfully.

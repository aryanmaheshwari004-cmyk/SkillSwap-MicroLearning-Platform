-- ============================================================
-- Skill Swap - Database Schema
-- Engine: MySQL 8+ / MariaDB 10.4+
-- Charset: utf8mb4 (full Unicode support, emoji-safe)
-- ============================================================

CREATE DATABASE IF NOT EXISTS skillswap
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE skillswap;

-- ============================================================
-- TABLE: users
-- Core account + profile data
-- ============================================================
CREATE TABLE users (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100)        NOT NULL,
    email               VARCHAR(150)        NOT NULL,
    password_hash       VARCHAR(255)        NOT NULL,
    profile_photo       VARCHAR(255)        NULL DEFAULT NULL,
    bio                 TEXT                NULL,
    experience_level    ENUM('beginner', 'intermediate', 'expert') NOT NULL DEFAULT 'beginner',
    is_active           TINYINT(1)          NOT NULL DEFAULT 1,
    created_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE INDEX idx_users_name ON users (name);

-- ============================================================
-- TABLE: categories
-- Lookup table for skill categories (keeps tagging consistent)
-- ============================================================
CREATE TABLE categories (
    id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(80) NOT NULL,

    CONSTRAINT uq_categories_name UNIQUE (name)
) ENGINE=InnoDB;

INSERT INTO categories (name) VALUES
    ('Programming & Development'),
    ('Design & Creative'),
    ('Business & Marketing'),
    ('Languages'),
    ('Music & Arts'),
    ('Data & Analytics'),
    ('Writing & Content'),
    ('Personal Development'),
    ('Other');

-- ============================================================
-- TABLE: skills_offered
-- Skills a user can teach/mentor others in
-- ============================================================
CREATE TABLE skills_offered (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED        NOT NULL,
    category_id     INT UNSIGNED        NULL,
    skill_name      VARCHAR(120)        NOT NULL,
    description     TEXT                NULL,
    proficiency     ENUM('beginner', 'intermediate', 'expert') NOT NULL DEFAULT 'intermediate',
    is_active       TINYINT(1)          NOT NULL DEFAULT 1,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_skills_offered_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_skills_offered_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_skills_offered_user ON skills_offered (user_id);
CREATE INDEX idx_skills_offered_category ON skills_offered (category_id);
CREATE INDEX idx_skills_offered_name ON skills_offered (skill_name);

-- ============================================================
-- TABLE: skills_wanted
-- Skills a user wants to learn (used for matching/discovery)
-- ============================================================
CREATE TABLE skills_wanted (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED        NOT NULL,
    category_id     INT UNSIGNED        NULL,
    skill_name      VARCHAR(120)        NOT NULL,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_skills_wanted_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_skills_wanted_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_skills_wanted_user ON skills_wanted (user_id);
CREATE INDEX idx_skills_wanted_name ON skills_wanted (skill_name);

-- ============================================================
-- TABLE: availability_slots
-- Time slots a mentor opens up for booking
-- ============================================================
CREATE TABLE availability_slots (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mentor_id       INT UNSIGNED        NOT NULL,
    slot_date       DATE                NOT NULL,
    start_time      TIME                NOT NULL,
    end_time        TIME                NOT NULL,
    is_booked       TINYINT(1)          NOT NULL DEFAULT 0,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_availability_mentor
        FOREIGN KEY (mentor_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_slot_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

CREATE INDEX idx_availability_mentor ON availability_slots (mentor_id);
CREATE INDEX idx_availability_date ON availability_slots (slot_date);
CREATE INDEX idx_availability_booked ON availability_slots (is_booked);

-- ============================================================
-- TABLE: sessions
-- A booked mentoring session between learner and mentor
-- ============================================================
CREATE TABLE sessions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    learner_id      INT UNSIGNED        NOT NULL,
    mentor_id       INT UNSIGNED        NOT NULL,
    skill_id        INT UNSIGNED        NOT NULL,
    slot_id         INT UNSIGNED        NOT NULL,
    status          ENUM('pending', 'accepted', 'rejected', 'completed', 'cancelled')
                                        NOT NULL DEFAULT 'pending',
    scheduled_date  DATE                NOT NULL,
    scheduled_time  TIME                NOT NULL,
    notes           TEXT                NULL,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sessions_learner
        FOREIGN KEY (learner_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_mentor
        FOREIGN KEY (mentor_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_skill
        FOREIGN KEY (skill_id) REFERENCES skills_offered(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_slot
        FOREIGN KEY (slot_id) REFERENCES availability_slots(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_session_parties CHECK (learner_id <> mentor_id)
) ENGINE=InnoDB;

CREATE INDEX idx_sessions_learner ON sessions (learner_id);
CREATE INDEX idx_sessions_mentor ON sessions (mentor_id);
CREATE INDEX idx_sessions_status ON sessions (status);
CREATE INDEX idx_sessions_date ON sessions (scheduled_date);

-- ============================================================
-- TABLE: reviews
-- Post-session star rating + written review
-- ============================================================
CREATE TABLE reviews (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id      INT UNSIGNED        NOT NULL,
    reviewer_id     INT UNSIGNED        NOT NULL,
    reviewee_id     INT UNSIGNED        NOT NULL,
    rating          TINYINT UNSIGNED    NOT NULL,
    comment         TEXT                NULL,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reviews_session
        FOREIGN KEY (session_id) REFERENCES sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewee
        FOREIGN KEY (reviewee_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_review_per_session_per_reviewer UNIQUE (session_id, reviewer_id),
    CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id);
CREATE INDEX idx_reviews_session ON reviews (session_id);

-- ============================================================
-- End of schema
-- ============================================================

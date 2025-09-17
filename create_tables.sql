-- Select the correct database
USE gp_playoffs_db;

-- Drop tables in the correct order to avoid foreign key constraints
-- (Tables that are referenced by others must be dropped after the tables that reference them)
DROP TABLE IF EXISTS gp_playoffs_competitor_tournament_state;
DROP TABLE IF EXISTS gp_playoffs_event_competitors;
DROP TABLE IF EXISTS gp_playoffs_competitors;
DROP TABLE IF EXISTS gp_playoffs_puzzles;
DROP TABLE IF EXISTS gp_playoffs_tournaments;
DROP TABLE IF EXISTS gp_playoffs_events;
DROP TABLE IF EXISTS gp_playoffs_competitors_roster;

-- Create tables in the correct order to establish foreign key constraints
-- (Tables that are referenced by others must be created before the tables that reference them)

-- NEW: Create the events table first
CREATE TABLE gp_playoffs_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate the competitors_roster table
CREATE TABLE gp_playoffs_competitors_roster (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255)
);

-- Recreate the tournaments table (with event_id and renamed puzzle_ids)
CREATE TABLE `gp_playoffs_tournaments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` INT NULL,
  `name` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `start_time` datetime DEFAULT NULL,
  `is_paused` tinyint(1) NOT NULL DEFAULT 1,
  `total_paused_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  `last_pause_time` datetime DEFAULT NULL,
  `puzzle_ids` json DEFAULT NULL,
  `puzzles_count` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`event_id`) REFERENCES `gp_playoffs_events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW: Create the puzzles table
CREATE TABLE gp_playoffs_puzzles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    event_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES gp_playoffs_events(id) ON DELETE CASCADE
);

-- Recreate the competitors table
CREATE TABLE gp_playoffs_competitors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    roster_id INT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NULL,
    handicap_seconds INT NOT NULL,
    position INT NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES gp_playoffs_tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (roster_id) REFERENCES gp_playoffs_competitors_roster(id) ON DELETE SET NULL
);

CREATE TABLE gp_playoffs_event_competitors (
    event_id INT NOT NULL,
    roster_id INT NOT NULL,
    PRIMARY KEY (event_id, roster_id),
    FOREIGN KEY (event_id) REFERENCES gp_playoffs_events(id) ON DELETE CASCADE,
    FOREIGN KEY (roster_id) REFERENCES gp_playoffs_competitors_roster(id) ON DELETE CASCADE
);

-- Recreate the competitor_tournament_state table
CREATE TABLE gp_playoffs_competitor_tournament_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    competitor_id INT NOT NULL UNIQUE,
    current_puzzle INT DEFAULT 0,
    status ENUM('waiting', 'solving', 'judging', 'finished', 'pending_penalty') DEFAULT 'waiting',
    status_text VARCHAR(255) DEFAULT '',
    start_time_stamp TIMESTAMP NULL,
    finish_time_stamp TIMESTAMP NULL,
    puzzle_times JSON,
    incorrect_answers JSON,
    submission_times JSON,
    incorrect_judgment_times JSON,
    FOREIGN KEY (competitor_id) REFERENCES gp_playoffs_competitors(id) ON DELETE CASCADE
);
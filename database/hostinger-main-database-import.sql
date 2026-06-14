-- Hostinger main website database import.
-- Import this file into database: u414000991_loyoladatabase

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  recovery_email VARCHAR(190) NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'student',
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user_id (user_id),
  KEY idx_password_reset_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(60) NOT NULL,
  app_key VARCHAR(100) NOT NULL,
  can_view TINYINT(1) DEFAULT 1,
  can_create TINYINT(1) DEFAULT 0,
  can_edit TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY role_app_unique (role, app_key)
);

CREATE TABLE IF NOT EXISTS site_database (
  id VARCHAR(50) PRIMARY KEY,
  content LONGTEXT NOT NULL,
  content_version BIGINT NOT NULL DEFAULT 0,
  published_at VARCHAR(40) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requested_by VARCHAR(64) NULL,
  requested_by_email VARCHAR(190),
  requested_by_name VARCHAR(150),
  request_type VARCHAR(100) DEFAULT 'website_update',
  title VARCHAR(255) NOT NULL DEFAULT 'Website update approval',
  description TEXT,
  data LONGTEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  submitted_by VARCHAR(190),
  submitted_by_role VARCHAR(60),
  review_note TEXT,
  reviewed_by VARCHAR(64),
  reviewed_by_email VARCHAR(190),
  reviewed_by_name VARCHAR(150),
  reviewed_at TIMESTAMP NULL,
  published_by VARCHAR(64),
  published_by_email VARCHAR(190),
  published_by_name VARCHAR(150),
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_publish_requests_status (status),
  KEY idx_publish_requests_requested_by (requested_by)
);

CREATE TABLE IF NOT EXISTS website_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(150) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'published',
  content LONGTEXT,
  content_json LONGTEXT,
  published_json LONGTEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT,
  content_json LONGTEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(190) NOT NULL,
  email VARCHAR(190) UNIQUE,
  phone VARCHAR(80),
  nic VARCHAR(80) UNIQUE,
  photo_url TEXT,
  staff_type VARCHAR(100) DEFAULT 'Academic Staff',
  department VARCHAR(150),
  status VARCHAR(30) DEFAULT 'Active',
  account_user_id VARCHAR(64),
  edutrack_sync_status VARCHAR(30) DEFAULT 'not_synced',
  edutrack_sync_error TEXT,
  edutrack_teacher_id VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_profile_id INT NOT NULL,
  department VARCHAR(150),
  position VARCHAR(190) NOT NULL,
  website_place VARCHAR(150),
  subject VARCHAR(150),
  classes VARCHAR(190),
  is_primary TINYINT(1) DEFAULT 0,
  display_order INT DEFAULT 0,
  visible_on_website TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_sync_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_profile_id INT,
  target_system VARCHAR(50) NOT NULL DEFAULT 'edutrack',
  payload LONGTEXT,
  status VARCHAR(30) DEFAULT 'pending',
  error TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  category VARCHAR(100),
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  priority VARCHAR(50) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  poster_url TEXT,
  event_date DATE,
  venue VARCHAR(255),
  status VARCHAR(30) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  image_url TEXT,
  category VARCHAR(100),
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE,
  original_url TEXT,
  optimized_url TEXT,
  thumbnail_url TEXT,
  file_name VARCHAR(255),
  original_name VARCHAR(255),
  file_url TEXT,
  webm_url TEXT,
  file_type VARCHAR(100),
  file_size BIGINT,
  duration_seconds DECIMAL(8,2),
  folder VARCHAR(120),
  category VARCHAR(100),
  visibility VARCHAR(30) DEFAULT 'public',
  uploaded_by VARCHAR(64),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(64),
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(120),
  target_id VARCHAR(120),
  details LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO role_permissions
  (role, app_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('masteradmin', 'website_admin', 1, 1, 1, 1),
  ('masteradmin', 'eduzync', 1, 1, 1, 1),
  ('masteradmin', 'edutrack', 1, 1, 1, 1),
  ('masteradmin', 'elms', 1, 1, 1, 1),
  ('masteradmin', 'report_cards', 1, 1, 1, 1),
  ('masteradmin', 'users', 1, 1, 1, 1),
  ('superadmin', 'website_admin', 1, 1, 1, 1),
  ('superadmin', 'eduzync', 1, 1, 1, 1),
  ('superadmin', 'edutrack', 1, 1, 1, 1),
  ('superadmin', 'elms', 1, 1, 1, 1),
  ('superadmin', 'report_cards', 1, 1, 1, 1),
  ('superadmin', 'users', 1, 1, 1, 0),
  ('website_admin', 'website_admin', 1, 1, 1, 0),
  ('website_admin', 'media', 1, 1, 1, 0),
  ('website_admin', 'news', 1, 1, 1, 0),
  ('website_admin', 'notices', 1, 1, 1, 0),
  ('website_admin', 'events', 1, 1, 1, 0)
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_create = VALUES(can_create),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete);

INSERT INTO website_pages (slug, title, status, content, content_json, published_json)
VALUES
  ('home', 'Home', 'published', '{}', '{}', '{}'),
  ('about', 'About', 'published', '{}', '{}', '{}'),
  ('academics', 'Academics', 'published', '{}', '{}', '{}'),
  ('events', 'Events', 'published', '{}', '{}', '{}'),
  ('news', 'News', 'published', '{}', '{}', '{}'),
  ('college-staff', 'College Staff', 'published', '{}', '{}', '{}'),
  ('contact', 'Contact', 'published', '{}', '{}', '{}')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  status = VALUES(status);

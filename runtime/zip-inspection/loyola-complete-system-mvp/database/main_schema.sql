CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role VARCHAR(60) NOT NULL DEFAULT 'student',
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(60) NOT NULL,
  app_key VARCHAR(100) NOT NULL,
  can_view TINYINT(1) DEFAULT 1,
  can_create TINYINT(1) DEFAULT 0,
  can_edit TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  UNIQUE KEY role_app_unique (role, app_key)
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

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(100) UNIQUE,
  original_url TEXT,
  optimized_url TEXT,
  thumbnail_url TEXT,
  file_name VARCHAR(255),
  original_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size BIGINT,
  folder VARCHAR(120),
  visibility VARCHAR(30) DEFAULT 'public',
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(150) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft',
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

CREATE TABLE IF NOT EXISTS site_database (
  id VARCHAR(50) PRIMARY KEY,
  content LONGTEXT NOT NULL,
  content_version BIGINT NOT NULL DEFAULT 0,
  published_at VARCHAR(40) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  priority VARCHAR(50) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(64),
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(120),
  target_id VARCHAR(120),
  details LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

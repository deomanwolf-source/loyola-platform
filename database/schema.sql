CREATE DATABASE IF NOT EXISTS loyola_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE loyola_platform;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role ENUM(
    'masteradmin',
    'superadmin',
    'website_admin',
    'eduzync_admin',
    'staff_admin',
    'teacher',
    'student',
    'parent'
  ) NOT NULL DEFAULT 'student',
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  app_key VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT 1,
  can_create BOOLEAN DEFAULT 0,
  can_edit BOOLEAN DEFAULT 0,
  can_delete BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_app (role, app_key)
);

INSERT INTO role_permissions
(role, app_key, can_view, can_create, can_edit, can_delete)
VALUES
('masteradmin', 'website_admin', 1, 1, 1, 1),
('masteradmin', 'eduzync', 1, 1, 1, 1),
('masteradmin', 'edutrack', 1, 1, 1, 1),
('masteradmin', 'elms', 1, 1, 1, 1),
('masteradmin', 'report_cards', 1, 1, 1, 1),
('masteradmin', 'staff', 1, 1, 1, 1),
('masteradmin', 'users', 1, 1, 1, 1),
('superadmin', 'website_admin', 1, 1, 1, 1),
('superadmin', 'eduzync', 1, 1, 1, 1),
('superadmin', 'edutrack', 1, 1, 1, 1),
('superadmin', 'elms', 1, 1, 1, 1),
('superadmin', 'report_cards', 1, 1, 1, 1),
('superadmin', 'staff', 1, 1, 1, 1),
('superadmin', 'users', 1, 1, 1, 0),
('staff_admin', 'staff', 1, 1, 1, 1),
('website_admin', 'website_admin', 1, 1, 1, 0),
('website_admin', 'media', 1, 1, 1, 0),
('website_admin', 'news', 1, 1, 1, 0),
('website_admin', 'notices', 1, 1, 1, 0),
('website_admin', 'events', 1, 1, 1, 0),
('eduzync_admin', 'eduzync', 1, 1, 1, 1),
('eduzync_admin', 'students', 1, 1, 1, 1),
('eduzync_admin', 'teachers', 1, 1, 1, 1),
('eduzync_admin', 'parents', 1, 1, 1, 1),
('eduzync_admin', 'classes', 1, 1, 1, 1),
('eduzync_admin', 'subjects', 1, 1, 1, 1),
('eduzync_admin', 'edutrack', 1, 1, 1, 0),
('eduzync_admin', 'report_cards', 1, 1, 1, 0),
('teacher', 'edutrack', 1, 1, 1, 0),
('teacher', 'elms', 1, 1, 1, 0),
('teacher', 'report_cards', 1, 1, 1, 0),
('teacher', 'students', 1, 0, 0, 0),
('teacher', 'subjects', 1, 0, 0, 0),
('student', 'elms', 1, 0, 0, 0),
('student', 'report_cards', 1, 0, 0, 0),
('student', 'profile', 1, 0, 0, 0),
('student', 'notices', 1, 0, 0, 0),
('parent', 'child_profile', 1, 0, 0, 0),
('parent', 'report_cards', 1, 0, 0, 0),
('parent', 'notices', 1, 0, 0, 0)
ON DUPLICATE KEY UPDATE
can_view = VALUES(can_view),
can_create = VALUES(can_create),
can_edit = VALUES(can_edit),
can_delete = VALUES(can_delete);

CREATE TABLE IF NOT EXISTS site_database (
  id VARCHAR(50) PRIMARY KEY,
  content LONGTEXT NOT NULL,
  content_version BIGINT NOT NULL,
  published_at VARCHAR(40) NOT NULL,
  draft_content LONGTEXT NULL,
  draft_content_version BIGINT NOT NULL DEFAULT 0,
  draft_updated_at VARCHAR(40) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requested_by VARCHAR(50) NOT NULL,
  requested_by_email VARCHAR(190),
  requested_by_name VARCHAR(150),
  request_type VARCHAR(100) DEFAULT 'website_update',
  title VARCHAR(255) NOT NULL DEFAULT 'Website update approval',
  description TEXT,
  data LONGTEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  submitted_by VARCHAR(190),
  submitted_by_role VARCHAR(50),
  review_note TEXT,
  reviewed_by VARCHAR(50),
  reviewed_by_email VARCHAR(190),
  reviewed_by_name VARCHAR(150),
  reviewed_at TIMESTAMP NULL,
  published_by VARCHAR(50),
  published_by_email VARCHAR(190),
  published_by_name VARCHAR(150),
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_publish_requests_status (status),
  KEY idx_publish_requests_requested_by (requested_by)
);

ALTER TABLE publish_requests
  ADD COLUMN IF NOT EXISTS requested_by VARCHAR(50) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS requested_by_email VARCHAR(190) NULL AFTER requested_by,
  ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(150) NULL AFTER requested_by_email,
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(100) DEFAULT 'website_update' AFTER requested_by_name,
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Website update approval' AFTER request_type,
  ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER title,
  ADD COLUMN IF NOT EXISTS data LONGTEXT NULL AFTER description,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending' AFTER data,
  ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(190) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS submitted_by_role VARCHAR(50) NULL AFTER submitted_by,
  ADD COLUMN IF NOT EXISTS review_note TEXT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50) NULL AFTER review_note,
  ADD COLUMN IF NOT EXISTS reviewed_by_email VARCHAR(190) NULL AFTER reviewed_by,
  ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(150) NULL AFTER reviewed_by_email,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL AFTER reviewed_by_name,
  ADD COLUMN IF NOT EXISTS published_by VARCHAR(50) NULL AFTER reviewed_at,
  ADD COLUMN IF NOT EXISTS published_by_email VARCHAR(190) NULL AFTER published_by,
  ADD COLUMN IF NOT EXISTS published_by_name VARCHAR(150) NULL AFTER published_by_email,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL AFTER published_by_name,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER published_at,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

UPDATE publish_requests
SET requested_by = 'legacy'
WHERE requested_by IS NULL OR requested_by = '';

UPDATE publish_requests
SET status = 'pending'
WHERE status IS NULL OR status = '';

CREATE TABLE IF NOT EXISTS website_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(150) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content JSON,
  draft_json LONGTEXT NULL,
  published_json LONGTEXT NULL,
  published_at TIMESTAMP NULL,
  status VARCHAR(30) DEFAULT 'published',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL,
  attendance INT DEFAULT 0,
  guardian VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(50) PRIMARY KEY,
  staff_id VARCHAR(50) NULL,
  slug VARCHAR(180) NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(50) NULL,
  subject VARCHAR(100),
  classes VARCHAR(100),
  status VARCHAR(30) DEFAULT 'Active',
  position VARCHAR(150),
  website_place VARCHAR(120),
  type VARCHAR(100),
  category VARCHAR(100),
  section VARCHAR(100),
  qualifications TEXT,
  responsibilities TEXT,
  bio TEXT NULL,
  image TEXT,
  positions_json LONGTEXT,
  position_codes LONGTEXT,
  sort_order INT NOT NULL DEFAULT 0,
  account_email VARCHAR(190),
  account_user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_teachers_staff_id (staff_id)
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NULL,
  teacher_id VARCHAR(50) NULL,
  full_name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(50) NULL,
  nic VARCHAR(50) NULL,
  staff_type VARCHAR(100) NOT NULL DEFAULT 'Academic Staff',
  department VARCHAR(120) NULL,
  position VARCHAR(150) NULL,
  qualification TEXT NULL,
  bio TEXT NULL,
  joined_date DATE NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Active',
  sort_order INT NOT NULL DEFAULT 0,
  profile_image TEXT NULL,
  photo_url TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_staff_profiles_user_id (user_id),
  KEY idx_staff_profiles_teacher_id (teacher_id),
  KEY idx_staff_profiles_status (status),
  KEY idx_staff_profiles_type (staff_type),
  KEY idx_staff_profiles_slug (slug),
  KEY idx_staff_profiles_sort (sort_order)
);

CREATE TABLE IF NOT EXISTS staff_profile_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NULL,
  file_url TEXT NOT NULL,
  folder VARCHAR(120) NOT NULL,
  media_source_id VARCHAR(50) NULL,
  uploaded_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_profile_photos_staff (staff_id)
);

CREATE TABLE IF NOT EXISTS staff_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  position_master_id INT NULL,
  position_code VARCHAR(180) NOT NULL DEFAULT '',
  display_title VARCHAR(180) NOT NULL DEFAULT '',
  main_category VARCHAR(120) NOT NULL DEFAULT '',
  section VARCHAR(120) NOT NULL DEFAULT '',
  subsection VARCHAR(120) NOT NULL DEFAULT '',
  grade INT NULL,
  stream VARCHAR(80) NOT NULL DEFAULT '',
  medium VARCHAR(80) NOT NULL DEFAULT '',
  class_or_stream VARCHAR(120) NOT NULL DEFAULT '',
  department VARCHAR(120) NOT NULL DEFAULT '',
  position VARCHAR(150) NOT NULL DEFAULT '',
  website_place VARCHAR(120) NOT NULL DEFAULT 'Subject Teachers',
  subject VARCHAR(100) NOT NULL DEFAULT '',
  classes VARCHAR(100) NOT NULL DEFAULT '',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  visible_on_website TINYINT(1) NOT NULL DEFAULT 1,
  is_known TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_staff_positions_staff (staff_id),
  KEY idx_staff_positions_master (position_master_id),
  KEY idx_staff_positions_place (website_place),
  KEY idx_staff_positions_code (position_code),
  KEY idx_staff_positions_category (main_category),
  KEY idx_staff_positions_sort (sort_order)
);

CREATE TABLE IF NOT EXISTS staff_position_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position_title VARCHAR(150) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT '',
  department VARCHAR(120) NOT NULL DEFAULT '',
  website_place VARCHAR(120) NOT NULL DEFAULT 'Subject Teachers',
  description TEXT NULL,
  default_staff_type VARCHAR(100) NOT NULL DEFAULT 'Academic Staff',
  visible_on_website TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'Active',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_staff_position_master (position_title, category, department, website_place)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  check_in TIME NULL,
  check_out TIME NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Present',
  note TEXT NULL,
  marked_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_staff_date (staff_id, date)
);

CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  leave_type VARCHAR(80) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  reviewed_by VARCHAR(50) NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_staff_leave_staff (staff_id),
  KEY idx_staff_leave_status (status)
);

CREATE TABLE IF NOT EXISTS staff_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  document_type VARCHAR(100) NULL,
  uploaded_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_documents_staff (staff_id)
);

CREATE TABLE IF NOT EXISTS staff_notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  audience VARCHAR(100) NOT NULL DEFAULT 'All staff',
  priority VARCHAR(40) NOT NULL DEFAULT 'Normal',
  status VARCHAR(40) NOT NULL DEFAULT 'Published',
  created_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(50) NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(80) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_audit_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS parents (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  children TEXT,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  class_teacher_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  teacher_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  class_id INT NOT NULL,
  academic_year VARCHAR(20),
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  category VARCHAR(100),
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  priority VARCHAR(50) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  poster_url TEXT,
  event_date DATE,
  venue VARCHAR(255),
  status VARCHAR(30) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(50) UNIQUE,
  file_name VARCHAR(255),
  file_url TEXT,
  webm_url TEXT,
  original_url TEXT,
  optimized_url TEXT,
  thumb_url TEXT,
  variant_urls LONGTEXT,
  file_type VARCHAR(100),
  file_size INT,
  original_size INT,
  duration_seconds DECIMAL(8,2),
  folder VARCHAR(100),
  category VARCHAR(100),
  warnings LONGTEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(50) NOT NULL,
  term_name VARCHAR(50) NOT NULL,
  start_date DATE,
  end_date DATE,
  warning_threshold INT DEFAULT 80,
  status VARCHAR(30) DEFAULT 'Not set',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS syllabus_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  grade VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  term_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS syllabus_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(50) NOT NULL,
  subject_id INT NOT NULL,
  syllabus_item_id INT NOT NULL,
  status ENUM('pending','completed') DEFAULT 'pending',
  completed_at TIMESTAMP NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  term VARCHAR(100) NOT NULL,
  academic_year VARCHAR(20),
  grade VARCHAR(50),
  section VARCHAR(50),
  remarks TEXT,
  published TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_card_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_card_id INT NOT NULL,
  subject VARCHAR(150) NOT NULL,
  marks DECIMAL(5,2),
  grade VARCHAR(10),
  teacher_comment TEXT,
  FOREIGN KEY (report_card_id) REFERENCES report_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edutrack_documents (
  collection_name VARCHAR(80) NOT NULL,
  doc_id VARCHAR(120) NOT NULL,
  data LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_name, doc_id)
);

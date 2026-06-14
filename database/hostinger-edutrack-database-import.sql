-- Hostinger EduTrack database import.
-- Import this file into database: u414000991_edutrack

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  external_staff_id VARCHAR(80),
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  recovery_email VARCHAR(190) NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'teacher',
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

CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(64),
  external_staff_id VARCHAR(80),
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190),
  position VARCHAR(150),
  department VARCHAR(150),
  subject VARCHAR(150),
  classes VARCHAR(190),
  photo_url TEXT,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  attendance INT DEFAULT 0,
  guardian VARCHAR(150),
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parents (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  phone VARCHAR(80),
  children TEXT,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  class_teacher_id VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  teacher_id VARCHAR(80),
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(80) NOT NULL,
  class_id INT NOT NULL,
  academic_year VARCHAR(20),
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  teacher_id VARCHAR(80) NOT NULL,
  subject_id INT NOT NULL,
  syllabus_item_id INT NOT NULL,
  status ENUM('pending','completed') DEFAULT 'pending',
  completed_at TIMESTAMP NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS syllabus_daily_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(80),
  teacher_name VARCHAR(190),
  subject_id INT,
  subject_name VARCHAR(150) NOT NULL,
  class_id INT,
  grade VARCHAR(50),
  section VARCHAR(50),
  record_date DATE NOT NULL,
  period_label VARCHAR(80),
  main_topic VARCHAR(255) NOT NULL,
  completed_work TEXT NOT NULL,
  notes TEXT,
  is_done TINYINT(1) DEFAULT 1,
  recorded_by_user_id VARCHAR(64),
  recorded_by_name VARCHAR(190),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(64),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS edutrack_documents (
  collection_name VARCHAR(80) NOT NULL,
  doc_id VARCHAR(120) NOT NULL,
  data LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_name, doc_id)
);

CREATE TABLE IF NOT EXISTS edutrack_relief_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(80),
  teacher_name VARCHAR(190),
  title VARCHAR(255) NOT NULL,
  assignment_date DATE,
  grade VARCHAR(50),
  section VARCHAR(50),
  subject_name VARCHAR(150),
  period_label VARCHAR(80),
  note TEXT,
  pdf_file_path TEXT,
  original_file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending_print',
  uploaded_by_user_id VARCHAR(64),
  uploaded_by_name VARCHAR(190),
  uploaded_by_email VARCHAR(190),
  uploaded_teacher_id VARCHAR(80),
  uploaded_teacher_name VARCHAR(190),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  relief_teacher_id VARCHAR(80),
  relief_teacher_name VARCHAR(190),
  relief_teacher_position VARCHAR(150),
  relief_teacher_subject VARCHAR(150),
  print_count INT DEFAULT 0,
  allowed_extra_prints INT DEFAULT 0,
  printed_by_user_id VARCHAR(64),
  printed_by_name VARCHAR(190),
  printed_by_email VARCHAR(190),
  printed_at TIMESTAMP NULL,
  last_unlocked_by VARCHAR(64),
  last_unlocked_at TIMESTAMP NULL,
  last_unlock_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS edutrack_relief_assignment_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT,
  action VARCHAR(100) NOT NULL,
  actor_user_id VARCHAR(64),
  actor_name VARCHAR(190),
  actor_email VARCHAR(190),
  uploaded_teacher_id VARCHAR(80),
  uploaded_teacher_name VARCHAR(190),
  relief_teacher_id VARCHAR(80),
  relief_teacher_name VARCHAR(190),
  details LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS edutrack_relief_assignment_delete_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT,
  assignment_title VARCHAR(255),
  requested_by VARCHAR(64),
  requested_by_name VARCHAR(190),
  requested_by_email VARCHAR(190),
  request_reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  reviewed_by VARCHAR(64),
  reviewed_by_name VARCHAR(190),
  reviewed_by_email VARCHAR(190),
  review_note TEXT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(80) NOT NULL,
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

INSERT INTO role_permissions
  (role, app_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('masteradmin', 'edutrack', 1, 1, 1, 1),
  ('masteradmin', 'report_cards', 1, 1, 1, 1),
  ('masteradmin', 'users', 1, 1, 1, 1),
  ('superadmin', 'edutrack', 1, 1, 1, 1),
  ('superadmin', 'report_cards', 1, 1, 1, 1),
  ('superadmin', 'users', 1, 1, 1, 0),
  ('eduzync_admin', 'edutrack', 1, 1, 1, 0),
  ('eduzync_admin', 'students', 1, 1, 1, 1),
  ('eduzync_admin', 'teachers', 1, 1, 1, 1),
  ('eduzync_admin', 'parents', 1, 1, 1, 1),
  ('eduzync_admin', 'classes', 1, 1, 1, 1),
  ('eduzync_admin', 'subjects', 1, 1, 1, 1),
  ('teacher', 'edutrack', 1, 1, 1, 0),
  ('teacher', 'syllabus_tracker', 1, 1, 1, 0),
  ('teacher', 'report_cards', 1, 1, 1, 0),
  ('teacher', 'students', 1, 0, 0, 0),
  ('teacher', 'subjects', 1, 0, 0, 0),
  ('student', 'report_cards', 1, 0, 0, 0),
  ('student', 'student_portal', 1, 0, 0, 0),
  ('parent', 'parent_portal', 1, 0, 0, 0),
  ('parent', 'report_cards', 1, 0, 0, 0)
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_create = VALUES(can_create),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete);

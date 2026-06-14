-- Non-destructive migration for vacancy publishing and staff department lookups.
-- Existing staff relationships remain in staff_positions.department.

CREATE TABLE IF NOT EXISTS job_vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NULL,
  deadline DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Open',
  attachment_url TEXT NULL,
  attachment_type VARCHAR(100) NULL,
  application_email VARCHAR(190) NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_job_vacancies_status (status),
  KEY idx_job_vacancies_visible (is_visible),
  KEY idx_job_vacancies_deadline (deadline)
);

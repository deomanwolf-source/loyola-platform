-- Hostinger clean reset for Loyola Platform.
-- Import this into the selected Hostinger database only after exporting a backup.
-- This removes old/testing rows while keeping table structure intact.
-- Website page records and saved page structure are preserved.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL AFTER folder;

DELETE FROM report_card_subjects;
DELETE FROM report_cards;
DELETE FROM syllabus_progress;
DELETE FROM syllabus_items;
DELETE FROM academic_terms;
DELETE FROM edutrack_relief_assignment_audit_logs;
DELETE FROM edutrack_relief_assignments;
DELETE FROM edutrack_documents;
DELETE FROM enrollments;
DELETE FROM subjects;
DELETE FROM classes;
DELETE FROM parents;
DELETE FROM teachers;
DELETE FROM students;
DELETE FROM media_files;
DELETE FROM events;
DELETE FROM notices;
DELETE FROM news;
DELETE FROM publish_requests;
DELETE FROM activity_logs;
DELETE FROM role_permissions;
DELETE FROM users;

ALTER TABLE report_card_subjects AUTO_INCREMENT = 1;
ALTER TABLE report_cards AUTO_INCREMENT = 1;
ALTER TABLE syllabus_progress AUTO_INCREMENT = 1;
ALTER TABLE syllabus_items AUTO_INCREMENT = 1;
ALTER TABLE academic_terms AUTO_INCREMENT = 1;
ALTER TABLE enrollments AUTO_INCREMENT = 1;
ALTER TABLE subjects AUTO_INCREMENT = 1;
ALTER TABLE classes AUTO_INCREMENT = 1;
ALTER TABLE parents AUTO_INCREMENT = 1;
ALTER TABLE teachers AUTO_INCREMENT = 1;
ALTER TABLE students AUTO_INCREMENT = 1;
ALTER TABLE media_files AUTO_INCREMENT = 1;
ALTER TABLE events AUTO_INCREMENT = 1;
ALTER TABLE notices AUTO_INCREMENT = 1;
ALTER TABLE news AUTO_INCREMENT = 1;
ALTER TABLE publish_requests AUTO_INCREMENT = 1;
ALTER TABLE role_permissions AUTO_INCREMENT = 1;

UPDATE site_database
SET content = JSON_SET(
  content,
  '$.students', JSON_ARRAY(),
  '$.teachers', JSON_ARRAY(),
  '$.parents', JSON_ARRAY(),
  '$.classes', JSON_ARRAY(),
  '$.subjects', JSON_ARRAY(),
  '$.fees', JSON_ARRAY(),
  '$.assignments', JSON_ARRAY(),
  '$.events', JSON_ARRAY(),
  '$.news', JSON_ARRAY(),
  '$.gallery', JSON_ARRAY(),
  '$.videoGallery', JSON_ARRAY(),
  '$.downloads', JSON_ARRAY(),
  '$.library', JSON_ARRAY(),
  '$.transport', JSON_ARRAY(),
  '$.admissions', JSON_ARRAY(),
  '$.messages', JSON_ARRAY(),
  '$.auditLogs', JSON_ARRAY(),
  '$.homeSections.stats', JSON_ARRAY(),
  '$.homeSections.pillars', JSON_ARRAY(),
  '$.aboutSections.stats', JSON_ARRAY(),
  '$.academicsSections.departments', JSON_ARRAY(),
  '$.admissionsSteps', JSON_ARRAY(),
  '$.websiteContent.heroImage', '',
  '$.websiteContent.backgroundMediaUrl', '',
  '$.websiteContent.anthemVideoUrl', '',
  '$.websiteContent.anthemVideoCoverImage', '',
  '$.websiteContent.mapUrl', 'https://maps.app.goo.gl/SbvARKozMPQTve388',
  '$.websiteContent.mapEmbedUrl', 'https://www.google.com/maps?q=Loyola%20College%20Negombo%2C%20Sri%20Lanka&output=embed',
  '$.websiteContent.seo.ogImage', '',
  '$.media.campusImage', '',
  '$.media.aboutImage', '',
  '$.media.principalImage', '',
  '$.automation.themeApplied', true
)
WHERE JSON_VALID(content);

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
('parent', 'notices', 1, 0, 0, 0);

-- Create the first master admin after this reset through the setup-admin API.
-- Password hashes are intentionally not stored in this repository script.

SET FOREIGN_KEY_CHECKS = 1;

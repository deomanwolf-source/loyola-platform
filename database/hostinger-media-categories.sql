-- Adds saved media categories to the Hostinger media_files table.
-- Import this in phpMyAdmin if you want existing media rows categorized immediately.

ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL AFTER folder;

UPDATE media_files
SET category = CASE
  WHEN LOWER(folder) LIKE 'pages/%' OR LOWER(folder) = 'page-images' THEN 'Page images'
  WHEN LOWER(folder) LIKE '%news%' THEN 'News photos'
  WHEN LOWER(folder) LIKE '%event%' THEN 'Event photos'
  WHEN LOWER(folder) LIKE '%gallery-videos%' OR LOWER(folder) LIKE '%video-gallery%' THEN 'Video gallery'
  WHEN LOWER(folder) LIKE '%gallery%' THEN 'Gallery photos'
  WHEN LOWER(folder) LIKE '%staff%' THEN 'Staff profiles'
  WHEN LOWER(folder) LIKE '%notice%' OR LOWER(folder) LIKE '%download%' THEN 'Documents'
  WHEN LOWER(folder) LIKE '%site%' THEN 'Site assets'
  WHEN LOWER(file_type) LIKE '%video%' THEN 'Videos'
  WHEN LOWER(file_type) LIKE '%image%' THEN 'Photos'
  WHEN LOWER(file_type) LIKE '%document%' OR LOWER(file_name) LIKE '%.pdf' THEN 'Documents'
  ELSE 'Other media'
END
WHERE category IS NULL OR category = '';

-- Non-destructive migration for staff position master codes.
-- Adds code fields only; existing staff/position records are not deleted or reset.

SET @has_position_code := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_position_master'
    AND COLUMN_NAME = 'position_code'
);
SET @sql := IF(
  @has_position_code = 0,
  'ALTER TABLE staff_position_master ADD COLUMN position_code VARCHAR(180) NOT NULL DEFAULT '''' AFTER position_title',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_short_code := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_position_master'
    AND COLUMN_NAME = 'short_code'
);
SET @sql := IF(
  @has_short_code = 0,
  'ALTER TABLE staff_position_master ADD COLUMN short_code VARCHAR(40) NOT NULL DEFAULT '''' AFTER position_code',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_position_code_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_position_master'
    AND INDEX_NAME = 'idx_staff_position_master_code'
);
SET @sql := IF(
  @has_position_code_index = 0,
  'CREATE INDEX idx_staff_position_master_code ON staff_position_master (position_code)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_short_code_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_position_master'
    AND INDEX_NAME = 'idx_staff_position_master_short_code'
);
SET @sql := IF(
  @has_short_code_index = 0,
  'CREATE INDEX idx_staff_position_master_short_code ON staff_position_master (short_code)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

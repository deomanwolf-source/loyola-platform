USE loyola_platform;

INSERT INTO academic_terms (level, term_name, start_date, end_date, warning_threshold, status)
VALUES
('Upper', 'Term 1', '2026-01-01', '2026-04-30', 80, 'Active'),
('A/L', 'Term 1', '2026-01-01', '2026-04-30', 80, 'Active');

INSERT INTO teachers (id, name, subject, classes, status, position, type, category, section)
VALUES
('T-DEMO-1', 'Mr. Demo Teacher', 'Science', 'Grade 10', 'Active', 'Teacher', 'Academic', 'Academic Staff', 'Upper')
ON DUPLICATE KEY UPDATE name=VALUES(name), subject=VALUES(subject), classes=VALUES(classes);

INSERT INTO subjects (name, grade, section, teacher_id)
VALUES
('Science', '10', 'A', 'T-DEMO-1'),
('Mathematics', '10', 'A', 'T-DEMO-1');

INSERT INTO syllabus_items (subject_id, grade, title, description, term_id)
SELECT s.id, '10', 'Matter and Materials', 'Properties of matter and classroom practicals.', t.id
FROM subjects s JOIN academic_terms t ON t.term_name='Term 1' AND t.level='Upper'
WHERE s.name='Science'
LIMIT 1;

INSERT INTO syllabus_items (subject_id, grade, title, description, term_id)
SELECT s.id, '10', 'Algebra Basics', 'Expressions, formulas, and equations.', t.id
FROM subjects s JOIN academic_terms t ON t.term_name='Term 1' AND t.level='Upper'
WHERE s.name='Mathematics'
LIMIT 1;

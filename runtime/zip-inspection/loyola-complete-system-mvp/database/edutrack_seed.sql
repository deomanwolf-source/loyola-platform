INSERT INTO role_permissions (role, app_key, can_view, can_create, can_edit, can_delete)
VALUES
('masteradmin','all',1,1,1,1),
('superadmin','all',1,1,1,0),
('eduzync_admin','edutrack',1,1,1,0),
('teacher','syllabus_tracker',1,1,1,0),
('student','student_portal',1,0,0,0),
('parent','parent_portal',1,0,0,0)
ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit), can_delete=VALUES(can_delete);

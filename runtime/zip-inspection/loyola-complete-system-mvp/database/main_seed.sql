INSERT INTO role_permissions (role, app_key, can_view, can_create, can_edit, can_delete)
VALUES
('masteradmin','all',1,1,1,1),
('superadmin','all',1,1,1,0),
('website_admin','website_admin',1,1,1,0),
('staff_admin','staff_management',1,1,1,0),
('users_admin','users',1,1,1,0)
ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit), can_delete=VALUES(can_delete);

INSERT INTO website_pages (slug, title, status, content_json, published_json)
VALUES
('home','Home','published','{}','{}'),
('about','About','published','{}','{}'),
('contact','Contact','published','{}','{}'),
('college-staff','College Staff','published','{}','{}')
ON DUPLICATE KEY UPDATE title=VALUES(title);

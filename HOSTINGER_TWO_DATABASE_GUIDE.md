# Hostinger Two Database Setup

This project uses two Hostinger MySQL databases:

- Main website database: `u414000991_loyoladatabase`
- EduTrack database: `u414000991_edutrack`

The EduTrack database remains the authoritative store for all EduTrack records. Opening
`/portal/edutrack` on the main website performs a short-lived signed SSO handoff to the EduTrack
application, so both entry URLs use the existing EduTrack database without copying, resetting, or
deleting data.

EduTrack teacher records are not synchronized from the Loyola website. Import your separate
teacher CSV directly into the EduTrack database and keep the two databases independent.

## 1. Import Main Website Database

In Hostinger phpMyAdmin:

1. Open the main website database.
2. Go to **Import**.
3. Import the current schema:

```txt
database/hostinger-schema.sql
```

4. To restore the saved public homepage/design snapshot, import:

```txt
database/restore-public-site-snapshot.sql
```

Do not import `database/hostinger-clean-reset.sql` unless you intentionally want to reset the
published website content.

## 2. Import EduTrack Database

In Hostinger phpMyAdmin:

1. Open database `u414000991_edutrack`.
2. Go to **Import**.
3. Import:

```txt
database/hostinger-edutrack-database-import.sql
```

## 3. Website Backend Environment

For the `loyolacollege.lk` Node.js app:

```env
NODE_ENV=production
PORT=5000
APP_NAME=website
DB_HOST=localhost
DB_PORT=3306
DB_USER=u414000991_loyoladatabase
DB_PASSWORD=your_main_database_password
DB_NAME=u414000991_loyoladatabase
JWT_SECRET=use_the_same_long_secret_as_edutrack
ALLOWED_ORIGINS=https://loyolacollege.lk,https://www.loyolacollege.lk,https://edutrack.loyolacollege.lk
PUBLIC_API_URL=https://loyolacollege.lk
PASSWORD_RESET_BASE_URL=https://loyolacollege.lk
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_login
SMTP_PASSWORD=your_new_brevo_smtp_key
SMTP_FROM=Loyola College Portal <no-reply@loyolacollege.lk>
EDUTRACK_PUBLIC_URL=https://edutrack.loyolacollege.lk
EDUTRACK_SYNC_SECRET=use_the_same_long_secret_as_edutrack
EDUTRACK_SSO_SECRET=use_the_same_long_secret_as_edutrack
```

The website frontend build also needs:

```env
VITE_EDUTRACK_PUBLIC_URL=https://edutrack.loyolacollege.lk
```

## 4. EduTrack Backend Environment

For the `edutrack.loyolacollege.lk` Node.js app, use the separate app folder:

```txt
edutrack
```

Start command:

```bash
npm start
```

The repository root also has:

```bash
npm run edutrack:start
```

Use this environment:

```env
NODE_ENV=production
PORT=5002
APP_NAME=edutrack
FRONTEND_ROOT=./public
DB_HOST=localhost
DB_PORT=3306
DB_USER=u414000991_edutrack
DB_PASSWORD=your_edutrack_database_password
DB_NAME=u414000991_edutrack
JWT_SECRET=use_the_same_long_secret_as_website
EDUTRACK_SYNC_SECRET=use_the_same_long_secret_as_website
EDUTRACK_SSO_SECRET=use_the_same_long_secret_as_website
ALLOWED_ORIGINS=https://loyolacollege.lk,https://www.loyolacollege.lk,https://edutrack.loyolacollege.lk
PUBLIC_API_URL=https://edutrack.loyolacollege.lk
LOYOLA_PORTAL_PUBLIC_URL=https://loyolacollege.lk
```

Configure the SMTP values on the website app. The sender in `SMTP_FROM` must be verified in Brevo.
Because the SMTP key was visible in a screenshot, revoke it in Brevo and create a new key before
deployment. Never commit the real key to Git.

Use the same `EDUTRACK_SYNC_SECRET` and `EDUTRACK_SSO_SECRET` values on both apps. The website uses
those secrets to launch EduTrack with SSO and to mirror portal account records from **Users &
Roles** into the EduTrack database. EduTrack also uses `LOYOLA_PORTAL_PUBLIC_URL` plus the same sync
secret to mirror EduTrack-created login accounts back into the website portal. This does not copy
teacher profile data from the Loyola website. Teacher records, grades, and class IDs still stay
inside EduTrack and must come from your separate CSV import or direct EduTrack admin entry.

When you add or edit an EduTrack-capable role in **Users & Roles** (`Master Admin`, `Super Admin`,
`EduTrack Admin`, `View Admin`, or `Teacher`), the website app sends that account to the EduTrack
app. If you enter a new password while editing the account, the EduTrack password is updated too.
When you add or reset a teacher login in EduTrack, EduTrack sends that account to the website portal
so the same email and password can sign in at `/login` and be managed in **Users & Roles**.

## 5. Test Backend Connections

Website backend:

```powershell
Invoke-RestMethod -Uri "https://loyolacollege.lk/api/health"
```

Expected:

```json
{
  "status": "ok",
  "database": true,
  "dbName": "u414000991_loyoladatabase"
}
```

EduTrack backend:

```powershell
Invoke-RestMethod -Uri "https://edutrack.loyolacollege.lk/api/health"
```

Expected:

```json
{
  "status": "ok",
  "database": true,
  "dbName": "u414000991_edutrack"
}
```

## 6. Create Master Admin

After the website health check works:

```powershell
Invoke-RestMethod -Uri "https://loyolacollege.lk/api/setup-admin" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Master Admin","email":"deomanwolf@gmail.com","password":"your_new_admin_password"}'
```

Use a new password after deployment. Do not keep shared passwords in screenshots, code, or chat logs.

## 7. Recover EduTrack Master Admin Login

The EduTrack import may already include a master admin row. If direct login at
`https://edutrack.loyolacollege.lk/portal/edutrack` fails, first check the row in the EduTrack
database only:

```sql
SELECT id, name, email, role, status, two_factor_enabled
FROM users
WHERE role IN ('masteradmin', 'superadmin', 'master_edutrack_admin');
```

If the master admin exists but the password is unknown, generate a new bcrypt hash locally:

```powershell
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1],12).then(console.log)" "your_new_password_here"
```

Then update only the EduTrack database in Hostinger phpMyAdmin:

```sql
UPDATE users
SET password_hash = 'paste_generated_bcrypt_hash_here',
    status = 'Active',
    two_factor_enabled = 0,
    two_factor_secret = NULL,
    two_factor_pending_secret = NULL,
    two_factor_confirmed_at = NULL,
    two_factor_last_used_step = NULL
WHERE email = 'deomanwolf@gmail.com'
  AND role = 'masteradmin';
```

Restart the EduTrack Node.js app after the update. This changes only the EduTrack database and does
not touch the Loyola website database.

## 8. Push Updates To GitHub

From the project folder:

```powershell
git status
git add database/hostinger-main-database-import.sql database/hostinger-edutrack-database-import.sql HOSTINGER_TWO_DATABASE_GUIDE.md
git commit -m "Add Hostinger two database imports"
git push origin main
```

## 9. Update Hostinger From GitHub

In Hostinger:

1. Open the website Node.js app.
2. Pull/deploy latest code from GitHub.
3. Run install if Hostinger asks for it:

```bash
npm install
```

4. Restart the website Node.js app.
5. Open the EduTrack Node.js app.
6. Pull/deploy latest code from GitHub and make sure its app root is `edutrack`.
7. Run install if needed.
8. Restart the EduTrack Node.js app.

Then test both `/api/health` URLs again.

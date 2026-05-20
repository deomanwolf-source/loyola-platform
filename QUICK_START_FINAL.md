# Loyola Digital Platform Pro v2 — Fully Working Local + Hostinger Ready

This is the clean combined system in one project:

- Public website
- Admin website editor
- Central portal
- EduTrack native module
- EduZync module shell
- ELMS module shell
- Report card backend APIs
- Node.js + Express backend
- MySQL database
- Local uploads folder
- JWT + bcrypt login security

## 1) Start local services

Open XAMPP and start:

- Apache
- MySQL

## 2) Create fresh database

Open:

```txt
http://localhost/phpmyadmin
```

Go to SQL and run:

```sql
DROP DATABASE IF EXISTS loyola_platform;
CREATE DATABASE loyola_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then select `loyola_platform` and import/run:

```txt
database/schema.sql
```

## 3) Create local env files

Copy:

```txt
.env.example -> .env.local
backend/.env.example -> backend/.env
```

For local backend `.env`:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=loyola_platform
JWT_SECRET=loyola_local_test_secret_change_before_hostinger
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080
PUBLIC_API_URL=http://localhost:5000
```

For frontend `.env.local`:

```env
VITE_API_URL=http://localhost:5000
VITE_ENABLE_FIREBASE_STORAGE=false
```

## 4) Install and run backend

```powershell
cd backend
npm install
npm run dev
```

Test:

```txt
http://localhost:5000/api/health
```

## 5) Install and run frontend

Open a second terminal from the project root:

```powershell
npm install
npm run dev:frontend
```

Open:

```txt
http://127.0.0.1:8080/login
```

## 6) Create first admin user

In PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/setup-admin" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Master Admin","email":"deomanwolf@gmail.com","password":"g0irAbT6@"}'
```

Login with:

```txt
Email: deomanwolf@gmail.com
Password: g0irAbT6@
```

## 7) Test EduTrack

Open portal:

```txt
http://127.0.0.1:8080/portal
```

Click EduTrack.

If no data exists, use the **Create demo EduTrack data** button on the EduTrack Dashboard.

## 8) Important Hostinger production env

Backend:

```env
DB_HOST=your_hostinger_mysql_host
DB_USER=your_hostinger_mysql_user
DB_PASSWORD=your_hostinger_mysql_password
DB_NAME=your_hostinger_database
JWT_SECRET=use_a_long_random_secret
ALLOWED_ORIGINS=https://your-domain.lk,https://www.your-domain.lk
PUBLIC_API_URL=https://api.your-domain.lk
```

Frontend:

```env
VITE_API_URL=https://api.your-domain.lk
```

## What was upgraded in Pro v2

- EduTrack no longer loads as a blank shell.
- EduTrack is now a native portal module with dashboard, terms, syllabus, progress, and warnings.
- EduTrack sends JWT token to protected backend APIs.
- Empty states are visible and professional.
- Admin can create terms, subjects, syllabus items, and demo data.
- Teacher/admin can mark progress.
- Build and lint passed.
- Backend syntax check passed.

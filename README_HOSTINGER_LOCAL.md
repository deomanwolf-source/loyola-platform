# Loyola Digital Platform — Local MySQL + Hostinger Ready

This version is cleaned for a professional Node.js + MySQL deployment. Firebase/Vercel backend routes were removed from the active source path.

## Local development

1. Start XAMPP: Apache and MySQL.
2. Import/create the MySQL database `loyola_platform`.
3. Copy `backend/.env.example` to `backend/.env` and set database values.
4. Copy `.env.example` to `.env.local` and set `VITE_API_URL=http://localhost:5000`.
5. Start backend:

```bash
cd backend
npm install
npm run dev
```

6. Start frontend in a second terminal:

```bash
npm install
npm run dev:frontend
```

## Test URLs

- Frontend: http://127.0.0.1:8080
- Login: http://127.0.0.1:8080/login
- Backend health: http://localhost:5000/api/health

## Production notes for Hostinger

Set backend environment variables in Hostinger:

```env
PORT=5000
DB_HOST=your_hostinger_mysql_host
DB_PORT=3306
DB_USER=your_hostinger_mysql_user
DB_PASSWORD=your_hostinger_mysql_password
DB_NAME=your_hostinger_database
JWT_SECRET=use_a_long_random_secret
ALLOWED_ORIGINS=https://your-domain.lk,https://www.your-domain.lk
PUBLIC_API_URL=https://api.your-domain.lk
```

Set frontend:

```env
VITE_API_URL=https://api.your-domain.lk
```

## Security included

- JWT authentication
- bcrypt password hashing
- admin-only protected APIs
- setup-admin lock after first admin
- CORS allow-list
- basic security headers
- upload file-type validation
- upload size checks
- no private `.env` included in the clean release package

## EduTrack Integration

EduTrack is now bundled into the main platform at:

- `/portal/edutrack` — protected platform route for teachers/admins
- `/edutrack/` — embedded EduTrack runtime served from the same website

It uses the same login token created by `/api/login`. Teachers do not need a second Firebase login.
EduTrack data is stored in MySQL through the backend compatibility table `edutrack_documents` and APIs:

- `GET/POST/PUT/PATCH/DELETE /api/edutrack/compat/:collection/:id?`
- `POST /api/edutrack/create-user`
- `GET /api/edutrack/session`

Keep the backend running at `http://localhost:5000` for local testing.

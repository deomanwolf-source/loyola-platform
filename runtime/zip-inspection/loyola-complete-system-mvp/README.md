# Loyola College Complete System MVP

This ZIP contains a **working clean MVP system** for the Loyola website platform.

It includes:

- Main app: public website, Website Admin, Users, Staff Management, uploads
- Separate EduTrack app: own backend, own DB, dashboard, syllabus tracker, relief assignments
- Database schemas and seeds
- Upload folder structure
- Staff -> EduTrack secure sync API
- Frontend pages using clean HTML/CSS/JS
- Setup and deployment instructions

## Important

This is a clean working MVP/starter system. It is not your existing full production codebase with every custom feature already migrated. Use it as the clean base to rebuild correctly.

## Apps

```txt
main-app/
  Public website + Website Admin + Staff + Users

edutrack-app/
  Separate EduTrack system + separate database
```

## Databases

```txt
Main DB:
u414000991_loyola_db_LC

EduTrack DB:
u414000991_edutrack_db
```

## Quick Start Local

### Main App

```bash
cd main-app
cp .env.example .env
npm install
npm start
```

Open:

```txt
http://localhost:5000
http://localhost:5000/admin.html
http://localhost:5000/staff.html
http://localhost:5000/users.html
http://localhost:5000/api/health
```

### EduTrack App

```bash
cd edutrack-app
cp .env.example .env
npm install
npm start
```

Open:

```txt
http://localhost:5002
http://localhost:5002/api/health
```

## Default Admin

Use the seed script/API to create a masteradmin. Passwords are hashed. Do not use weak passwords in production.

## Production Safety

- Do not commit `.env`
- Do not commit `uploads`
- Change all secrets before deployment
- Rotate database passwords if exposed
- Backup before importing/resetting databases

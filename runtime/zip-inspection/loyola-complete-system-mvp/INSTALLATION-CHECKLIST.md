# Installation Checklist

## 1. Create DBs

- Main DB: `u414000991_loyola_db_LC`
- EduTrack DB: `u414000991_edutrack_db`

## 2. Import SQL

Main DB:
```txt
database/main_schema.sql
database/main_seed.sql
```

EduTrack DB:
```txt
database/edutrack_schema.sql
database/edutrack_seed.sql
```

## 3. Configure env

```txt
main-app/.env.example -> main-app/.env
edutrack-app/.env.example -> edutrack-app/.env
```

## 4. Install/run

```bash
cd main-app
npm install
npm start
```

```bash
cd edutrack-app
npm install
npm start
```

## 5. Test

```txt
Main:     /api/health
EduTrack: /api/health
```

## 6. Production

Deploy as two separate Node apps.

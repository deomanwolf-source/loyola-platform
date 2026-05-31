# Hostinger Setup

## Main App

Deploy `main-app` as one Node.js app.

Recommended domains/subdomains:

```txt
loyolacollegenegombo.com
staff.loyolacollegenegombo.com
users.loyolacollegenegombo.com
```

## EduTrack App

Deploy `edutrack-app` as a separate Node.js app.

```txt
edutrack.loyolacollegenegombo.com
```

## Environment Variables

Do not upload real `.env` to GitHub. Add variables in Hostinger Node.js app settings.

## Main App Variables

```env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_main_db_user
DB_PASSWORD=your_main_db_password
DB_NAME=u414000991_loyola_db_LC
JWT_SECRET=your_main_secret
EDUTRACK_INTERNAL_BASE_URL=https://edutrack.loyolacollegenegombo.com
EDUTRACK_SYNC_SECRET=same_secret_as_edutrack
ALLOWED_ORIGINS=https://loyolacollegenegombo.com,https://staff.loyolacollegenegombo.com,https://users.loyolacollegenegombo.com,https://edutrack.loyolacollegenegombo.com
```

## EduTrack Variables

```env
NODE_ENV=production
PORT=5002
DB_HOST=localhost
DB_PORT=3306
DB_USER=u414000991_edutrack_user
DB_PASSWORD=your_edutrack_db_password
DB_NAME=u414000991_edutrack_db
JWT_SECRET=your_edutrack_secret
EDUTRACK_SYNC_SECRET=same_secret_as_main_app
ALLOWED_ORIGINS=https://edutrack.loyolacollegenegombo.com,https://staff.loyolacollegenegombo.com
```

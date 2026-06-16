# Loyola EduTrack Standalone

This folder runs EduTrack as its own application, separate from the public website.

## Local Run

From the repository root:

```powershell
npm run edutrack:start
```

Or from this folder:

```powershell
npm install
npm start
```

Default local URL:

```txt
http://localhost:5002/portal/edutrack
```

## Hostinger

Create a separate Node.js app for `edutrack.loyolacollege.lk` and point it at this folder.
Use `.env.example` as the template. The app must use the EduTrack database, not the public
website database.

The public website should set:

```env
EDUTRACK_PUBLIC_URL=https://edutrack.loyolacollege.lk
EDUTRACK_INTERNAL_BASE_URL=https://edutrack.loyolacollege.lk
```

That keeps `/portal/edutrack` on the website as an SSO handoff only. EduTrack itself runs here.

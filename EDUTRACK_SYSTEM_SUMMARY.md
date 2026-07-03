# EduTrack System Summary

EduTrack is the academic tracking module inside the Loyola College digital platform. It connects teachers, EduTrack administrators, subjects, classes, year plans, daily syllabus progress, relief assignments, report cards, and reporting into one school workflow.

The system is built as a static web application served by the Node/Express backend. The main frontend is `public/edutrack/index.html`, with backend APIs in `backend/server.js` and single-sign-on helper logic in `backend/lib/edutrack-sso.js`.

## Main Purpose

EduTrack is used to:

- Assign teachers to subjects, grades, sections, and academic years.
- Let teachers create and update year plans.
- Track syllabus completion by term, unit, topic, and subtopic.
- Record daily syllabus progress.
- Produce admin progress reports and CSV exports.
- Manage relief assignment PDFs with controlled download, audit, unlock, and delete approval rules.
- Create and manage EduTrack user accounts.
- Import teacher records from a separate CSV into the EduTrack database.
- Connect teacher-facing academic work with report cards and staff attendance data.

## Where The System Lives

Important files and folders:

- `public/edutrack/index.html` - main EduTrack browser app.
- `backend/public/edutrack/index.html` - backend-served copy of the EduTrack app.
- `public/portal/edutrack/index.html` - portal entry copy.
- `backend/server.js` - API routes, database schema setup, permissions, uploads, reporting, and audit behavior.
- `backend/lib/edutrack-sso.js` - EduTrack SSO token creation and verification.
- `database/schema.sql` - database schema reference.
- `database/hostinger-schema.sql` - Hostinger schema reference.
- `database/hostinger-edutrack-database-import.sql` - EduTrack import/setup script.
- `database/demo-edutrack-data.sql` - demo term/syllabus data.
- `hostinger.env.example` - Hostinger environment example.
- `deploy/hostinger/edutrack.env` - Hostinger EduTrack environment configuration, when present.

## Login And Access Flow

EduTrack uses the same platform authentication model as the main Loyola system for login handoff,
but it does not copy teacher records from the website.

1. A user signs in through the Loyola platform.
2. If the user opens EduTrack, the backend checks whether the role is allowed.
3. For cross-app access, `backend/lib/edutrack-sso.js` creates a short-lived SSO token.
4. The token has purpose `edutrack_sso` and expires after 60 seconds.
5. `/api/edutrack/sso/complete` verifies the token and creates or finds the matching EduTrack session user.
6. The frontend calls `/api/edutrack/session` to load the current user, role, and EduTrack identity details.

Allowed EduTrack SSO roles include:

- `masteradmin`
- `superadmin`
- `master_edutrack_admin`
- `eduzync_admin`
- `viewadmin`
- `teacher`

Default public EduTrack URL:

```text
https://edutrack.loyolacollege.lk
```

## User Roles

EduTrack uses role-based access control.

### Master Admin / Super Admin

These roles have the highest platform access. They can manage EduTrack records, users, reports, and administrative data.

### Master EduTrack Admin

This role is the strongest EduTrack-specific role. It can manage EduTrack data and perform sensitive actions such as deleting teacher assignments and approving or finalizing protected relief-assignment actions.

### Eduzync Admin

This role manages most EduTrack academic workflows: teacher assignments, terms, syllabus records, users, reports, daily progress, and relief assignment administration.

### Teacher

Teachers use EduTrack mainly for their own assigned subjects and academic records. They can view their assigned subjects, create or update year plans, mark subtopic completion, enter daily syllabus progress, and access workflows allowed to teacher users.

### View Admin

This role is allowed to enter EduTrack but should be treated as a more restricted administrative or read-focused account depending on route permission.

## Main Frontend Pages

The EduTrack frontend includes these main sections:

- Dashboard
- My Assigned Subjects
- Year Plan Progress
- My Progress Report
- Relief Assignments
- Teacher Assignments
- Year Plans
- Progress Reports
- Staff Attendance
- Teachers
- Subject Assignments
- Terms
- Yearly Reset
- User Accounts
- Daily Syllabus Progress

Some sections are visible only to admins or specific roles.

## Main Workflow

The normal school workflow is:

1. Admin creates or syncs teacher accounts.
2. Admin assigns teachers to subjects, grades, sections, and academic years.
3. Teacher opens "My Assigned Subjects".
4. Teacher creates a year plan for an assigned subject.
5. Teacher generates terms and units, then adds topics and subtopics.
6. Teacher marks subtopics complete as teaching progresses.
7. Teacher records daily syllabus progress.
8. Admin reviews progress reports by teacher, subject, grade, section, and year.
9. Reports can be printed or exported as CSV.
10. Admin uses relief assignment tools when a teacher is absent or a replacement assignment document must be controlled.

## Dashboard

The Dashboard summarizes EduTrack activity for the current user.

It shows high-level counts and status indicators for:

- Assigned subjects
- Year plan progress
- Syllabus progress
- Warnings
- Reports
- Relief assignment status
- Admin-level totals when the user has admin access

The dashboard is rendered by the frontend and backed by routes such as:

- `GET /api/edutrack/dashboard`
- `GET /api/edutrack/warnings`
- `GET /api/edutrack/session`

## Teacher Assignments

Teacher assignments connect one teacher to an academic subject workload.

An assignment usually includes:

- Teacher user ID
- Teacher profile ID
- Teacher display name
- Subject
- Grade
- Section
- Academic year
- Status

Important routes:

- `GET /api/edutrack/my-assignments`
- `GET /api/edutrack/teacher-assignments`
- `POST /api/edutrack/teacher-assignments`
- `PUT /api/edutrack/teacher-assignments/:id`
- `DELETE /api/edutrack/teacher-assignments/:id`

Teacher assignment deletion is protected more strongly than normal editing. It is handled by the EduTrack master permission layer.

## Year Plans

A year plan is the structured teaching plan for a teacher assignment.

The hierarchy is:

```text
Year Plan
Term
Unit
Main Topic
Subtopic
```

The teacher or admin can:

- Create a year plan from a teacher assignment.
- Generate term and unit structure.
- Update unit titles and order.
- Add main topics.
- Add subtopics.
- Mark subtopics complete.
- Save completion notes.
- Recalculate progress percentages.

Important routes:

- `GET /api/edutrack/year-plans`
- `POST /api/edutrack/year-plans`
- `GET /api/edutrack/year-plans/:id`
- `PUT /api/edutrack/year-plans/:id`
- `POST /api/edutrack/year-plans/:id/generate-units`
- `PUT /api/edutrack/year-plan-terms/:id`
- `PUT /api/edutrack/year-plan-units/:id`
- `POST /api/edutrack/year-plan-units/:id/topics`
- `PUT /api/edutrack/year-plan-topics/:id`
- `POST /api/edutrack/year-plan-topics/:id/subtopics`
- `PUT /api/edutrack/year-plan-subtopics/:id`
- `POST /api/edutrack/year-plan-subtopics/:id/toggle-complete`

Progress is recalculated upward. When a subtopic is completed, the system updates topic, unit, term, and full year plan progress percentages.

## Year Plan Reports

Year plan reports help admins review teaching progress.

Reports can be filtered by:

- Teacher
- Subject
- Grade
- Section
- Academic year
- Progress status

Important routes:

- `GET /api/edutrack/year-plan-reports`
- `GET /api/edutrack/year-plan-reports/teacher/:teacherId`
- `GET /api/edutrack/year-plan-reports/subject`
- `GET /api/edutrack/year-plan-reports/grade-section`
- `GET /api/edutrack/year-plan-reports/export/csv`

The frontend also provides print-style report output for admin review.

## Daily Syllabus Progress

Daily syllabus progress is the day-by-day teaching record.

A daily record can include:

- Teacher ID
- Teacher name
- Subject
- Grade
- Section
- Record date
- Period or lesson information
- Unit number
- Unit title
- Topic
- Subtopic
- Teaching status
- Notes

Important routes:

- `GET /api/edutrack/daily-syllabus-progress`
- `POST /api/edutrack/daily-syllabus-progress`
- `PUT /api/edutrack/daily-syllabus-progress/:id`
- `DELETE /api/edutrack/daily-syllabus-progress/:id`
- `GET /api/edutrack/daily-syllabus-progress/report`
- `GET /api/edutrack/daily-syllabus-progress/export/csv`

Daily syllabus changes are audit logged in `edutrack_syllabus_audit_logs`.

## Terms, Syllabus, And Progress

EduTrack also has a more traditional term and syllabus tracker.

Academic terms define teaching periods:

- Level
- Term name
- Start date
- End date
- Warning threshold
- Status

Syllabus items define planned curriculum content. Syllabus progress records teacher completion against those syllabus items.

Important routes:

- `GET /api/edutrack/terms`
- `POST /api/edutrack/terms`
- `PUT /api/edutrack/terms/:id`
- `DELETE /api/edutrack/terms/:id`
- `GET /api/edutrack/syllabus`
- `POST /api/edutrack/syllabus`
- `PUT /api/edutrack/syllabus/:id`
- `DELETE /api/edutrack/syllabus/:id`
- `GET /api/edutrack/progress`
- `POST /api/edutrack/progress`
- `PUT /api/edutrack/progress/:id`
- `DELETE /api/edutrack/progress/:id`

## Relief Assignments

Relief assignments are controlled PDF documents used when work must be given for relief or replacement teaching.

The workflow is stricter than a normal upload because documents may need audit and download control.

Admins can:

- Upload a relief PDF.
- Link a relief teacher.
- Search relief assignments.
- Download through an official controlled download route.
- View audit history.
- Request deletion.

Master EduTrack admins can:

- Unlock one extra official download.
- Approve delete requests.
- Reject delete requests.
- Perform protected deletion.

Important routes:

- `GET /api/edutrack/relief-assignments`
- `POST /api/edutrack/relief-assignments`
- `GET /api/edutrack/relief-assignments/:id`
- `POST /api/edutrack/relief-assignments/:id/official-download`
- `POST /api/edutrack/relief-assignments/:id/print`
- `POST /api/edutrack/relief-assignments/:id/unlock-one-download`
- `POST /api/edutrack/relief-assignments/:id/unlock`
- `GET /api/edutrack/relief-assignments/:id/file`
- `GET /api/edutrack/relief-assignments/:id/audit`
- `POST /api/edutrack/relief-assignments/:id/delete-request`
- `POST /api/edutrack/relief-assignments/:id/approve-delete`
- `POST /api/edutrack/relief-assignments/:id/reject-delete`
- `DELETE /api/edutrack/relief-assignments/:id`

Relief assignment audit history is stored in `edutrack_relief_assignment_audit_logs`.

## Staff Attendance Inside EduTrack

EduTrack includes an admin-facing staff attendance section.

It uses the staff module APIs, not a separate EduTrack-only attendance table.

Frontend behavior includes:

- Load attendance by date, section, staff type, and search text.
- Mark all visible staff as present.
- Change individual status.
- Save attendance in bulk.
- Print attendance.
- Export attendance CSV.

Important routes used by EduTrack:

- `GET /api/staff/attendance`
- `POST /api/staff/attendance/bulk-mark`

## User Accounts

EduTrack administrators can create platform users for EduTrack access.

Important route:

- `POST /api/edutrack/create-user`

The system also has compatibility document routes that store older EduTrack-style frontend data into MySQL through `edutrack_documents`.

Compatibility routes:

- `GET /api/edutrack/compat/:collection`
- `GET /api/edutrack/compat/:collection/:id`
- `POST /api/edutrack/compat/:collection`
- `PUT /api/edutrack/compat/:collection/:id`
- `PATCH /api/edutrack/compat/:collection/:id`
- `DELETE /api/edutrack/compat/:collection/:id`

These compatibility routes are important because the frontend has older local/document-style logic that is now backed by the database.

## Staff Profile Sync

EduTrack teacher records are maintained inside the EduTrack database.

The standalone deployment path does not copy teacher records from the Loyola website. Instead, the
teacher list is imported from a separate CSV or entered directly through EduTrack admin tools.

Important teacher functions in `backend/server.js`:

- `upsertLocalEduTrackTeacher`
- `deleteEduTrackTeacherAccount`
- `lookupEduTrackTeacher`
- `platformUsersForEduTrack`

Teacher records keep their own IDs, account links, and status fields inside EduTrack. The website
may still launch EduTrack through SSO, but that handoff only authenticates the user and does not
seed teacher data.

## Teacher Identity Matching

EduTrack has to match teachers across different records. A teacher may appear in:

- `users`
- `teachers`
- `edutrack_documents`
- teacher assignment rows
- year plan rows
- daily syllabus rows

The backend uses identity helper functions to merge these references:

- `firstEduTrackValue`
- `addEduTrackIdentityHint`
- `loadEduTrackIdentityHints`
- `findEduTrackIdentityHint`
- `mergeEduTrackIdentity`
- `lookupEduTrackTeacher`

This is why staff ID, teacher ID, user ID, email, and EduTrack teacher ID must be handled carefully.

## Report Cards

EduTrack is connected to report-card permissions and APIs.

Important routes:

- `GET /api/report-cards`
- `POST /api/report-cards`

Report card access is controlled by role permissions. Teachers can have report-card create/update permissions, while students and parents usually have view-only access.

## Main Database Tables

Core platform tables used by EduTrack:

- `users`
- `students`
- `teachers`
- `parents`
- `classes`
- `subjects`
- `enrollments`

EduTrack academic tables:

- `academic_terms`
- `syllabus_items`
- `syllabus_progress`
- `edutrack_daily_syllabus_progress`
- `edutrack_syllabus_audit_logs`

EduTrack year-plan tables:

- `edutrack_teacher_subject_assignments`
- `edutrack_year_plans`
- `edutrack_year_plan_terms`
- `edutrack_year_plan_units`
- `edutrack_year_plan_topics`
- `edutrack_year_plan_subtopics`
- `edutrack_year_plan_audit_logs`

EduTrack relief-assignment tables:

- `edutrack_relief_assignments`
- `edutrack_relief_assignment_audit_logs`

Document compatibility table:

- `edutrack_documents`

Report card tables:

- `report_cards`
- `report_card_subjects`

## Important Backend Functions

### SSO Functions

- `resolveEduTrackPublicUrl` - decides the public EduTrack URL.
- `sanitizeEduTrackReturnPath` - prevents unsafe redirect paths.
- `createEduTrackSsoToken` - creates a short-lived JWT for EduTrack login.
- `verifyEduTrackSsoToken` - verifies role, purpose, expiry, and token integrity.

### Permission Functions

- `isEduTrackAdminUser` - checks whether the current user can use admin EduTrack functions.
- `isEduTrackMasterUser` - checks whether the current user has master-level EduTrack permission.
- `eduzyncAdminOnly` - protects admin routes.
- `edutrackMasterOnly` - protects high-risk routes.
- `teacherOrAdmin` - allows teachers and EduTrack admins.

### Document Functions

- `readEduTrackDoc` - reads a stored compatibility document.
- `writeEduTrackDoc` - creates or updates a compatibility document.
- `listEduTrackDocs` - lists all documents in a collection.
- `getEduTrackDocumentIdColumn` - handles old/new ID column differences.

### Year Plan Functions

- Year plan read helpers load a full plan with terms, units, topics, and subtopics.
- Progress recalculation updates completion percentage from subtopic level upward.
- Audit helpers store changes in `edutrack_year_plan_audit_logs`.

### Relief Assignment Functions

- Relief serialization builds safe API output for the frontend.
- Teacher lookup verifies a relief teacher ID.
- Audit logging records upload, download, print, unlock, delete request, approval, rejection, and deletion events.
- File serving returns the stored relief PDF only through protected routes.

### Teacher Import Functions

- `upsertLocalEduTrackTeacher` creates or updates local EduTrack teacher and user records.
- `deleteEduTrackTeacherAccount` removes or unlinks EduTrack teacher account references in a controlled way.
- `lookupEduTrackTeacher` resolves teacher identity from imported records and linked accounts.

## Security And Audit Rules

Important safety behavior:

- EduTrack routes require login.
- Sensitive routes require admin or master EduTrack roles.
- SSO tokens are short-lived.
- SSO return paths are sanitized.
- Daily syllabus changes are audit logged.
- Year plan changes are audit logged.
- Relief assignment actions are audit logged.
- Relief PDFs use controlled official download behavior.
- Master approval is required for protected relief deletion flows.
- Compatibility document deletion is admin-only.

## File Uploads

Relief assignment PDFs are uploaded through the backend and stored under the configured upload root.

The API stores metadata in `edutrack_relief_assignments`, including:

- Original file name
- Stored file path
- MIME type
- File size
- Uploading user
- Download status
- Lock status
- Delete status

The frontend does not directly access the raw file path. It uses protected file routes.

## Deployment Notes

EduTrack is part of the same Node/Express application used by the Loyola platform.

Deployment normally includes:

1. Build or update frontend/static files.
2. Keep `public/edutrack/index.html` and backend public copies aligned if the deployment expects both.
3. Deploy backend code from `backend/server.js`.
4. Make sure Hostinger environment variables are correct.
5. Run additive database schema updates only.
6. Do not run reset or clean scripts on production unless data deletion is explicitly intended.

Useful files:

- `hostinger.env.example`
- `README_HOSTINGER_LOCAL.md`
- `HOSTINGER_TWO_DATABASE_GUIDE.md`
- `database/hostinger-schema.sql`
- `database/hostinger-edutrack-database-import.sql`

Important warning:

`database/hostinger-clean-reset.sql` contains delete/reset operations. Do not run it on production unless the school intentionally wants data removed.

## Operational Care Points

- Do not delete existing EduTrack data when deploying normal feature updates.
- Prefer additive migrations: create missing tables, add missing columns, add indexes.
- Be careful with teacher identity fields because the same teacher may be matched by multiple IDs.
- Do not rename compatibility collections in `edutrack_documents` unless frontend references are updated.
- Test teacher and admin accounts separately because they see different screens and data.
- Check Hostinger environment values before deployment, especially database credentials, JWT secret, public URL, and external sync settings.

## Quick Functional Map

| Area | What It Does | Main Users |
| --- | --- | --- |
| Dashboard | Shows overall EduTrack status and summaries | Teachers, admins |
| Teacher Assignments | Connects teachers to subjects/classes/year | Admins |
| My Assigned Subjects | Shows a teacher's own subject assignments | Teachers |
| Year Plans | Builds structured annual teaching plans | Teachers, admins |
| Year Plan Reports | Reviews progress by teacher/subject/class | Admins |
| Daily Syllabus Progress | Records day-by-day teaching progress | Teachers, admins |
| Terms And Syllabus | Defines academic terms and syllabus items | Admins |
| Relief Assignments | Uploads, locks, downloads, audits relief PDFs | Admins, master admins |
| Staff Attendance | Marks daily staff attendance from EduTrack | Admins |
| User Accounts | Creates EduTrack access accounts | Admins |
| Teacher Import | Loads EduTrack teacher records from a separate CSV | System/admins |
| Report Cards | Stores student report card data | Teachers, admins, students, parents |

## Academic Coordinator Role And Approval Workflow (v5.4.0)

EduTrack supports three staff tiers:

- **Admins** (`masteradmin`, `superadmin`, `master_edutrack_admin`, `eduzync_admin`) — full management: accounts, teachers, subjects, assignments, reviews, analytics.
- **Academic Coordinators** (`academic_coordinator`) — school-wide read access plus review powers: Analytics, Year Plans (approve / request changes), Progress Reports, Staff Attendance, and Relief oversight. They cannot manage user accounts, teachers, or subject assignments.
- **Teachers** — own assignments, year plans, daily progress, and relief uploads.

Coordinator accounts are created from **User Accounts → Add Coordinator** (admins only). The platform role enum was extended additively with `academic_coordinator`; no existing data is modified.

Year plans carry an approval workflow stored in additive columns on `edutrack_year_plans` (`approval_status`: `draft` → `submitted` → `approved` / `changes_requested`, plus reviewer name, timestamp, and comment):

- Teachers submit a plan for review from the Year Plan Progress editor.
- Coordinators or admins approve or request changes (comment required) from the Year Plans page.
- Every transition is written to `edutrack_year_plan_audit_logs`.

New API endpoints:

- `POST /api/edutrack/year-plans/:id/submit` — teacher/admin submits a plan for review.
- `POST /api/edutrack/year-plans/:id/review` — coordinator/admin decision (`approve` or `request_changes`).
- `GET /api/edutrack/analytics/overview` — school-wide analytics: completion, approval pipeline, per-grade coverage, 30-day daily-progress activity, at-risk teachers (<40%), top performers, relief stats.

The **Analytics** page in the sidebar (admins and coordinators) renders these aggregates with KPI tiles, bars, and a 30-day activity chart.

## Account Management System (v5.5.0)

The **Account Management** page (formerly User Accounts) lets admins manage every EduTrack login
from one place:

- **Add Teacher** — full teacher onboarding (teacher ID, classes, grades) as before.
- **Add Staff Account** — creates an **Academic Coordinator** or an **EduTrack Admin**
  (`eduzync_admin`). The EduTrack Admin option is only available to master-tier admins
  (`masteradmin`, `superadmin`, `master_edutrack_admin`).
- **Reset Password** — per-account temporary password reset; resetting an admin account requires a
  master-tier admin.
- **Enable / Disable** — deactivate or reactivate an account without deleting any data. You cannot
  change your own status, and master accounts cannot be disabled from EduTrack.
- **Account Activity** — an audit trail of account creations, password resets, status changes, and
  deletions (who did what, to whom, when, from which IP).

Account data lives in two additive tables — `edutrack_account_registry` (mirror of managed
accounts) and `edutrack_account_audit_logs` (activity trail). By default they are created in the
EduTrack database; setting the optional `ACCOUNTS_DB_*` environment variables stores them in a
completely separate MySQL database (see `HOSTINGER_TWO_DATABASE_GUIDE.md`).

Account management endpoints:

- `GET /api/edutrack/accounts` — list managed accounts with role and status.
- `POST /api/edutrack/create-user` — create teacher / coordinator / EduTrack admin (tier-guarded).
- `POST /api/edutrack/reset-user-password` — audited password reset (tier-guarded for admins).
- `PATCH /api/edutrack/accounts/:id/status` — enable or disable an account.
- `GET /api/edutrack/accounts/audit` — recent account activity log.

## NIC Number Login (v5.6.0)

EduTrack sign-in uses the **National Identity Card number + password**. Email stays on each
account as contact information and a secondary identifier.

- The login screen asks for the NIC number (12 digits for new NICs, or 9 digits followed by V/X
  for old NICs) and password. `/api/login` looks the account up by `users.nic_number` first.
- Email login still works as a fallback so existing accounts are never locked out. Once every
  account has a NIC assigned, set `LOGIN_REQUIRE_NIC=1` in the EduTrack environment to reject
  email sign-in entirely.
- NIC numbers are set when creating accounts (Add Teacher and Add Staff Account modals both have
  a NIC field), via the **Set NIC** action on each row of Account Management, when editing a
  teacher, or in bulk through the teacher CSV import (`nic` / `nic_number` / `national_id`
  column). NIC changes are validated, checked for duplicates, and written to the account audit
  log.
- `PATCH /api/edutrack/accounts/:id/nic` sets or clears a NIC (changing an admin's NIC requires
  a master-tier admin). `POST /api/edutrack/reset-user-password` also accepts a `nic` identity.
- The `users.nic_number` column and its index are added automatically and additively at startup;
  no existing data is modified.

## Professional UI Refresh (v6.0.0)

The interface uses a calmer professional theme: neutral slate surfaces with a single restrained
blue accent, flat solid buttons, a clear sidebar active state, consistent card/table/modal
styling, one unified focus ring, and a crisp light mode. The theme is a CSS token layer loaded
last in `edutrack/public/edutrack/index.html` (search for "EduTrack v6 — Professional Refresh"),
so all functionality and data flows are unchanged — restyling only.

## In Short

EduTrack is not just a syllabus page. It is a full academic operations system for teacher assignment, teaching plan creation, daily progress tracking, reporting, separate teacher import, relief document control, and academic account management.

The most important rule for future development is to preserve existing production data. Normal updates should add or update code and schema safely, not reset tables or delete records.

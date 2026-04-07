# Architecture Notes

The target product is an education-center platform focused on effective learning for children and transparent interaction between staff and parents. The full concept combines a public course website, an attendance/progress journal and a CRM workspace. This repository covers the CRM MVP plus attendance workflows and is structured so the website and richer journal features can be added later.

## 1. Monorepo layout

The repository is split into two isolated apps:

- `backend`: REST API and database access
- `frontend`: React single-page application

Root `package.json` orchestrates workspace scripts for local development.

## 2. Backend design

### Stack

- Express 5
- Prisma ORM
- PostgreSQL
- JWT auth with refresh token rotation
- Swagger UI from `backend/docs/openapi.yaml`

### Main modules

- `auth`: register, login, refresh, logout
- `users`: current profile read/update
- `children`: parent-owned student profiles
- `analytics`: center-level KPI dashboard for staff
- `lessons`: schedule and course-session CRUD with filtering
- `enrollments`: booking flow with capacity and age validation
- `payments`: payment intent creation and confirmation
- `attendance`: attendance journal for staff and parent visibility
- `feedback`: two-way discussion threads between parent and staff
- `notifications`: in-app notification feed
- `uploads`: local file storage for child avatars

### Security model

- access tokens are sent as `Bearer` tokens
- refresh tokens are persisted in the database as SHA-256 hashes
- route access is guarded by `requireAuth` and `requireRoles`
- parent users are restricted to their own children, enrollments and payments

### Persistence

Prisma models cover:

- `User`
- `Child`
- `Lesson`
- `Enrollment`
- `Payment`
- `Attendance`
- `FeedbackThread`
- `FeedbackMessage`
- `Notification`
- `RefreshToken`

## 3. Frontend design

### Stack

- React 19
- React Router
- Axios with automatic access-token refresh
- Context API for auth and toast state

### UI structure

- login/register page
- protected dashboard shell with sidebar
- staff analytics dashboard
- CRUD pages for children and lessons
- enrollment table
- payments page with mock or Stripe flow
- attendance journal
- feedback page with threaded parent/staff discussion
- notifications feed
- settings page

The current UI acts as the internal CRM workspace. A public marketing/course website can be added as a separate frontend that consumes the same API.

### State strategy

- authentication state is held in `AuthProvider`
- toast notifications are held in `ToastProvider`
- page data is fetched per route from the REST API
- access and refresh tokens are stored in `localStorage`

## 4. Payment flow

### Mock mode

When Stripe keys are missing:

1. backend creates a mock payment record
2. frontend immediately calls confirm
3. payment becomes `SUCCEEDED`

### Stripe mode

When Stripe keys are configured:

1. backend creates a Stripe `PaymentIntent`
2. frontend opens Stripe Elements
3. frontend confirms payment using Stripe.js
4. backend verifies the intent and marks the payment as `SUCCEEDED`

## 5. Notifications

Notifications are stored in the database for in-app display.
If email settings exist, the same events can also be sent through SMTP.
In development, `nodemailer` falls back to a JSON transport.

## 6. Scalability notes

The current MVP is intentionally simple, but prepared for extension:

- uploads can be moved from local disk to S3 or GCS
- notifications can be extended to FCM push delivery
- dashboard metrics can move into dedicated summary endpoints
- audit logging and QR attendance can be added without changing the core role model
- assignments, teacher remarks and parent feedback can be added on top of the current lesson and notification flows
- the public course catalog and landing pages can be split into a dedicated website app without replacing the CRM backend

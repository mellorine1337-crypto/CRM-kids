# Education Center CRM MVP

MVP CRM for an education center built with a JavaScript stack.

The broader product idea is a single system for educational centers that combines:

- a journal for attendance and learning progress
- a public course showcase website
- a CRM workspace for operations, enrollments, payments and communication

This repository currently implements the CRM MVP and attendance-oriented workflows that support the educational process for children, parents and staff.

- `backend`: Node.js, Express, Prisma, PostgreSQL, JWT, Swagger
- `frontend`: React, React Router, Axios, Stripe client support
- `database`: PostgreSQL via Docker Compose

## What is included

- authentication with `access + refresh` JWT tokens
- role model: `STAFF`, `PARENT`
- self-registration for `PARENT`, while `STAFF` accounts are created separately by the center
- student profiles managed through parent-linked child records
- staff-only analytics dashboard with revenue, attendance, funnel and occupancy metrics
- lessons, schedule and course-session management
- enrollments with capacity checks
- attendance journal
- two-way feedback threads between parent and staff
- payments with mock mode and Stripe test-mode support
- in-app notifications plus email transport stub
- child profile photo uploads in local dev storage
- Swagger OpenAPI file
- seed with demo accounts

## Project structure

```text
.
├── backend
│   ├── docs/openapi.yaml
│   ├── prisma/schema.prisma
│   ├── prisma/seed.js
│   └── src
├── frontend
│   └── src
├── docs
│   └── architecture.md
└── docker-compose.yml
```

## Local run

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Prepare the database

```bash
npm run prisma:generate
npm run prisma:push --workspace backend
npm run seed
```

### 5. Start backend and frontend

```bash
npm run dev
```

Applications:

- frontend: `http://localhost:5173`
- backend API: `http://localhost:4000/api`
- Swagger UI: `http://localhost:4000/api/docs`
- PostgreSQL from Docker: `localhost:5433`

## Demo accounts

- `STAFF`: `staff@kidscrm.local / Staff123!`
- `PARENT`: `parent@kidscrm.local / Parent123!`

Passwords can be overridden through `backend/.env`.

## Important environment variables

Backend:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- `UPLOAD_DIR`

Frontend:

- `VITE_API_BASE_URL`
- `VITE_STRIPE_PUBLISHABLE_KEY`

## Payment modes

- without Stripe keys the app uses a mock payment flow for development
- with Stripe keys the frontend opens Stripe Elements and the backend confirms the real test-mode `PaymentIntent`

## Verification performed

- `frontend`: `npm run lint`
- `frontend`: `npm run build`
- `backend`: `node -e "require('./src/app'); console.log('app-ok')"`
- `backend`: `npx prisma validate`
- `backend`: `npx prisma generate`

`prisma validate/generate` were executed with an explicit `DATABASE_URL` value equivalent to `backend/.env.example`.

## API reference

- Swagger: [backend/docs/openapi.yaml](/Users/alpa/CRM--JS/backend/docs/openapi.yaml)
- Architecture notes: [docs/architecture.md](/Users/alpa/CRM--JS/docs/architecture.md)

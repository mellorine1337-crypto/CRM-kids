# MVP CRM для образовательного центра

MVP CRM-система для образовательного центра, построенная на JavaScript-стеке.

Более широкая идея продукта состоит в создании единой системы для учебных центров, которая объединяет:

- журнал посещаемости и учебного прогресса
- публичный сайт-витрину курсов
- CRM-рабочее пространство для операций, записей, оплат и коммуникации

В этом репозитории реализован CRM MVP и связанные с посещаемостью процессы, которые поддерживают учебный процесс для детей, родителей и сотрудников.

- `backend`: Node.js, Express, Prisma, PostgreSQL, JWT, Swagger
- `frontend`: React, React Router, Axios, поддержка Stripe client
- `database`: PostgreSQL через Docker Compose

## Что реализовано

- аутентификация через JWT `access + refresh`
- роли: `ADMIN`, `TEACHER`, `PARENT`
- родитель входит по номеру телефона и SMS-коду
- преподаватель входит по одноразовой magic link или SMS-коду
- администратор входит по email и паролю
- карточки учеников, привязанные к родителю
- аналитическая панель для администратора: выручка, посещаемость, воронка, заполняемость
- занятия, расписание и управление сессиями курсов
- записи на занятия с проверкой вместимости
- журнал посещаемости
- двусторонняя обратная связь между родителем и преподавателем
- оплаты в mock-режиме и поддержка Stripe test mode
- in-app уведомления и email-заглушка
- загрузка фото ребёнка в локальное dev-хранилище
- Swagger OpenAPI
- seed с тестовыми аккаунтами

## Структура проекта

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

## Локальный запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить окружение

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Запустить PostgreSQL

```bash
docker compose up -d
```

### 4. Подготовить базу данных

```bash
npm run prisma:generate
npm run prisma:push --workspace backend
npm run seed
```

### 5. Запустить backend и frontend

```bash
npm run dev
```

Адреса:

- frontend: `http://localhost:5173`
- backend API: `http://localhost:4000/api`
- Swagger UI: `http://localhost:4000/api/docs`
- PostgreSQL from Docker: `localhost:5433`

## Тестовые аккаунты

- `ADMIN`: `admin@kidscrm.local / Admin123!`
- `TEACHER`: `irina@kidscrm.local / Teacher123!`
- `TEACHER`: `maksim@kidscrm.local / Teacher123!`
- `PARENT`: `parent@kidscrm.local / Parent123!`

Пароли можно переопределить через `backend/.env`.

## Важные переменные окружения

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

## Режимы оплаты

- без Stripe-ключей приложение использует mock-flow для разработки
- при наличии Stripe-ключей frontend открывает Stripe Elements, а backend подтверждает test-mode `PaymentIntent`

## Что было проверено

- `frontend`: `npm run lint`
- `frontend`: `npm run build`
- `backend`: `node -e "require('./src/app'); console.log('app-ok')"`
- `backend`: `npx prisma validate`
- `backend`: `npx prisma generate`

`prisma validate/generate` выполнялись с явным `DATABASE_URL`, эквивалентным значению из `backend/.env.example`.

## Ссылки на API и архитектуру

- Swagger: [backend/docs/openapi.yaml](/Users/alpa/CRM--JS/backend/docs/openapi.yaml)
- Архитектурные заметки: [docs/architecture.md](/Users/alpa/CRM--JS/docs/architecture.md)
- Карта проекта: [docs/code-map.md](/Users/alpa/CRM--JS/docs/code-map.md)
- Гайд для защиты: [docs/defense-guide.md](/Users/alpa/CRM--JS/docs/defense-guide.md)

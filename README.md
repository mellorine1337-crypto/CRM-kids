# umiko

CRM для образовательного центра с тремя ролями:

- `PARENT` регистрируется самостоятельно
- `ADMIN` входит по своему `email + пароль`
- `TEACHER` создаётся администратором и входит по `телефон + пароль`

В проекте уже настроен рабочий контур под деплой:

- frontend как React SPA
- backend как Express API
- PostgreSQL через Prisma
- bootstrap первого администратора

## Что сейчас работает

- самостоятельная регистрация родителя
- вход родителя по `телефон + пароль`
- вход преподавателя по `телефон + пароль`
- вход администратора по `email + пароль`
- создание преподавателей только администратором
- расписание, посещаемость, оплаты, уведомления, журнал, обратная связь

## Структура

```text
.
├── backend
│   ├── prisma
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── bootstrap.js
│   └── src
├── frontend
│   ├── public
│   └── src
└── render.yaml
```

## Деплой

Рекомендуемая схема для этого репозитория:

1. один `web service` на Render
2. одна PostgreSQL база на Render

В этой схеме один и тот же домен Render отдаёт:

- frontend
- backend API `/api`

Это самый простой вариант для рабочего MVP без CORS и без двух отдельных доменов.

### 1. Render

В репозитории уже есть готовый blueprint:

- [render.yaml](/Users/alpa/CRM--JS/render.yaml)

Он поднимает:

- `umiko-crm` как web service
- `umiko-db` как PostgreSQL

Как деплоить:

1. Открыть `Render -> New -> Blueprint`
2. Подключить репозиторий `CRM-kids`
3. Подтвердить создание сервисов из [render.yaml](/Users/alpa/CRM--JS/render.yaml)
4. Заполнить обязательные env переменные
5. Дождаться первого deploy

Что нужно задать в Render при первом деплое:

- `FRONTEND_URL=https://umiko-crm.onrender.com`
- `BOOTSTRAP_ADMIN_FULL_NAME`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PHONE`
- `BOOTSTRAP_ADMIN_PASSWORD`

Дополнительно при необходимости:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`

Пример production env:

- [backend/.env.production.example](/Users/alpa/CRM--JS/backend/.env.production.example)

Важно:

- backend сам выполнит `prisma db push`
- backend сам создаст первого администратора через `bootstrap.js`
- после этого админ сможет зайти и создать преподавателей уже из интерфейса
- текущий домен должен быть именно у `Web Service`, а не у `Static Site`

После деплоя сайт будет работать на одном домене Render, и frontend будет ходить в `/api` на этом же адресе.

## Локальный запуск

Если нужен dev-режим:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d
npm run prisma:generate
npm run prisma:push --workspace backend
npm run seed
npm run dev
```

## Тестовые данные для dev

- `ADMIN`: `admin@kidscrm.local / Admin123!`
- `TEACHER`: `+77001000011 / Teacher123!`
- `TEACHER`: `+77001000012 / Teacher123!`
- `PARENT`: `+77001000002 / Parent123!`

## Проверка

Проверено:

- `npm run lint --workspace frontend`
- `npm run build --workspace frontend`
- `POST /api/auth/parent/register`
- `POST /api/auth/parent/login`
- `POST /api/auth/teacher/login`
- `POST /api/auth/admin/login`
- `POST /api/users/teachers` под админом

## Документы

- Swagger: [backend/docs/openapi.yaml](/Users/alpa/CRM--JS/backend/docs/openapi.yaml)
- Архитектура: [docs/architecture.md](/Users/alpa/CRM--JS/docs/architecture.md)
- Карта проекта: [docs/code-map.md](/Users/alpa/CRM--JS/docs/code-map.md)
- Гайд для защиты: [docs/defense-guide.md](/Users/alpa/CRM--JS/docs/defense-guide.md)

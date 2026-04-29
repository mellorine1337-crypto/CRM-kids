# Карта Кода

Этот файл нужен для быстрого объяснения проекта на код-ревью и защите.

## Backend

- `backend/src/server.js`
  Точка входа API. Поднимает Express-приложение на порту из `.env`.

- `backend/src/app.js`
  Базовая сборка backend: CORS, `helmet`, логирование, JSON middleware, Swagger, маршруты и общий error handler.

- `backend/src/routes/auth.js`
  Регистрация, логин, refresh и logout. Здесь находится вся базовая JWT-аутентификация.

- `backend/src/routes/users.js`
  Получение и обновление текущего профиля пользователя.

- `backend/src/routes/children.js`
  Работа с детьми: создание, редактирование, удаление и чтение карточек.

- `backend/src/routes/lessons.js`
  CRUD занятий и фильтрация расписания.

- `backend/src/routes/enrollments.js`
  Запись ребёнка на занятие, отмена записи и получение списка записей.

- `backend/src/routes/payments.js`
  Ручные оплаты, mock/Stripe flow, долг и история платежей.

- `backend/src/routes/attendance.js`
  Посещаемость: ручная отметка, QR-посещение и журнал по занятию.

- `backend/src/routes/analytics.js`
  Метрики центра для сотрудника: выручка, загрузка, посещаемость, долги.

- `backend/src/routes/feedback.js`
  Двусторонняя связь между родителем и сотрудником.

- `backend/src/routes/notifications.js`
  Список уведомлений и отметка как прочитанных.

- `backend/src/utils/serializers.js`
  Приводит Prisma-модели к стабильному JSON-формату для frontend.

- `backend/src/lib/tokens.js`
  Генерация и проверка access, refresh и attendance QR токенов.

- `backend/prisma/schema.prisma`
  Главная схема БД: роли, пользователи, дети, занятия, записи, оплаты, посещаемость и уведомления.

- `backend/prisma/seed.js`
  Тестовые данные для локального запуска и демонстрации.

## Frontend

- `frontend/src/main.jsx`
  Точка входа frontend. Подключает роутер и все глобальные provider-ы.

- `frontend/src/App.jsx`
  Главная карта маршрутов приложения.

- `frontend/src/api/client.js`
  Единый HTTP-клиент на `axios`: токены, refresh flow, нормализация ошибок API.

- `frontend/src/layouts/DashboardLayout.jsx`
  Общий каркас приложения после входа: sidebar, topbar и область контента.

- `frontend/src/pages/LoginPage.jsx`
  Вход и регистрация родителя.

- `frontend/src/pages/DashboardPage.jsx`
  Главный экран. Внутри есть отдельные ветки для `ADMIN`, `TEACHER` и `PARENT`.

- `frontend/src/pages/ChildrenPage.jsx`
  Страница детей и форма карточки ребёнка.

- `frontend/src/pages/LessonsPage.jsx`
  Расписание. Для сотрудника это рабочий календарь, для родителя — просмотр занятий.

- `frontend/src/pages/AttendancePage.jsx`
  Посещаемость. Для сотрудника — отметка и QR-сканер, для родителя — история и QR-пропуск.

- `frontend/src/pages/PaymentsPage.jsx`
  Оплаты, долг, история оплат и ручной приём платежей.

- `frontend/src/pages/NotificationsPage.jsx`
  Список уведомлений пользователя.

- `frontend/src/i18n/messages.js`
  Все пользовательские тексты на русском и казахском.

- `frontend/src/data/navigation.js`
  Sidebar-меню и доступность пунктов по ролям.

- `frontend/src/styles/app.css`
  Основная тема и весь UI layout проекта.

## Где смотреть логику по ролям

- `PARENT`
  Обычно проверяется внутри страниц через `user.role === "PARENT"`.

- `ADMIN`
  Обычно проверяется через `user.role === "ADMIN"` или на backend через `requireRoles("ADMIN")`.
- `TEACHER`
  Обычно проверяется через `user.role === "TEACHER"` или через backend-ограничения на доступ только к своим занятиям.

## Как объяснять архитектуру кратко

1. Frontend работает как SPA на React.
2. Frontend ходит в backend через REST API.
3. Backend работает на Express и Prisma.
4. Prisma управляет PostgreSQL.
5. Доступ ограничивается ролями `ADMIN`, `TEACHER` и `PARENT`.
6. Все сложные сущности сериализуются в `serializers.js`, чтобы frontend получал стабильную структуру данных.

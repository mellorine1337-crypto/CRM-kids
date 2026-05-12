// Кратко: наполняет dev-базу тестовыми пользователями, детьми, занятиями и платежами.
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { env } = require("../src/config/env");

const prisma = new PrismaClient();

// Служебная функция atTime: инкапсулирует отдельный шаг логики этого модуля.
const atTime = (baseDate, hours, minutes) => {
  const value = new Date(baseDate);
  value.setHours(hours, minutes, 0, 0);
  return value;
};

// Служебная функция addDays: инкапсулирует отдельный шаг логики этого модуля.
const addDays = (baseDate, days) => {
  const value = new Date(baseDate);
  value.setDate(value.getDate() + days);
  return value;
};

// Служебная функция upsertUser: инкапсулирует отдельный шаг логики этого модуля.
const upsertUser = async ({ fullName, email, phone, password, role }) => {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      phone,
      passwordHash,
      role,
    },
    create: {
      fullName,
      email,
      phone,
      passwordHash,
      role,
    },
  });
};

// Служебная функция ensureChild: инкапсулирует отдельный шаг логики этого модуля.
const ensureChild = async ({ parentId, fullName, birthDate, gender, medicalNotes }) => {
  const existingChild = await prisma.child.findFirst({
    where: { parentId, fullName },
  });

  if (existingChild) {
    return existingChild;
  }

  return prisma.child.create({
    data: {
      parentId,
      fullName,
      birthDate,
      gender,
      medicalNotes,
    },
  });
};

const ensureLesson = async ({
  title,
  description,
  ageMin,
  ageMax,
  date,
  startTime,
  endTime,
  capacity,
  teacherId,
  teacherName,
  price,
  createdBy,
}) => {
  const existingLesson = await prisma.lesson.findFirst({
    where: { title },
  });

  if (existingLesson) {
    return prisma.lesson.update({
      where: { id: existingLesson.id },
      data: {
        description,
        ageMin,
        ageMax,
        date,
        startTime,
        endTime,
        capacity,
        teacherId,
        teacherName,
        price: price.toFixed(2),
        createdBy,
      },
    });
  }

  return prisma.lesson.create({
    data: {
      title,
      description,
      ageMin,
      ageMax,
      date,
      startTime,
      endTime,
      capacity,
      teacherId,
      teacherName,
      price: price.toFixed(2),
      createdBy,
    },
  });
};

const ensurePayment = async ({
  parentId,
  enrollmentId,
  amount,
  currency = "kzt",
  status,
  method,
  serviceLabel,
  comment,
  stripePaymentIntentId,
  clientSecret,
  recordedById,
  paidAt,
  historyComment,
}) => {
  const existingPayment = await prisma.payment.findFirst({
    where: {
      enrollmentId,
      status,
      amount: amount.toFixed(2),
      method,
    },
  });

  const payload = {
    parentId,
    enrollmentId,
    amount: amount.toFixed(2),
    currency,
    status,
    method,
    serviceLabel,
    comment: comment || null,
    stripePaymentIntentId: stripePaymentIntentId || null,
    clientSecret: clientSecret || null,
    recordedById: recordedById || null,
    paidAt: paidAt || null,
  };

  const payment = existingPayment
    ? await prisma.payment.update({
        where: { id: existingPayment.id },
        data: payload,
      })
    : await prisma.payment.create({
        data: payload,
      });

  const existingHistory = await prisma.paymentHistory.findFirst({
    where: {
      paymentId: payment.id,
      toStatus: status,
      comment: historyComment || comment || null,
    },
  });

  if (!existingHistory) {
    await prisma.paymentHistory.create({
      data: {
        paymentId: payment.id,
        toStatus: status,
        comment: historyComment || comment || null,
        createdById: recordedById || null,
      },
    });
  }

  return payment;
};

// Служебная функция ensureNotification: инкапсулирует отдельный шаг логики этого модуля.
const ensureNotification = async ({ userId, title, message, type, channel }) => {
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      title,
      message,
    },
  });

  if (existingNotification) {
    return existingNotification;
  }

  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      channel,
    },
  });
};

// Служебная функция ensureAttendance: инкапсулирует отдельный шаг логики этого модуля.
const ensureAttendance = async ({ enrollmentId, markedBy, status, comment, markedAt }) => {
  const existingAttendance = await prisma.attendance.findUnique({
    where: { enrollmentId },
  });

  if (existingAttendance) {
    return prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        markedBy,
        status,
        comment,
        markedAt,
      },
    });
  }

  return prisma.attendance.create({
    data: {
      enrollmentId,
      markedBy,
      status,
      comment,
      markedAt,
    },
  });
};

const ensureJournalEntry = async ({
  enrollmentId,
  createdBy,
  updatedBy,
  topicSummary,
  homeworkTitle,
  homeworkDescription,
  homeworkDueDate,
  homeworkStatus,
  score,
  progressLevel,
  teacherComment,
  parentComment,
}) => {
  const existingEntry = await prisma.journalEntry.findUnique({
    where: { enrollmentId },
  });

  const payload = {
    updatedBy,
    topicSummary,
    homeworkTitle,
    homeworkDescription,
    homeworkDueDate,
    homeworkStatus,
    score,
    progressLevel,
    teacherComment,
    parentComment,
  };

  if (existingEntry) {
    return prisma.journalEntry.update({
      where: { id: existingEntry.id },
      data: payload,
    });
  }

  return prisma.journalEntry.create({
    data: {
      enrollmentId,
      createdBy,
      ...payload,
    },
  });
};

const ensureIntegrationConnection = async ({
  type,
  name,
  description,
  status,
  endpoint,
  notes,
  lastSyncAt,
}) => {
  const existingIntegration = await prisma.integrationConnection.findFirst({
    where: {
      type,
      name,
    },
  });

  if (existingIntegration) {
    return prisma.integrationConnection.update({
      where: { id: existingIntegration.id },
      data: {
        description,
        status,
        endpoint,
        notes,
        lastSyncAt,
      },
    });
  }

  return prisma.integrationConnection.create({
    data: {
      type,
      name,
      description,
      status,
      endpoint,
      notes,
      lastSyncAt,
    },
  });
};

const ensureFeedbackThread = async ({
  subject,
  parentId,
  staffId,
  childId,
  messages,
}) => {
  const existingThread = await prisma.feedbackThread.findFirst({
    where: {
      subject,
      parentId,
      staffId,
      childId,
    },
  });

  if (existingThread) {
    return existingThread;
  }

  return prisma.feedbackThread.create({
    data: {
      subject,
      parentId,
      staffId,
      childId,
      lastMessageAt: new Date(),
      messages: {
        create: messages,
      },
    },
  });
};

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const admin = await upsertUser({
    fullName: "Ainur Admin",
    email: "admin@kidscrm.local",
    phone: "+77001000001",
    password: env.seed.adminPassword,
    role: "ADMIN",
  });

  const teacherIrina = await upsertUser({
    fullName: "Irina Volkova",
    email: "irina@kidscrm.local",
    phone: "+77001000011",
    password: env.seed.teacherPassword,
    role: "TEACHER",
  });

  const teacherMaksim = await upsertUser({
    fullName: "Maksim Lee",
    email: "maksim@kidscrm.local",
    phone: "+77001000012",
    password: env.seed.teacherPassword,
    role: "TEACHER",
  });

  const parent = await upsertUser({
    fullName: "Aigerim Parent",
    email: "parent@kidscrm.local",
    phone: "+77001000002",
    password: env.seed.parentPassword,
    role: "PARENT",
  });

  const parentTwo = await upsertUser({
    fullName: "Dana Parent",
    email: "parent2@kidscrm.local",
    phone: "+77001000003",
    password: env.seed.parentPassword,
    role: "PARENT",
  });

  const childOne = await ensureChild({
    parentId: parent.id,
    fullName: "Arman Parentov",
    birthDate: new Date("2018-05-12T00:00:00.000Z"),
    gender: "MALE",
    medicalNotes: "Аллергий нет",
  });

  const childTwo = await ensureChild({
    parentId: parent.id,
    fullName: "Aylin Parentova",
    birthDate: new Date("2020-02-18T00:00:00.000Z"),
    gender: "FEMALE",
    medicalNotes: "Нужны перерывы на воду",
  });

  const childThree = await ensureChild({
    parentId: parentTwo.id,
    fullName: "Aliya Student",
    birthDate: new Date("2017-10-05T00:00:00.000Z"),
    gender: "FEMALE",
    medicalNotes: "Любит проектные задания",
  });

  const lessonOne = await ensureLesson({
    title: "Творческая студия",
    description: "Рисование, живопись и творческие упражнения",
    ageMin: 5,
    ageMax: 9,
    date: atTime(today, 0, 0),
    startTime: "10:00",
    endTime: "11:00",
    capacity: 12,
    teacherId: teacherIrina.id,
    teacherName: teacherIrina.fullName,
    price: 5500,
    createdBy: admin.id,
  });

  const lessonTwo = await ensureLesson({
    title: "Юная робототехника",
    description: "Практические основы робототехники для дошкольников",
    ageMin: 6,
    ageMax: 10,
    date: atTime(today, 0, 0),
    startTime: "14:00",
    endTime: "15:30",
    capacity: 10,
    teacherId: teacherMaksim.id,
    teacherName: teacherMaksim.fullName,
    price: 7500,
    createdBy: admin.id,
  });

  const lessonThree = await ensureLesson({
    title: "Академическое чтение",
    description: "Развитие чтения, понимания текста и словарного запаса",
    ageMin: 6,
    ageMax: 10,
    date: atTime(addDays(today, -6), 0, 0),
    startTime: "16:00",
    endTime: "17:00",
    capacity: 8,
    teacherId: teacherIrina.id,
    teacherName: teacherIrina.fullName,
    price: 6200,
    createdBy: admin.id,
  });

  const lessonFour = await ensureLesson({
    title: "Логика и математика",
    description: "Логические задачи, счёт и внимательность",
    ageMin: 5,
    ageMax: 9,
    date: atTime(addDays(today, -10), 0, 0),
    startTime: "12:00",
    endTime: "13:00",
    capacity: 10,
    teacherId: teacherMaksim.id,
    teacherName: teacherMaksim.fullName,
    price: 6800,
    createdBy: admin.id,
  });

  const lessonFive = await ensureLesson({
    title: "Юная робототехника: практика",
    description: "Практика сборки, командная работа и мини-проекты",
    ageMin: 6,
    ageMax: 10,
    date: atTime(addDays(today, 1), 0, 0),
    startTime: "15:00",
    endTime: "16:30",
    capacity: 10,
    teacherId: teacherMaksim.id,
    teacherName: teacherMaksim.fullName,
    price: 7600,
    createdBy: admin.id,
  });

  const enrollmentOne = await prisma.enrollment.upsert({
    where: {
      childId_lessonId: {
        childId: childOne.id,
        lessonId: lessonOne.id,
      },
    },
    update: {
      status: "BOOKED",
    },
    create: {
      childId: childOne.id,
      lessonId: lessonOne.id,
      status: "BOOKED",
    },
  });

  const enrollmentTwo = await prisma.enrollment.upsert({
    where: {
      childId_lessonId: {
        childId: childOne.id,
        lessonId: lessonThree.id,
      },
    },
    update: {
      status: "ATTENDED",
    },
    create: {
      childId: childOne.id,
      lessonId: lessonThree.id,
      status: "ATTENDED",
    },
  });

  const enrollmentThree = await prisma.enrollment.upsert({
    where: {
      childId_lessonId: {
        childId: childTwo.id,
        lessonId: lessonTwo.id,
      },
    },
    update: {
      status: "BOOKED",
    },
    create: {
      childId: childTwo.id,
      lessonId: lessonTwo.id,
      status: "BOOKED",
    },
  });

  const enrollmentFour = await prisma.enrollment.upsert({
    where: {
      childId_lessonId: {
        childId: childTwo.id,
        lessonId: lessonFour.id,
      },
    },
    update: {
      status: "MISSED",
    },
    create: {
      childId: childTwo.id,
      lessonId: lessonFour.id,
      status: "MISSED",
    },
  });

  const enrollmentFive = await prisma.enrollment.upsert({
    where: {
      childId_lessonId: {
        childId: childThree.id,
        lessonId: lessonFive.id,
      },
    },
    update: {
      status: "ATTENDED",
    },
    create: {
      childId: childThree.id,
      lessonId: lessonFive.id,
      status: "ATTENDED",
    },
  });

  await ensurePayment({
    parentId: parent.id,
    enrollmentId: enrollmentOne.id,
    amount: 5500,
    status: "SUCCEEDED",
    method: "TERMINAL",
    serviceLabel: lessonOne.title,
    comment: "Оплата на ресепшене через терминал",
    recordedById: admin.id,
    paidAt: atTime(today, 9, 20),
    historyComment: "Создана и подтверждена оплата через терминал",
  });

  await ensurePayment({
    parentId: parent.id,
    enrollmentId: enrollmentTwo.id,
    amount: 6200,
    status: "SUCCEEDED",
    method: "BANK_TRANSFER",
    serviceLabel: lessonThree.title,
    comment: "Перевод от родителя по реквизитам центра",
    recordedById: admin.id,
    paidAt: atTime(addDays(today, -5), 18, 10),
    historyComment: "Оплата подтверждена переводом",
  });

  await ensurePayment({
    parentId: parent.id,
    enrollmentId: enrollmentThree.id,
    amount: 3000,
    status: "PARTIAL",
    method: "CASH",
    serviceLabel: lessonTwo.title,
    comment: "Частичная оплата наличными",
    recordedById: admin.id,
    paidAt: atTime(today, 11, 10),
    historyComment: "Зафиксирована частичная оплата",
  });

  await ensurePayment({
    parentId: parent.id,
    enrollmentId: enrollmentThree.id,
    amount: 4500,
    status: "PENDING",
    method: "QR",
    serviceLabel: lessonTwo.title,
    comment: "Ожидается подтверждение оплаты по QR",
    recordedById: admin.id,
    paidAt: null,
    historyComment: "Создан ожидающий платёж по QR",
  });

  await ensurePayment({
    parentId: parentTwo.id,
    enrollmentId: enrollmentFive.id,
    amount: 7600,
    status: "SUCCEEDED",
    method: "TERMINAL",
    serviceLabel: lessonFive.title,
    comment: "Полная оплата следующего занятия",
    recordedById: admin.id,
    paidAt: atTime(addDays(today, -1), 17, 0),
    historyComment: "Полная оплата подтверждена",
  });

  await ensureAttendance({
    enrollmentId: enrollmentTwo.id,
    markedBy: teacherIrina.id,
    status: "PRESENT",
    comment: "Отличная вовлечённость на уроке",
    markedAt: atTime(addDays(today, -6), 17, 5),
  });

  await ensureAttendance({
    enrollmentId: enrollmentFour.id,
    markedBy: teacherMaksim.id,
    status: "ABSENT",
    comment: "Пропуск без предупреждения",
    markedAt: atTime(addDays(today, -10), 13, 10),
  });

  await ensureAttendance({
    enrollmentId: enrollmentFive.id,
    markedBy: teacherMaksim.id,
    status: "PRESENT",
    comment: "Уверенное участие на всём занятии",
    markedAt: atTime(addDays(today, -1), 15, 35),
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentTwo.id,
    createdBy: teacherIrina.id,
    updatedBy: teacherIrina.id,
    topicSummary: "Отрабатывали чтение коротких текстов и пересказ по ключевым словам.",
    homeworkTitle: "Прочитать рассказ и выписать новые слова",
    homeworkDescription:
      "Прочитать материал дома, выписать 5 новых слов и составить с ними предложения.",
    homeworkDueDate: atTime(addDays(today, -3), 18, 0),
    homeworkStatus: "REVIEWED",
    score: 92,
    progressLevel: "EXCELLENT",
    teacherComment: "Арман хорошо удерживает внимание и быстро схватывает новые правила.",
    parentComment: "Дома самостоятельно выполнил всё задание.",
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentFour.id,
    createdBy: teacherMaksim.id,
    updatedBy: teacherMaksim.id,
    topicSummary: "Разбирали логические цепочки, устный счёт и задачи на внимание.",
    homeworkTitle: "Карточки на счёт и логические пары",
    homeworkDescription:
      "Повторить примеры на счёт и решить 6 коротких задач на логические последовательности.",
    homeworkDueDate: atTime(addDays(today, -8), 18, 0),
    homeworkStatus: "OVERDUE",
    score: 58,
    progressLevel: "ATTENTION_REQUIRED",
    teacherComment:
      "После нескольких пропусков материал усваивается неравномерно. Нужна регулярность и дополнительная поддержка.",
    parentComment: "Просим дать короткий план, чтобы наверстать дома.",
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentFive.id,
    createdBy: teacherMaksim.id,
    updatedBy: teacherMaksim.id,
    topicSummary: "Собирали простую модель и учились программировать последовательность действий.",
    homeworkTitle: "Собрать мини-проект по инструкции",
    homeworkDescription:
      "Повторить алгоритм сборки дома и подготовить 2 идеи, как улучшить конструкцию.",
    homeworkDueDate: atTime(addDays(today, 2), 18, 0),
    homeworkStatus: "SUBMITTED",
    score: 88,
    progressLevel: "GOOD",
    teacherComment: "Алия уверенно работает в команде и быстро понимает алгоритм.",
    parentComment: null,
  });

  await ensureIntegrationConnection({
    type: "SCHOOL_SYSTEM",
    name: "Интеграция со школьным журналом",
    description: "Передача посещаемости и прогресса в школьную информационную систему.",
    status: "ACTIVE",
    endpoint: "https://school.example.local/api/journal-sync",
    notes: "Тестовый канал обмена с ежедневной синхронизацией.",
    lastSyncAt: new Date("2026-04-06T09:00:00.000Z"),
  });

  await ensureIntegrationConnection({
    type: "EDUCATION_PLATFORM",
    name: "Онлайн-платформа домашних заданий",
    description: "Обмен домашними заданиями и прогрессом между CRM и LMS.",
    status: "PLANNED",
    endpoint: "https://lms.example.local/api/v1",
    notes: "Следующий этап развития после MVP.",
    lastSyncAt: null,
  });

  await ensureIntegrationConnection({
    type: "SUBSIDY_PROGRAM",
    name: "Реестр субсидий",
    description: "Проверка права на участие в программах льготного обучения.",
    status: "PAUSED",
    endpoint: "https://subsidy.example.local/api/check",
    notes: "Ожидается согласование формата обмена.",
    lastSyncAt: new Date("2026-03-30T11:30:00.000Z"),
  });

  await ensureNotification({
    userId: parent.id,
    title: "Добро пожаловать в CRM образовательного центра",
    message:
      "Тестовые данные готовы. Можно просматривать курсы, электронный журнал, рекомендации, расписание занятий, посещаемость и оплаты.",
    type: "SYSTEM",
    channel: "IN_APP",
  });

  await ensureFeedbackThread({
    subject: "Обратная связь по занятию",
    parentId: parent.id,
    staffId: teacherMaksim.id,
    childId: childOne.id,
    messages: [
      {
        senderId: parent.id,
        body: "Подскажите, пожалуйста, можно ли добавить больше творческих заданий домой после занятия?",
      },
      {
        senderId: teacherMaksim.id,
        body: "Да, конечно. Мы подготовим дополнительные материалы и отправим рекомендации после следующего урока.",
      },
    ],
  });

  console.log("Seed завершён:");
  console.log("ADMIN  admin@kidscrm.local   ", env.seed.adminPassword);
  console.log("TEACHER irina@kidscrm.local  ", env.seed.teacherPassword);
  console.log("TEACHER maksim@kidscrm.local ", env.seed.teacherPassword);
  console.log("PARENT parent@kidscrm.local ", env.seed.parentPassword);
  console.log("PARENT parent2@kidscrm.local", env.seed.parentPassword);
  console.log(
    "Тестовые дети:",
    childOne.fullName,
    ",",
    childTwo.fullName,
    ",",
    childThree.fullName,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

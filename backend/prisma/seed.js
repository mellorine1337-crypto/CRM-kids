const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { env } = require("../src/config/env");

const prisma = new PrismaClient();

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
  teacherName,
  price,
  createdBy,
}) => {
  const existingLesson = await prisma.lesson.findFirst({
    where: {
      title,
      date,
      startTime,
    },
  });

  if (existingLesson) {
    return existingLesson;
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
      teacherName,
      price: price.toFixed(2),
      createdBy,
    },
  });
};

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
  const staff = await upsertUser({
    fullName: "Sergey Staff",
    email: "staff@kidscrm.local",
    phone: "+77001000001",
    password: env.seed.staffPassword,
    role: "STAFF",
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
    date: new Date("2026-04-10T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:00",
    capacity: 12,
    teacherName: "Irina Volkova",
    price: 5500,
    createdBy: staff.id,
  });

  const lessonTwo = await ensureLesson({
    title: "Юная робототехника",
    description: "Практические основы робототехники для дошкольников",
    ageMin: 6,
    ageMax: 10,
    date: new Date("2026-04-12T00:00:00.000Z"),
    startTime: "14:00",
    endTime: "15:30",
    capacity: 10,
    teacherName: "Maksim Lee",
    price: 7500,
    createdBy: staff.id,
  });

  const lessonThree = await ensureLesson({
    title: "Академическое чтение",
    description: "Развитие чтения, понимания текста и словарного запаса",
    ageMin: 6,
    ageMax: 10,
    date: new Date("2026-04-02T00:00:00.000Z"),
    startTime: "16:00",
    endTime: "17:00",
    capacity: 8,
    teacherName: "Irina Volkova",
    price: 6200,
    createdBy: staff.id,
  });

  const lessonFour = await ensureLesson({
    title: "Логика и математика",
    description: "Логические задачи, счёт и внимательность",
    ageMin: 5,
    ageMax: 9,
    date: new Date("2026-03-29T00:00:00.000Z"),
    startTime: "12:00",
    endTime: "13:00",
    capacity: 10,
    teacherName: "Maksim Lee",
    price: 6800,
    createdBy: staff.id,
  });

  const lessonFive = await ensureLesson({
    title: "Юная робототехника: практика",
    description: "Практика сборки, командная работа и мини-проекты",
    ageMin: 6,
    ageMax: 10,
    date: new Date("2026-04-04T00:00:00.000Z"),
    startTime: "15:00",
    endTime: "16:30",
    capacity: 10,
    teacherName: "Maksim Lee",
    price: 7600,
    createdBy: staff.id,
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

  const existingPayment = await prisma.payment.findFirst({
    where: {
      enrollmentId: enrollmentOne.id,
      status: "SUCCEEDED",
    },
  });

  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        parentId: parent.id,
        enrollmentId: enrollmentOne.id,
        amount: "5500.00",
        currency: "kzt",
        status: "SUCCEEDED",
        stripePaymentIntentId: "mock_pi_seed_success",
        clientSecret: "mock_secret_seed_success",
      },
    });
  }

  const paymentTwo = await prisma.payment.findFirst({
    where: {
      enrollmentId: enrollmentTwo.id,
      status: "SUCCEEDED",
    },
  });

  if (!paymentTwo) {
    await prisma.payment.create({
      data: {
        parentId: parent.id,
        enrollmentId: enrollmentTwo.id,
        amount: "6200.00",
        currency: "kzt",
        status: "SUCCEEDED",
        stripePaymentIntentId: "mock_pi_seed_reading",
        clientSecret: "mock_secret_seed_reading",
      },
    });
  }

  const paymentThree = await prisma.payment.findFirst({
    where: {
      enrollmentId: enrollmentThree.id,
      status: "PENDING",
    },
  });

  if (!paymentThree) {
    await prisma.payment.create({
      data: {
        parentId: parent.id,
        enrollmentId: enrollmentThree.id,
        amount: "7500.00",
        currency: "kzt",
        status: "PENDING",
        stripePaymentIntentId: "mock_pi_seed_pending",
        clientSecret: "mock_secret_seed_pending",
      },
    });
  }

  const paymentFour = await prisma.payment.findFirst({
    where: {
      enrollmentId: enrollmentFive.id,
      status: "SUCCEEDED",
    },
  });

  if (!paymentFour) {
    await prisma.payment.create({
      data: {
        parentId: parentTwo.id,
        enrollmentId: enrollmentFive.id,
        amount: "7600.00",
        currency: "kzt",
        status: "SUCCEEDED",
        stripePaymentIntentId: "mock_pi_seed_second_parent",
        clientSecret: "mock_secret_seed_second_parent",
      },
    });
  }

  await ensureAttendance({
    enrollmentId: enrollmentTwo.id,
    markedBy: staff.id,
    status: "PRESENT",
    comment: "Отличная вовлечённость на уроке",
    markedAt: new Date("2026-04-02T17:05:00.000Z"),
  });

  await ensureAttendance({
    enrollmentId: enrollmentFour.id,
    markedBy: staff.id,
    status: "ABSENT",
    comment: "Пропуск без предупреждения",
    markedAt: new Date("2026-03-29T13:10:00.000Z"),
  });

  await ensureAttendance({
    enrollmentId: enrollmentFive.id,
    markedBy: staff.id,
    status: "PRESENT",
    comment: "Уверенное участие на всём занятии",
    markedAt: new Date("2026-04-12T15:35:00.000Z"),
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentTwo.id,
    createdBy: staff.id,
    updatedBy: staff.id,
    topicSummary: "Отрабатывали чтение коротких текстов и пересказ по ключевым словам.",
    homeworkTitle: "Прочитать рассказ и выписать новые слова",
    homeworkDescription:
      "Прочитать материал дома, выписать 5 новых слов и составить с ними предложения.",
    homeworkDueDate: new Date("2026-04-05T18:00:00.000Z"),
    homeworkStatus: "REVIEWED",
    score: 92,
    progressLevel: "EXCELLENT",
    teacherComment: "Арман хорошо удерживает внимание и быстро схватывает новые правила.",
    parentComment: "Дома самостоятельно выполнил всё задание.",
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentFour.id,
    createdBy: staff.id,
    updatedBy: staff.id,
    topicSummary: "Разбирали логические цепочки, устный счёт и задачи на внимание.",
    homeworkTitle: "Карточки на счёт и логические пары",
    homeworkDescription:
      "Повторить примеры на счёт и решить 6 коротких задач на логические последовательности.",
    homeworkDueDate: new Date("2026-03-31T18:00:00.000Z"),
    homeworkStatus: "OVERDUE",
    score: 58,
    progressLevel: "ATTENTION_REQUIRED",
    teacherComment:
      "После нескольких пропусков материал усваивается неравномерно. Нужна регулярность и дополнительная поддержка.",
    parentComment: "Просим дать короткий план, чтобы наверстать дома.",
  });

  await ensureJournalEntry({
    enrollmentId: enrollmentFive.id,
    createdBy: staff.id,
    updatedBy: staff.id,
    topicSummary: "Собирали простую модель и учились программировать последовательность действий.",
    homeworkTitle: "Собрать мини-проект по инструкции",
    homeworkDescription:
      "Повторить алгоритм сборки дома и подготовить 2 идеи, как улучшить конструкцию.",
    homeworkDueDate: new Date("2026-04-14T18:00:00.000Z"),
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
    staffId: staff.id,
    childId: childOne.id,
    messages: [
      {
        senderId: parent.id,
        body: "Подскажите, пожалуйста, можно ли добавить больше творческих заданий домой после занятия?",
      },
      {
        senderId: staff.id,
        body: "Да, конечно. Мы подготовим дополнительные материалы и отправим рекомендации после следующего урока.",
      },
    ],
  });

  console.log("Seed завершён:");
  console.log("STAFF  staff@kidscrm.local  ", env.seed.staffPassword);
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

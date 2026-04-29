const { calculateAge } = require("./date");
const {
  buildChildFinancials,
  buildEnrollmentFinancials,
} = require("../lib/finance");

const serializeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const serializeChild = (child) => ({
  id: child.id,
  parentId: child.parentId,
  fullName: child.fullName,
  birthDate: child.birthDate,
  age: calculateAge(child.birthDate),
  gender: child.gender,
  medicalNotes: child.medicalNotes,
  profileImageUrl: child.profileImageUrl,
  createdAt: child.createdAt,
  updatedAt: child.updatedAt,
  parent: child.parent ? serializeUser(child.parent) : undefined,
  financials: child.enrollments ? buildChildFinancials(child) : undefined,
});

const serializeLesson = (lesson) => {
  const bookedCount =
    lesson.enrollments?.filter((item) => item.status !== "CANCELLED").length ?? 0;

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    ageMin: lesson.ageMin,
    ageMax: lesson.ageMax,
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    capacity: lesson.capacity,
    teacherName: lesson.teacherName,
    price: Number(lesson.price),
    createdBy: lesson.createdBy,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    availableSpots: Math.max(lesson.capacity - bookedCount, 0),
    creator: lesson.creator ? serializeUser(lesson.creator) : undefined,
  };
};

const serializeEnrollment = (enrollment) => ({
  id: enrollment.id,
  childId: enrollment.childId,
  lessonId: enrollment.lessonId,
  status: enrollment.status,
  createdAt: enrollment.createdAt,
  updatedAt: enrollment.updatedAt,
  child: enrollment.child ? serializeChild(enrollment.child) : undefined,
  lesson: enrollment.lesson ? serializeLesson(enrollment.lesson) : undefined,
  financials:
    enrollment.lesson || enrollment.payments
      ? buildEnrollmentFinancials(enrollment)
      : undefined,
  payments: enrollment.payments?.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    serviceLabel: payment.serviceLabel,
    comment: payment.comment,
    paidAt: payment.paidAt,
    recordedById: payment.recordedById,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  })),
  attendance: enrollment.attendance
    ? {
        id: enrollment.attendance.id,
        status: enrollment.attendance.status,
        comment: enrollment.attendance.comment,
        markedAt: enrollment.attendance.markedAt,
        markedBy: enrollment.attendance.markedBy,
      }
    : undefined,
  journal: enrollment.journal
    ? {
        id: enrollment.journal.id,
        homeworkStatus: enrollment.journal.homeworkStatus,
        score: enrollment.journal.score,
        progressLevel: enrollment.journal.progressLevel,
        homeworkDueDate: enrollment.journal.homeworkDueDate,
        teacherComment: enrollment.journal.teacherComment,
        parentComment: enrollment.journal.parentComment,
      }
    : undefined,
});

const serializePaymentHistory = (entry) => ({
  id: entry.id,
  paymentId: entry.paymentId,
  fromStatus: entry.fromStatus,
  toStatus: entry.toStatus,
  comment: entry.comment,
  createdAt: entry.createdAt,
  createdBy: entry.createdBy ? serializeUser(entry.createdBy) : undefined,
});

const serializePayment = (payment) => ({
  id: payment.id,
  parentId: payment.parentId,
  enrollmentId: payment.enrollmentId,
  amount: Number(payment.amount),
  currency: payment.currency,
  status: payment.status,
  method: payment.method,
  serviceLabel: payment.serviceLabel,
  comment: payment.comment,
  stripePaymentIntentId: payment.stripePaymentIntentId,
  paidAt: payment.paidAt,
  recordedBy: payment.recordedBy ? serializeUser(payment.recordedBy) : undefined,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  history: payment.history?.map(serializePaymentHistory),
  enrollment: payment.enrollment
    ? {
        id: payment.enrollment.id,
        status: payment.enrollment.status,
        financials: buildEnrollmentFinancials(payment.enrollment),
        child: payment.enrollment.child ? serializeChild(payment.enrollment.child) : undefined,
        lesson: payment.enrollment.lesson ? serializeLesson(payment.enrollment.lesson) : undefined,
      }
    : undefined,
});

const serializeNotification = (notification) => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  channel: notification.channel,
  sentAt: notification.sentAt,
  readAt: notification.readAt,
});

const serializeJournalEntry = (entry) => ({
  id: entry.id,
  enrollmentId: entry.enrollmentId,
  topicSummary: entry.topicSummary,
  homeworkTitle: entry.homeworkTitle,
  homeworkDescription: entry.homeworkDescription,
  homeworkDueDate: entry.homeworkDueDate,
  homeworkStatus: entry.homeworkStatus,
  score: entry.score,
  progressLevel: entry.progressLevel,
  teacherComment: entry.teacherComment,
  parentComment: entry.parentComment,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  creator: entry.creator ? serializeUser(entry.creator) : undefined,
  updater: entry.updater ? serializeUser(entry.updater) : undefined,
  enrollment: entry.enrollment
    ? {
        id: entry.enrollment.id,
        status: entry.enrollment.status,
        createdAt: entry.enrollment.createdAt,
        updatedAt: entry.enrollment.updatedAt,
        child: entry.enrollment.child
          ? serializeChild(entry.enrollment.child)
          : undefined,
        lesson: entry.enrollment.lesson
          ? serializeLesson(entry.enrollment.lesson)
          : undefined,
      }
    : undefined,
});

const serializeIntegrationConnection = (integration) => ({
  id: integration.id,
  type: integration.type,
  name: integration.name,
  description: integration.description,
  status: integration.status,
  endpoint: integration.endpoint,
  notes: integration.notes,
  lastSyncAt: integration.lastSyncAt,
  createdAt: integration.createdAt,
  updatedAt: integration.updatedAt,
});

const serializeFeedbackMessage = (message) => ({
  id: message.id,
  threadId: message.threadId,
  senderId: message.senderId,
  body: message.body,
  readAt: message.readAt,
  createdAt: message.createdAt,
  sender: message.sender ? serializeUser(message.sender) : undefined,
});

const serializeFeedbackThread = (thread) => ({
  id: thread.id,
  subject: thread.subject,
  parentId: thread.parentId,
  staffId: thread.staffId,
  childId: thread.childId,
  lastMessageAt: thread.lastMessageAt,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  parent: thread.parent ? serializeUser(thread.parent) : undefined,
  staff: thread.staff ? serializeUser(thread.staff) : undefined,
  child: thread.child ? serializeChild(thread.child) : undefined,
  latestMessage: thread.latestMessage
    ? serializeFeedbackMessage(thread.latestMessage)
    : thread.messages?.length
      ? serializeFeedbackMessage(thread.messages[thread.messages.length - 1])
      : undefined,
  messages: thread.messages?.map(serializeFeedbackMessage),
});

module.exports = {
  serializeChild,
  serializeEnrollment,
  serializeFeedbackMessage,
  serializeFeedbackThread,
  serializeIntegrationConnection,
  serializeJournalEntry,
  serializeLesson,
  serializeNotification,
  serializePayment,
  serializePaymentHistory,
  serializeUser,
};

// Кратко: собирает персональные рекомендации на основе посещаемости, оплат и журнала.
const average = (items) =>
  items.length ? Math.round(items.reduce((sum, value) => sum + value, 0) / items.length) : 0;

// Служебная функция toRiskLevel: инкапсулирует отдельный шаг логики этого модуля.
const toRiskLevel = (riskScore) => {
  if (riskScore >= 7) {
    return "HIGH";
  }

  if (riskScore >= 4) {
    return "MEDIUM";
  }

  return "LOW";
};

// Функция buildChildRecommendations: собирает итоговую структуру или вычисляемое значение.
const buildChildRecommendations = ({ child, enrollments }) => {
  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.status !== "CANCELLED",
  );
  const attendedCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === "ATTENDED",
  ).length;
  const missedCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === "MISSED",
  ).length;
  const reviewableEnrollments = activeEnrollments.filter(
    (enrollment) =>
      enrollment.status === "ATTENDED" || enrollment.status === "MISSED",
  );
  const attendanceRate = reviewableEnrollments.length
    ? Math.round((attendedCount / reviewableEnrollments.length) * 100)
    : 100;

  const scores = activeEnrollments
    .map((enrollment) => enrollment.journal?.score)
    .filter((score) => typeof score === "number");
  const averageScore = average(scores);

  const attentionFlags = activeEnrollments.filter(
    (enrollment) => enrollment.journal?.progressLevel === "ATTENTION_REQUIRED",
  ).length;
  const overdueHomeworkCount = activeEnrollments.filter(
    (enrollment) => enrollment.journal?.homeworkStatus === "OVERDUE",
  ).length;
  const unpaidCount = activeEnrollments.filter(
    (enrollment) =>
      !enrollment.payments?.some((payment) => payment.status === "SUCCEEDED"),
  ).length;

  const recommendations = [];

  if (attendanceRate < 75 || missedCount >= 2) {
    recommendations.push({
      type: "ATTENDANCE_SUPPORT",
      title: "Нужно стабилизировать посещаемость",
      description:
        "У ребёнка снизилась регулярность посещения. Стоит обсудить удобное расписание и напомнить о важности стабильных занятий.",
      priority: "high",
    });
  }

  if (averageScore > 0 && averageScore < 70) {
    recommendations.push({
      type: "ACADEMIC_SUPPORT",
      title: "Рекомендуется дополнительная поддержка",
      description:
        "Средний результат по занятиям ниже целевого уровня. Подойдут дополнительные упражнения и индивидуальная обратная связь от преподавателя.",
      priority: "high",
    });
  }

  if (attentionFlags > 0 || overdueHomeworkCount > 0) {
    recommendations.push({
      type: "HOMEWORK_FOCUS",
      title: "Нужно усилить работу с домашними заданиями",
      description:
        "Есть признаки, что ребёнку требуется больше внимания к выполнению заданий и закреплению тем после уроков.",
      priority: "medium",
    });
  }

  if (averageScore >= 85 && attendanceRate >= 85) {
    recommendations.push({
      type: "ADVANCED_TRACK",
      title: "Можно предложить продвинутый трек",
      description:
        "Ребёнок показывает высокие результаты и стабильное посещение. Подходит дополнительный курс или более сложные задания.",
      priority: "medium",
    });
  }

  if (unpaidCount > 0) {
    recommendations.push({
      type: "PAYMENT_FOLLOW_UP",
      title: "Есть неоплаченные записи",
      description:
        "Часть занятий ещё не оплачена. Стоит заранее напомнить родителю, чтобы не было паузы в обучении.",
      priority: "low",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      type: "STABLE_PROGRESS",
      title: "Обучение идёт стабильно",
      description:
        "По текущим данным ребёнок проходит программу без явных рисков. Рекомендуется сохранять текущий темп.",
      priority: "low",
    });
  }

  const riskScore =
    (attendanceRate < 60 ? 4 : attendanceRate < 75 ? 2 : 0) +
    (averageScore > 0 && averageScore < 70 ? 3 : 0) +
    missedCount * 2 +
    overdueHomeworkCount * 2 +
    attentionFlags * 2 +
    unpaidCount;

  return {
    child,
    metrics: {
      attendanceRate,
      averageScore,
      attendedCount,
      missedCount,
      overdueHomeworkCount,
      unpaidCount,
      attentionFlags,
    },
    riskScore,
    riskLevel: toRiskLevel(riskScore),
    recommendations,
  };
};

module.exports = { buildChildRecommendations, toRiskLevel };

// Кратко: помогает раскрашивать и сортировать уведомления по смыслу и приоритету.
const HIGH_PRIORITY_TYPES = new Set(["CLASS_CANCELLED"]);

// Функция resolveNotificationPriority: определяет итоговое значение по входным данным.
export const resolveNotificationPriority = (notification) => {
  const content = `${notification.title || ""} ${notification.message || ""}`.toLowerCase();

  if (
    HIGH_PRIORITY_TYPES.has(notification.type) ||
    /долг|задолж|пропуск|отсутств|отмена|cancel|debt|missed/.test(content)
  ) {
    return "high";
  }

  if (
    /ответ|reply|комментар|comment|оплат|payment|запись|booking/.test(content) ||
    ["PAYMENT_CONFIRMED", "ENROLLMENT_CONFIRMED"].includes(notification.type)
  ) {
    return "medium";
  }

  return "normal";
};

const HIGH_PRIORITY_TYPES = new Set(["CLASS_CANCELLED"]);

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

const resolveLesson = (input) => (input?.lesson ? input.lesson : input);

export const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getLessonDateTime = (input) => {
  const lesson = resolveLesson(input);

  if (!lesson?.date) {
    return new Date(0);
  }

  const date = new Date(lesson.date);
  const [hours = "0", minutes = "0"] = String(lesson.startTime || "00:00").split(":");
  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return date;
};

export const compareLessonDateTime = (left, right) =>
  getLessonDateTime(left) - getLessonDateTime(right);

export const isSameCalendarDay = (left, right) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

export const isTodayLesson = (input) =>
  isSameCalendarDay(getLessonDateTime(input), new Date());

export const isFutureOrTodayLesson = (input, from = new Date()) =>
  getLessonDateTime(input).getTime() >= startOfDay(from).getTime();

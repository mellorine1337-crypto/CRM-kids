// Кратко: служебная логика для календаря, интервалов и группировки занятий по датам.
const resolveLesson = (input) => (input?.lesson ? input.lesson : input);

export const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Функция getLessonDateTime: возвращает значение или подготовленные данные по входным параметрам.
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

// Функция compareLessonDateTime: сравнивает значения для сортировки или выбора.
export const compareLessonDateTime = (left, right) =>
  getLessonDateTime(left) - getLessonDateTime(right);

// Функция isSameCalendarDay: проверяет условие и возвращает логический результат.
export const isSameCalendarDay = (left, right) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

// Функция isTodayLesson: проверяет условие и возвращает логический результат.
export const isTodayLesson = (input) =>
  isSameCalendarDay(getLessonDateTime(input), new Date());

export const isFutureOrTodayLesson = (input, from = new Date()) =>
  getLessonDateTime(input).getTime() >= startOfDay(from).getTime();

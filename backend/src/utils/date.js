// Кратко: хранит общие функции работы с датами и возрастом ребёнка.
const calculateAge = (birthDate) => {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
};

// Служебная функция toDateOnly: инкапсулирует отдельный шаг логики этого модуля.
const toDateOnly = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

module.exports = { calculateAge, toDateOnly };

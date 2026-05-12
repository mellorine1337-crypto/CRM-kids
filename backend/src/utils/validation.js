// Кратко: описывает общие схемы валидации email, телефона, имени и пароля.
const { z } = require("zod");

const EMAIL_FORMAT_MESSAGE =
  "Email must contain @ and a domain, for example name@example.com";
const PHONE_REQUIRED_MESSAGE = "Phone number is required";
const PHONE_FORMAT_MESSAGE =
  "Phone number must contain 10 to 15 digits and may start with +";
const PASSWORD_LENGTH_MESSAGE = "Password must contain at least 8 characters";
const PASSWORD_FORMAT_MESSAGE =
  "Password must use only English letters, numbers, and symbols";

// Служебная функция normalizePhone: инкапсулирует отдельный шаг логики этого модуля.
const normalizePhone = (value) => value.trim().replace(/\s+/g, " ");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passwordPattern = /^[\x21-\x7E]+$/;

// Функция isValidPhone: проверяет условие и возвращает логический результат.
const isValidPhone = (value) => {
  const trimmedValue = normalizePhone(value);

  if (!/^\+?[0-9()\-\s]+$/.test(trimmedValue)) {
    return false;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const fullNameSchema = z.string().trim().min(2).max(120);

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .refine((value) => emailPattern.test(value), EMAIL_FORMAT_MESSAGE);

const phoneSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizePhone(value) : value),
  z
    .string()
    .min(1, PHONE_REQUIRED_MESSAGE)
    .refine(isValidPhone, PHONE_FORMAT_MESSAGE),
);

const optionalPhoneSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = normalizePhone(value);
      return normalizedValue === "" ? null : normalizedValue;
    }

    return value;
  },
  z.string().refine(isValidPhone, PHONE_FORMAT_MESSAGE).nullable().optional(),
);

const passwordSchema = z
  .string()
  .min(8, PASSWORD_LENGTH_MESSAGE)
  .max(128)
  .refine((value) => passwordPattern.test(value), PASSWORD_FORMAT_MESSAGE);

module.exports = {
  emailSchema,
  fullNameSchema,
  optionalPhoneSchema,
  passwordSchema,
  phoneSchema,
};

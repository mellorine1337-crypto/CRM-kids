// Кратко: генерирует и проверяет access/refresh/JWT и QR-токены проекта.
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

// Функция hashToken: хэширует значение перед сохранением или сравнением.
const hashToken = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

// Функция signAccessToken: подписывает и возвращает токен.
const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      jti: crypto.randomUUID(),
    },
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessTtl,
    },
  );

// Функция signRefreshToken: подписывает и возвращает токен.
const signRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      jti: crypto.randomUUID(),
    },
    env.jwt.refreshSecret,
    {
      expiresIn: `${env.jwt.refreshTtlDays}d`,
    },
  );

// Функция signAttendanceQrToken: подписывает и возвращает токен.
const signAttendanceQrToken = (enrollment) =>
  jwt.sign(
    {
      sub: enrollment.id,
      type: "attendance_qr",
      childId: enrollment.childId,
      lessonId: enrollment.lessonId,
    },
    env.jwt.attendanceQrSecret,
    {
      expiresIn: `${env.jwt.attendanceQrTtlMinutes}m`,
    },
  );

// Функция verifyAccessToken: проверяет корректность данных или токена.
const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
// Функция verifyRefreshToken: проверяет корректность данных или токена.
const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);
// Функция verifyAttendanceQrToken: проверяет корректность данных или токена.
const verifyAttendanceQrToken = (token) => {
  const payload = jwt.verify(token, env.jwt.attendanceQrSecret);

  if (payload.type !== "attendance_qr") {
    throw new Error("Invalid attendance QR token");
  }

  return payload;
};

// Функция buildTokenPair: собирает итоговую структуру или вычисляемое значение.
const buildTokenPair = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
  expiresIn: env.jwt.accessTtl,
});

module.exports = {
  buildTokenPair,
  hashToken,
  signAttendanceQrToken,
  verifyAccessToken,
  verifyAttendanceQrToken,
  verifyRefreshToken,
};

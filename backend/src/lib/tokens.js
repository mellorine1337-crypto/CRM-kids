const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const hashToken = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  });

const signRefreshToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.refreshSecret, {
    expiresIn: `${env.jwt.refreshTtlDays}d`,
  });

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

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);
const verifyAttendanceQrToken = (token) => {
  const payload = jwt.verify(token, env.jwt.attendanceQrSecret);

  if (payload.type !== "attendance_qr") {
    throw new Error("Invalid attendance QR token");
  }

  return payload;
};

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

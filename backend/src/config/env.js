// Кратко: централизует чтение переменных окружения и даёт проекту единый объект конфигурации.
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "../..");

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/kids_center_crm?schema=public",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    attendanceQrSecret:
      process.env.JWT_ATTENDANCE_QR_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      "dev-attendance-qr-secret",
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 7),
    attendanceQrTtlMinutes: Number(process.env.JWT_ATTENDANCE_QR_TTL_MINUTES || 120),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    currency: (process.env.STRIPE_CURRENCY || "usd").toLowerCase(),
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "noreply@kids-center.local",
  },
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, "uploads"),
  seed: {
    adminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin123!",
    teacherPassword: process.env.SEED_TEACHER_PASSWORD || "Teacher123!",
    parentPassword: process.env.SEED_PARENT_PASSWORD || "Parent123!",
  },
};

module.exports = { env, rootDir };

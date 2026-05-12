// Кратко: создаёт первого администратора в production, если его ещё нет в базе.
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { env } = require("../src/config/env");

const prisma = new PrismaClient();

// Функция getBootstrapAdminConfig: возвращает значение или подготовленные данные по входным параметрам.
const getBootstrapAdminConfig = () => ({
  fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME || "",
  email: process.env.BOOTSTRAP_ADMIN_EMAIL || "",
  phone: process.env.BOOTSTRAP_ADMIN_PHONE || "",
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "",
});

// Служебная функция assertBootstrapConfig: инкапсулирует отдельный шаг логики этого модуля.
const assertBootstrapConfig = (config) => {
  const requiredKeys = ["fullName", "email", "password"];
  return requiredKeys.filter((key) => !config[key]);
};

async function main() {
  const admin = getBootstrapAdminConfig();
  const missingKeys = assertBootstrapConfig(admin);

  if (missingKeys.length) {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      console.log(`Bootstrap admin skipped: existing admin ${existingAdmin.email} already found.`);
      return;
    }

    console.log(
      `Bootstrap admin skipped: missing env vars ${missingKeys.join(", ")}.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(admin.password, 10);

  const savedAdmin = await prisma.user.upsert({
    where: { email: admin.email.toLowerCase() },
    update: {
      fullName: admin.fullName,
      phone: admin.phone || null,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      fullName: admin.fullName,
      email: admin.email.toLowerCase(),
      phone: admin.phone || null,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Bootstrap admin ready: ${savedAdmin.email}`);
}

main()
  .catch((error) => {
    console.error("Bootstrap admin failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

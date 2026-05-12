// Кратко: отдаёт единый экземпляр Prisma Client для всей backend-части.
const { PrismaClient } = require("@prisma/client");

const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

module.exports = { prisma };

// Кратко: приводит все ошибки API к одному формату ответа и обрабатывает 404.
const { ZodError } = require("zod");

// Служебная функция notFoundHandler: инкапсулирует отдельный шаг логики этого модуля.
const notFoundHandler = (_req, _res, next) => {
  next({ status: 404, message: "Route not found" });
};

// Служебная функция errorHandler: инкапсулирует отдельный шаг логики этого модуля.
const errorHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      details: error.issues,
    });
  }

  if (error.code === "P2002") {
    return res.status(409).json({
      message: "Record already exists",
      target: error.meta?.target,
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  const status = error.status || 500;
  const message = error.message || "Internal server error";

  return res.status(status).json({
    message,
    details: error.details || undefined,
  });
};

module.exports = { errorHandler, notFoundHandler };

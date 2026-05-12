// Кратко: собирает Express-приложение, подключает middleware, Swagger, API-роуты и production fallback для frontend.
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const { env } = require("./config/env");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");

const app = express();
const openApiDocument = YAML.load(path.join(__dirname, "../docs/openapi.yaml"));
const isDevelopment = env.nodeEnv !== "production";
const frontendDistDir = path.resolve(__dirname, "../../frontend/dist");
const allowedOrigins = new Set([env.frontendUrl]);
// В dev-режиме разрешаем локальные адреса сети, потому что Vite часто запускается на другом порту или по LAN IP.
const devOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/,
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (isDevelopment && devOriginPatterns.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(env.uploadDir));
// Swagger подключён к тому же Express-приложению, чтобы спецификация API и реальная реализация не расходились.
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/api", routes);

if (!isDevelopment) {
  app.use(express.static(frontendDistDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };

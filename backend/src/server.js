// Кратко: запускает HTTP-сервер и поднимает готовое Express-приложение.
const { app } = require("./app");
const { env } = require("./config/env");

app.listen(env.port, () => {
  console.log(`CRM API запущен на http://localhost:${env.port}`);
});

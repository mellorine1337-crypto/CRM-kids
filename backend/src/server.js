const { app } = require("./app");
const { env } = require("./config/env");

app.listen(env.port, () => {
  console.log(`CRM API listening on http://localhost:${env.port}`);
});

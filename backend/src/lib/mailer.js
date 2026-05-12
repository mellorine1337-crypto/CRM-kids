// Кратко: изолирует отправку email, чтобы маршруты не работали напрямую с SMTP.
const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter;

// Функция getTransporter: возвращает значение или подготовленные данные по входным параметрам.
const getTransporter = async () => {
  if (transporter) {
    return transporter;
  }

  if (env.smtp.host && env.smtp.user) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });

    return transporter;
  }

  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });

  return transporter;
};

// Служебная функция sendMail: инкапсулирует отдельный шаг логики этого модуля.
const sendMail = async ({ to, subject, text, html }) => {
  if (!to) {
    return null;
  }

  const client = await getTransporter();
  const info = await client.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html,
  });

  if (info.message) {
    console.log("Email preview:", info.message.toString());
  }

  return info;
};

module.exports = { sendMail };

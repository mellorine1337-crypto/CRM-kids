const { prisma } = require("./prisma");
const { sendMail } = require("./mailer");

const createNotification = async ({
  userId,
  title,
  message,
  type = "SYSTEM",
  channel = "IN_APP",
  email,
}) => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      channel,
    },
  });

  if (email) {
    await sendMail({
      to: email,
      subject: title,
      text: message,
      html: `<p>${message}</p>`,
    });
  }

  return notification;
};

module.exports = { createNotification };

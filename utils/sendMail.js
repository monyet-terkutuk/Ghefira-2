const Mailjet = require("node-mailjet");

const sendMail = async (options) => {
  const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
  );

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: process.env.MJ_SENDER_EMAIL,
          Name: "Admin",
        },
        To: [
          {
            Email: options.email,
            Name: "Users",
          },
        ],
        Subject: options.subject,
        TextPart: options.messsage,
        HTMLPart:
          '<h3>Dear Users, welcome to our website</h3><br />Please click on the link below to activate your account:<br /><a href="' +
          options.url +
          '">Activate</a>',
      },
    ],
  });

  try {
    const result = await request;
    console.log(result.body);
    return result.body;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

const sendMailForgotPW = async (options) => {
  const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
  );

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: process.env.MJ_SENDER_EMAIL,
          Name: "Admin",
        },
        To: [
          {
            Email: options.email,
            Name: "Users",
          },
        ],
        Subject: options.subject,
        TextPart: options.messsage,
        HTMLPart:
          '<h3>Dear Users, This Email For Reset Your Password</h3><br />Please change your password after login!, your new password is: <b>"' +
          options.password +
          '"</b>',
      },
    ],
  });

  try {
    const result = await request;
    console.log(result.body);
    return result.body;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendMail, sendMailForgotPW };

// utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendResetCodeEmail(to, code) {
  const mailOptions = {
    from: `"Digital Bac" <${process.env.EMAIL_USER}>`,
    to,
    subject: '🔐 رمز إعادة تعيين كلمة السر',
    text: `رمز إعادة تعيين كلمة السر الخاص بك هو: ${code}\n\nينتهي هذا الرمز بعد 15 دقيقة.`,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendResetCodeEmail };

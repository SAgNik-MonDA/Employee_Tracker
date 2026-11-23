const nodemailer = require('nodemailer');
const path = require('path');

// Ensure environment variables are loaded regardless of process launch directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('❌ Email Error: SMTP_USER or SMTP_PASS missing in environment');
      return null;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: `"Employee Tracker" <${user}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${to} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ Email Error for ${to}: ${error.message}`);
    // Don't throw — email failure shouldn't break the main flow
    return null;
  }
};

module.exports = sendEmail;

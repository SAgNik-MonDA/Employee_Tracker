const nodemailer = require('nodemailer');
const path = require('path');
const SystemSettings = require('../models/SystemSettings');

// Ensure environment variables are loaded regardless of process launch directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const resolveSmtpConfig = async () => {
  const envUser = process.env.SMTP_USER?.trim();
  const envPass = process.env.SMTP_PASS?.trim();
  if (envUser && envPass) {
    return {
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: envUser,
      pass: envPass,
    };
  }

  try {
    const setting = await SystemSettings.findOne({ key: 'smtp_credentials' });
    if (setting?.value?.user && setting?.value?.pass) {
      return {
        host: (setting.value.host || 'smtp.gmail.com').trim(),
        port: parseInt(setting.value.port, 10) || 587,
        user: setting.value.user.trim(),
        pass: setting.value.pass.trim(),
      };
    }
  } catch {
    // ignore DB lookup failure if disconnected
  }
  return null;
};

const attemptSend = async (cfg, portOverride, mailOptions) => {
  const port = portOverride || cfg.port;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter.sendMail(mailOptions);
};

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const cfg = await resolveSmtpConfig();
    if (!cfg) {
      console.error('❌ Email Error: SMTP_USER or SMTP_PASS missing in env and SystemSettings');
      return null;
    }

    const mailOptions = {
      from: `"Employee Tracker Enterprise" <${cfg.user}>`,
      to,
      subject,
      html,
      attachments,
    };

    try {
      const info = await attemptSend(cfg, cfg.port, mailOptions);
      console.log(`📧 Email sent successfully to ${to} via port ${cfg.port} (Message ID: ${info.messageId})`);
      return info;
    } catch (primaryErr) {
      // Fallback between STARTTLS (587) and SSL (465) for cloud hosting environments
      const fallbackPort = cfg.port === 465 ? 587 : 465;
      console.warn(`⚠️ Primary SMTP port ${cfg.port} failed for ${to} (${primaryErr.message}). Retrying via port ${fallbackPort}...`);
      const info = await attemptSend(cfg, fallbackPort, mailOptions);
      console.log(`📧 Email sent successfully to ${to} via fallback port ${fallbackPort} (Message ID: ${info.messageId})`);
      return info;
    }
  } catch (error) {
    console.error(`❌ Email Error for ${to}: ${error.message}`);
    // Don't throw — email failure shouldn't break the main API flow
    return null;
  }
};

module.exports = sendEmail;

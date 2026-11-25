const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const SystemSettings = require('../models/SystemSettings');

// Ensure environment variables are loaded regardless of process launch directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_VERCEL_RELAY_URL = 'https://employee-tracker-project.sagnikmondal.in/api/relay-email';

// Single-use 60s relay nonces so the Vercel HTTPS bridge ONLY dispatches mail genuinely authorized by this server
const pendingRelayNonces = new Map();

const purgeExpiredNonces = () => {
  const now = Date.now();
  for (const [k, v] of pendingRelayNonces.entries()) {
    if (v.expiresAt < now) pendingRelayNonces.delete(k);
  }
};

const issueRelayNonce = (to, subject) => {
  purgeExpiredNonces();
  const nonce = crypto.randomBytes(24).toString('hex');
  pendingRelayNonces.set(nonce, {
    to: String(to || '').trim().toLowerCase(),
    subject: String(subject || ''),
    expiresAt: Date.now() + 60000,
  });
  return nonce;
};

const authorizeRelayNonce = (nonce, to, subject) => {
  purgeExpiredNonces();
  if (!nonce || !pendingRelayNonces.has(nonce)) return false;
  const record = pendingRelayNonces.get(nonce);
  pendingRelayNonces.delete(nonce); // Strictly single-use anti-replay
  if (!record || record.expiresAt < Date.now()) return false;
  return (
    record.to === String(to || '').trim().toLowerCase() &&
    record.subject === String(subject || '')
  );
};

let lastDiagnostic = {
  timestamp: null,
  ok: null,
  provider: null,
  error: null,
  to: null,
};

const maskSecret = (val) =>
  val && val.length > 8
    ? `${val.slice(0, 3)}${'•'.repeat(Math.min(12, Math.max(4, val.length - 6)))}${val.slice(-3)}`
    : val
    ? '••••••••'
    : '';

/**
 * Resolves all configured email providers/credentials across CMS DB and environment.
 */
const resolveAllEmailConfigs = async () => {
  let dbProvider = null;
  let dbSmtp = null;

  try {
    const [provDoc, smtpDoc] = await Promise.all([
      SystemSettings.findOne({ key: 'email_provider_config' }).lean(),
      SystemSettings.findOne({ key: 'smtp_credentials' }).lean(),
    ]);
    dbProvider = provDoc?.value || null;
    dbSmtp = smtpDoc?.value || null;
  } catch {
    // ignore DB lookup failure if disconnected
  }

  const smtpCandidates = [];
  const pushSmtp = (src, host, port, user, pass) => {
    if (!user || !pass) return;
    const cleanHost = (host || 'smtp.gmail.com').trim();
    const cleanPort = parseInt(port, 10) || 587;
    const cleanUser = user.trim();
    const cleanPass = pass.trim();
    if (!smtpCandidates.some((c) => c.host === cleanHost && c.port === cleanPort && c.user === cleanUser && c.pass === cleanPass)) {
      smtpCandidates.push({ source: src, host: cleanHost, port: cleanPort, user: cleanUser, pass: cleanPass });
    }
  };

  if (dbSmtp?.updatedViaCMS) {
    pushSmtp('cms', dbSmtp.host, dbSmtp.port, dbSmtp.user, dbSmtp.pass);
    pushSmtp('environment', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_PASS);
  } else {
    pushSmtp('environment', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_PASS);
    if (dbSmtp) pushSmtp('database', dbSmtp.host, dbSmtp.port, dbSmtp.user, dbSmtp.pass);
  }

  // HTTP / Port-443 API transports (never blocked on cloud free tiers like Render)
  const webhookUrl = (dbProvider?.webhookUrl || process.env.EMAIL_WEBHOOK_URL || '').trim();
  const webhookSecret = (dbProvider?.webhookSecret || process.env.EMAIL_WEBHOOK_SECRET || '').trim();
  const brevoApiKey = (dbProvider?.brevoApiKey || process.env.BREVO_API_KEY || '').trim();
  const resendApiKey = (dbProvider?.resendApiKey || process.env.RESEND_API_KEY || '').trim();
  const vercelRelayUrl = (dbProvider?.vercelRelayUrl || process.env.VERCEL_EMAIL_RELAY_URL || DEFAULT_VERCEL_RELAY_URL).trim();
  const fromEmail = (
    dbProvider?.fromEmail ||
    smtpCandidates[0]?.user ||
    process.env.SMTP_USER ||
    'noreply@employeetracker.com'
  ).trim();
  const preferredProvider = dbProvider?.provider || null;

  return {
    preferredProvider,
    fromEmail,
    webhookUrl,
    webhookSecret,
    brevoApiKey,
    resendApiKey,
    vercelRelayUrl,
    smtpCandidates,
  };
};

const toBase64Attachments = (attachments = []) =>
  (attachments || []).map((att) => {
    const buf = Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content || '', att.encoding || 'utf8');
    return {
      filename: att.filename || 'attachment',
      contentBase64: buf.toString('base64'),
      contentType: att.contentType || 'application/octet-stream',
      cid: att.cid || undefined,
    };
  });

const inlineCidImagesForHttp = (html, attachments = []) => {
  let out = html || '';
  for (const att of attachments || []) {
    if (att.cid && att.content) {
      const b64 = Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : Buffer.from(att.content).toString('base64');
      const mime = att.contentType || 'image/png';
      out = out.split(`cid:${att.cid}`).join(`data:${mime};base64,${b64}`);
    }
  }
  return out;
};

const sendViaVercelBridge = async ({ vercelRelayUrl, smtpCfg, to, subject, html, attachments }) => {
  const nonce = issueRelayNonce(to, subject);
  try {
    const res = await fetch(vercelRelayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        smtp: {
          host: smtpCfg.host,
          port: smtpCfg.port,
          user: smtpCfg.user,
          pass: smtpCfg.pass,
        },
        mail: {
          fromName: 'Employee Tracker Enterprise',
          to,
          subject,
          html,
          attachments: toBase64Attachments(attachments),
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      pendingRelayNonces.delete(nonce);
      throw new Error(data?.error || `Vercel relay HTTP ${res.status}`);
    }
    return {
      messageId: data.messageId || `vercel-${Date.now()}`,
      provider: data.provider || 'vercel-smtp',
      accepted: [to],
    };
  } catch (err) {
    pendingRelayNonces.delete(nonce);
    throw err;
  }
};

const sendViaWebhook = async ({ webhookUrl, webhookSecret, fromEmail, to, subject, html, attachments }) => {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: webhookSecret || undefined,
      fromName: 'Employee Tracker Enterprise',
      fromEmail,
      to,
      subject,
      html,
      attachments: toBase64Attachments(attachments),
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook HTTP ${res.status}: ${text.slice(0, 180)}`);
  }
  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // plain text fallback
  }
  if (parsed.ok === false || parsed.error) {
    throw new Error(parsed.error || 'Webhook reported delivery failure');
  }
  return { messageId: parsed.messageId || `webhook-${Date.now()}`, accepted: [to] };
};

const sendViaBrevo = async ({ brevoApiKey, fromEmail, to, subject, html, attachments }) => {
  const nonCidAttachments = (attachments || [])
    .filter((a) => !a.cid)
    .map((att) => ({
      name: att.filename || 'document.pdf',
      content: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : Buffer.from(att.content || '').toString('base64'),
    }));

  const payload = {
    sender: { name: 'Employee Tracker Enterprise', email: fromEmail },
    to: [{ email: to }],
    subject,
    htmlContent: inlineCidImagesForHttp(html, attachments),
  };
  if (nonCidAttachments.length > 0) payload.attachment = nonCidAttachments;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo API ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return { messageId: data.messageId || `brevo-${Date.now()}`, accepted: [to] };
};

const sendViaResend = async ({ resendApiKey, fromEmail, to, subject, html, attachments }) => {
  const cleanFrom = fromEmail && !fromEmail.endsWith('@gmail.com')
    ? `Employee Tracker Enterprise <${fromEmail}>`
    : 'Employee Tracker Enterprise <onboarding@resend.dev>';

  const mappedAttachments = (attachments || [])
    .filter((a) => !a.cid)
    .map((att) => ({
      filename: att.filename || 'document.pdf',
      content: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : Buffer.from(att.content || '').toString('base64'),
    }));

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: cleanFrom,
      to: [to],
      subject,
      html: inlineCidImagesForHttp(html, attachments),
      ...(mappedAttachments.length > 0 ? { attachments: mappedAttachments } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend API ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return { messageId: data.id || `resend-${Date.now()}`, accepted: [to] };
};

const attemptSmtpSend = async (cfg, portOverride, mailOptions) => {
  const port = portOverride || cfg.port;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    family: 4, // Force IPv4 to avoid IPv6 ENETUNREACH on cloud containers
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false,
      servername: cfg.host,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });

  return transporter.sendMail(mailOptions);
};

const sendWithDiagnostics = async ({ to, subject, html, attachments = [] }) => {
  const cfg = await resolveAllEmailConfigs();
  const isRender = Boolean(process.env.RENDER);
  const errors = [];

  const tryOrder = [];
  if (cfg.preferredProvider === 'brevo' && cfg.brevoApiKey) tryOrder.push('brevo');
  if (cfg.preferredProvider === 'resend' && cfg.resendApiKey) tryOrder.push('resend');
  if (cfg.preferredProvider === 'webhook' && cfg.webhookUrl) tryOrder.push('webhook');

  if (cfg.webhookUrl && !tryOrder.includes('webhook')) tryOrder.push('webhook');
  if (cfg.brevoApiKey && !tryOrder.includes('brevo')) tryOrder.push('brevo');
  if (cfg.resendApiKey && !tryOrder.includes('resend')) tryOrder.push('resend');

  // On Render Free Tier, outbound SMTP ports 25/465/587 are blocked by firewall -> route via Port-443 Vercel SMTP bridge FIRST
  if (isRender && cfg.smtpCandidates.length > 0 && cfg.vercelRelayUrl) {
    tryOrder.push('vercel-bridge');
  }
  if (cfg.smtpCandidates.length > 0) tryOrder.push('smtp');
  if (!isRender && cfg.smtpCandidates.length > 0 && cfg.vercelRelayUrl) {
    tryOrder.push('vercel-bridge');
  }

  if (tryOrder.length === 0) {
    const errMsg = 'No SMTP credentials or Port-443 email provider configured in env or SystemSettings.';
    lastDiagnostic = { timestamp: new Date(), ok: false, provider: 'none', error: errMsg, to };
    console.error(`❌ Email Error for ${to}: ${errMsg}`);
    return { ok: false, provider: 'none', error: errMsg, info: null };
  }

  for (const transportType of tryOrder) {
    try {
      if (transportType === 'webhook') {
        const info = await sendViaWebhook({
          webhookUrl: cfg.webhookUrl,
          webhookSecret: cfg.webhookSecret,
          fromEmail: cfg.fromEmail,
          to,
          subject,
          html,
          attachments,
        });
        lastDiagnostic = { timestamp: new Date(), ok: true, provider: 'https-webhook', error: null, to };
        console.log(`📧 Email sent via HTTPS Webhook to ${to} (${info.messageId})`);
        return { ok: true, provider: 'https-webhook', error: null, info };
      }

      if (transportType === 'brevo') {
        const info = await sendViaBrevo({
          brevoApiKey: cfg.brevoApiKey,
          fromEmail: cfg.fromEmail,
          to,
          subject,
          html,
          attachments,
        });
        lastDiagnostic = { timestamp: new Date(), ok: true, provider: 'brevo-https', error: null, to };
        console.log(`📧 Email sent via Brevo HTTPS API to ${to} (${info.messageId})`);
        return { ok: true, provider: 'brevo-https', error: null, info };
      }

      if (transportType === 'resend') {
        const info = await sendViaResend({
          resendApiKey: cfg.resendApiKey,
          fromEmail: cfg.fromEmail,
          to,
          subject,
          html,
          attachments,
        });
        lastDiagnostic = { timestamp: new Date(), ok: true, provider: 'resend-https', error: null, to };
        console.log(`📧 Email sent via Resend HTTPS API to ${to} (${info.messageId})`);
        return { ok: true, provider: 'resend-https', error: null, info };
      }

      if (transportType === 'vercel-bridge') {
        for (const smtpCfg of cfg.smtpCandidates) {
          try {
            const info = await sendViaVercelBridge({
              vercelRelayUrl: cfg.vercelRelayUrl,
              smtpCfg,
              to,
              subject,
              html,
              attachments,
            });
            lastDiagnostic = { timestamp: new Date(), ok: true, provider: info.provider, error: null, to };
            console.log(`📧 Email sent via ${info.provider} to ${to} (${info.messageId})`);
            return { ok: true, provider: info.provider, error: null, info };
          } catch (bridgeErr) {
            errors.push(`[vercel-bridge:${smtpCfg.source}] ${bridgeErr.message}`);
            console.warn(`⚠️ Vercel bridge [${smtpCfg.source}] failed for ${to}: ${bridgeErr.message}`);
          }
        }
      }

      if (transportType === 'smtp') {
        for (const smtpCfg of cfg.smtpCandidates) {
          const ports = smtpCfg.port === 465 ? [465, 587] : [smtpCfg.port, 465];
          const mailOptions = {
            from: `"Employee Tracker Enterprise" <${smtpCfg.user}>`,
            to,
            subject,
            html,
            attachments,
          };

          for (const port of ports) {
            try {
              const info = await attemptSmtpSend(smtpCfg, port, mailOptions);
              const label = `smtp-${smtpCfg.source}:${port}`;
              lastDiagnostic = { timestamp: new Date(), ok: true, provider: label, error: null, to };
              console.log(`📧 Email sent to ${to} via ${label} (${info.messageId})`);
              return { ok: true, provider: label, error: null, info };
            } catch (portErr) {
              const hint =
                /timeout/i.test(portErr.message)
                  ? `${portErr.message} (Hint: Render Free Tier blocks outbound SMTP ports 25/465/587)`
                  : portErr.message;
              errors.push(`[${smtpCfg.source}:${port}] ${hint}`);
              console.warn(`⚠️ SMTP [${smtpCfg.source}:${port}] failed for ${to}: ${portErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      errors.push(`[${transportType}] ${err.message}`);
      console.warn(`⚠️ Transport [${transportType}] failed for ${to}: ${err.message}`);
    }
  }

  const combinedErr = errors[0] || 'Email dispatch failed across all configured providers';
  lastDiagnostic = { timestamp: new Date(), ok: false, provider: tryOrder.join(','), error: combinedErr, to };
  console.error(`❌ Email Error for ${to}: ${combinedErr}`);
  return { ok: false, provider: tryOrder.join(','), error: combinedErr, info: null };
};

const sendEmail = async (opts) => {
  try {
    const res = await sendWithDiagnostics(opts);
    return res.info || null;
  } catch (error) {
    console.error(`❌ Email Error for ${opts?.to}: ${error.message}`);
    return null;
  }
};

sendEmail.sendDetailed = sendWithDiagnostics;
sendEmail.authorizeRelayNonce = authorizeRelayNonce;
sendEmail.getLastStatus = () => lastDiagnostic;
sendEmail.getConfigSummary = async () => {
  const cfg = await resolveAllEmailConfigs();
  const primarySmtp = cfg.smtpCandidates[0] || null;
  return {
    preferredProvider:
      cfg.preferredProvider ||
      (cfg.webhookUrl
        ? 'webhook'
        : cfg.brevoApiKey
        ? 'brevo'
        : cfg.resendApiKey
        ? 'resend'
        : process.env.RENDER
        ? 'vercel-smtp-bridge'
        : 'smtp'),
    fromEmail: cfg.fromEmail,
    smtp: primarySmtp
      ? {
          configured: true,
          source: primarySmtp.source,
          host: primarySmtp.host,
          port: primarySmtp.port,
          user: primarySmtp.user,
          maskedPass: maskSecret(primarySmtp.pass),
        }
      : { configured: false },
    httpRelays: {
      vercelBridgeActive: Boolean(cfg.vercelRelayUrl && primarySmtp),
      vercelRelayUrl: cfg.vercelRelayUrl,
      webhookConfigured: Boolean(cfg.webhookUrl),
      webhookUrlPreview: cfg.webhookUrl ? `${cfg.webhookUrl.slice(0, 42)}...` : '',
      brevoConfigured: Boolean(cfg.brevoApiKey),
      brevoMaskedKey: maskSecret(cfg.brevoApiKey),
      resendConfigured: Boolean(cfg.resendApiKey),
      resendMaskedKey: maskSecret(cfg.resendApiKey),
    },
    lastDiagnostic,
  };
};

module.exports = sendEmail;

import nodemailer from 'nodemailer';

const AUTHORIZE_RELAY_URL = 'https://employee-tracker-backend-6t0z.onrender.com/api/subscription/authorize-relay';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nonce, smtp, mail } = body;

    if (!nonce || !smtp?.user || !smtp?.pass || !mail?.to || !mail?.subject) {
      return res.status(400).json({ ok: false, error: 'Missing required relay parameters' });
    }

    // Strictly verify single-use authorization nonce against the trusted Render backend
    const authRes = await fetch(AUTHORIZE_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        to: mail.to,
        subject: mail.subject,
      }),
    });

    const authData = await authRes.json().catch(() => ({}));
    if (!authRes.ok || !authData?.authorized) {
      return res.status(403).json({
        ok: false,
        error: authData?.message || 'Unauthorized email relay nonce',
      });
    }

    const host = (smtp.host || 'smtp.gmail.com').trim();
    const mappedAttachments = (mail.attachments || []).map((att) => ({
      filename: att.filename || 'attachment',
      content: Buffer.from(att.contentBase64 || '', 'base64'),
      contentType: att.contentType || 'application/octet-stream',
      ...(att.cid ? { cid: att.cid } : {}),
    }));

    const mailOptions = {
      from: `"${mail.fromName || 'Employee Tracker Enterprise'}" <${smtp.user.trim()}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html || '',
      attachments: mappedAttachments,
    };

    const portsToTry = [465, 587];
    let lastErr = null;

    for (const port of portsToTry) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          requireTLS: port === 587,
          family: 4,
          auth: {
            user: smtp.user.trim(),
            pass: smtp.pass.trim(),
          },
          tls: {
            rejectUnauthorized: false,
            servername: host,
          },
          connectionTimeout: 9000,
          greetingTimeout: 9000,
          socketTimeout: 14000,
        });

        const info = await transporter.sendMail(mailOptions);
        return res.status(200).json({
          ok: true,
          provider: `vercel-smtp:${port}`,
          messageId: info.messageId,
        });
      } catch (err) {
        lastErr = err;
      }
    }

    return res.status(502).json({
      ok: false,
      error: lastErr?.message || 'Vercel SMTP dispatch failed',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal relay error',
    });
  }
}

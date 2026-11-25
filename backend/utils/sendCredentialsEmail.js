const sendEmail = require('./sendEmail');
const {
  generateQrToken,
  buildQrPayload,
  generateQrDataUrl,
  generateQrPdf,
} = require('./generateQR');

/**
 * Generates QR token + high-res Credentials PDF Card and sends a responsive
 * enterprise onboarding email to newly created Company Admins or Employees.
 */
const sendCredentialsEmailDetailed = async ({
  user,
  plainPassword,
  portalUrl,
  subscriptionMeta = null, // { planName, price, endDate, razorpayPaymentId } for Admins
}) => {
  try {
    // 1. Ensure permanent QR login token is saved on user
    if (!user.qrLoginToken) {
      user.qrLoginToken = generateQrToken(user._id);
      await user.save({ validateBeforeSave: false });
    }

    const qrPayload = buildQrPayload(user._id, user.qrLoginToken);
    const qrDataUrl = await generateQrDataUrl(qrPayload);
    const qrPngBase64 = qrDataUrl.split(',')[1];
    const qrPngBuffer = Buffer.from(qrPngBase64, 'base64');

    const extraMeta = subscriptionMeta
      ? { companyName: user.companyName, planName: `${subscriptionMeta.planName} (₹${subscriptionMeta.price})` }
      : { companyName: user.companyName };

    const pdfBuffer = await generateQrPdf(user, qrDataUrl, plainPassword, extraMeta);

    const isAdmin = user.role === 'Admin' && Boolean(subscriptionMeta);
    const companyName = user.companyName || 'Employee Tracker Enterprise';
    const basePortalUrl = (portalUrl || process.env.FRONTEND_URL || 'https://employee-tracker-project.sagnikmondal.in').replace(/\/$/, '');
    const loginUrl = `${basePortalUrl}/login`;
    const firstName = user.name ? user.name.split(' ')[0] : 'Team Member';

    const subject = isAdmin
      ? `🎉 Workspace Activated: ${companyName} — Admin Credentials & QR PDF (${user.employeeCode})`
      : `🎉 Welcome to ${companyName} — Your Account Credentials & QR PDF (${user.employeeCode})`;

    const expiryFormatted = subscriptionMeta?.endDate
      ? new Date(subscriptionMeta.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0b1120;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b1120;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background:#0f172a;border-radius:18px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <tr>
                  <td style="background:linear-gradient(135deg,#08252b 0%,#0e4b56 50%,#065f46 100%);padding:36px 32px 30px;border-bottom:2px solid #14b8a6;">
                    <div style="display:inline-block;background:linear-gradient(135deg,#14b8a6,#10b981);color:#ffffff;font-weight:900;font-size:20px;padding:6px 14px;border-radius:10px;letter-spacing:1.5px;margin-bottom:12px;">
                      ET
                    </div>
                    <h1 style="margin:0;font-size:23px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;">
                      EMPLOYEE TRACKER <span style="font-size:12px;padding:3px 8px;border-radius:20px;background:rgba(20,184,166,0.2);color:#5eead4;border:1px solid #14b8a6;vertical-align:middle;">PRO</span>
                    </h1>
                    <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">
                      ${companyName} • ${isAdmin ? 'Enterprise Workspace Activated' : 'Smart Attendance & Statutory Payroll'}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px 28px;">
                    <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#ffffff;">
                      ${isAdmin ? `Welcome Aboard, ${firstName}! 🚀` : `Welcome to the Team, ${user.name}! 👋`}
                    </h2>
                    <p style="color:#94a3b8;margin:0 0 24px;font-size:14px;line-height:1.6;">
                      ${
                        isAdmin
                          ? `Your Razorpay subscription for <strong style="color:#5eead4;">${companyName}</strong> is confirmed and your isolated corporate workspace is ready. Use the credentials or attached PDF badge below to manage employees, shifts, and payroll:`
                          : `Your official employee portal account at <strong style="color:#5eead4;">${companyName}</strong> has been created. Use the credentials below or your attached PDF QR badge for instant workspace access:`
                      }
                    </p>

                    <!-- Credentials Box -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:14px;overflow:hidden;margin-bottom:24px;">
                      <tr>
                        <td style="padding:14px 20px;background:#162032;border-bottom:1px solid #334155;">
                          <span style="font-size:12px;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:1px;">🔐 Access Credentials</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 20px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="color:#94a3b8;font-size:13px;padding:8px 0;width:155px;border-bottom:1px solid rgba(51,65,85,0.6);">Organization</td>
                              <td style="color:#f8fafc;font-weight:700;font-size:14px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">${companyName}</td>
                            </tr>
                            <tr>
                              <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Employee Code</td>
                              <td style="padding:8px 0;font-family:monospace;border-bottom:1px solid rgba(51,65,85,0.6);">
                                <span style="background:rgba(20,184,166,0.15);color:#2dd4bf;font-weight:700;font-size:15px;padding:3px 8px;border-radius:6px;border:1px solid rgba(45,212,191,0.3);">${user.employeeCode}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Work Email</td>
                              <td style="color:#f8fafc;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">${user.email}</td>
                            </tr>
                            <tr>
                              <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Password</td>
                              <td style="color:#fef08a;font-weight:700;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:1.5px;border-bottom:1px solid rgba(51,65,85,0.6);">${plainPassword}</td>
                            </tr>
                            ${
                              isAdmin
                                ? `
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Active Plan</td>
                                  <td style="color:#34d399;font-weight:700;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">${subscriptionMeta.planName} (₹${subscriptionMeta.price})</td>
                                </tr>
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Valid Until</td>
                                  <td style="color:#f8fafc;font-weight:600;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">${expiryFormatted}</td>
                                </tr>
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;">Razorpay Payment ID</td>
                                  <td style="color:#93c5fd;font-family:monospace;font-size:12px;padding:8px 0;">${subscriptionMeta.razorpayPaymentId}</td>
                                </tr>
                              `
                                : `
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">Mediclaim ID</td>
                                  <td style="color:#14b8a6;font-weight:600;font-size:13px;padding:8px 0;font-family:monospace;border-bottom:1px solid rgba(51,65,85,0.6);">${user.mediclaimId || 'Assigned'}</td>
                                </tr>
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.6);">PF Account ID</td>
                                  <td style="color:#fbbf24;font-weight:600;font-size:13px;padding:8px 0;font-family:monospace;border-bottom:1px solid rgba(51,65,85,0.6);">${user.pfId || 'Assigned'}</td>
                                </tr>
                                <tr>
                                  <td style="color:#94a3b8;font-size:13px;padding:8px 0;">Designation / Role</td>
                                  <td style="color:#e2e8f0;font-weight:600;font-size:13px;padding:8px 0;">${user.designation || user.role} (${user.department || 'General'})</td>
                                </tr>
                              `
                            }
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Inline QR Badge (CID attachment renders across Gmail & Outlook) -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:rgba(14,75,86,0.15);border:1px solid rgba(45,212,191,0.3);border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
                      <tr>
                        <td align="center">
                          <div style="display:inline-block;background:#0d9488;color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:10px;">
                            📱 1-Click QR Code Login
                          </div>
                          <p style="color:#94a3b8;font-size:13px;margin:0 0 14px;line-height:1.5;">
                            Scan the QR code below or print your attached PDF badge for instant sign-in:
                          </p>
                          <div style="display:inline-block;background:#ffffff;padding:12px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
                            <img src="cid:qr_badge_image" alt="Login QR Code" width="150" height="150" style="display:block;border-radius:4px;" />
                          </div>
                          <p style="color:#5eead4;font-size:11.5px;font-weight:600;margin:12px 0 0;">
                            📎 Attached: ${user.employeeCode}_Credentials_QR_Card.pdf
                          </p>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d9488 0%,#10b981 100%);color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:12px;font-weight:700;font-size:15px;">
                            🚀 Sign In to Workspace &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 16px;">
                      <p style="color:#fcd34d;font-size:12px;margin:0;line-height:1.5;">
                        ⚠️ <strong>Security Notice:</strong> Please keep your credentials and attached PDF badge secure. You can update your password anytime from <em>Profile &rarr; Security</em>.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="background:#0b1120;padding:20px;text-align:center;border-top:1px solid #1e293b;">
                    <p style="color:#64748b;font-size:12px;margin:0 0 4px;">
                      &copy; ${new Date().getFullYear()} Employee Tracker Pro &bull; Enterprise HR &amp; Accounting System
                    </p>
                    <p style="color:#475569;font-size:11px;margin:0;">
                      Confidential automated corporate notification.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = await sendEmail.sendDetailed({
      to: user.email,
      subject,
      html,
      attachments: [
        {
          filename: 'qr-badge.png',
          content: qrPngBuffer,
          contentType: 'image/png',
          cid: 'qr_badge_image',
        },
        {
          filename: `${user.employeeCode || 'USER'}_Credentials_QR_Card.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return {
      sent: Boolean(result.ok),
      provider: result.provider || '',
      error: result.error || '',
    };
  } catch (err) {
    console.error('❌ sendCredentialsEmail failed:', err.message);
    return { sent: false, provider: '', error: err.message };
  }
};

const sendCredentialsEmail = async (opts) => {
  const res = await sendCredentialsEmailDetailed(opts);
  return res.sent;
};

sendCredentialsEmail.sendDetailed = sendCredentialsEmailDetailed;

module.exports = sendCredentialsEmail;

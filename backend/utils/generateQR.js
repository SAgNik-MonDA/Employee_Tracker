const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const QRCode  = require('qrcode');
const PDFDocument = require('pdfkit');

const getJwtSecret = () => process.env.JWT_SECRET || 'supersecretjwtkey_employeetracker_2026';

// ─────────────────────────────────────────────────────────────────────────────
// Generate a deterministic HMAC-SHA256 token for a given userId
// ─────────────────────────────────────────────────────────────────────────────
const generateQrToken = (userId) => {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(userId.toString())
    .digest('hex');
};

// ─────────────────────────────────────────────────────────────────────────────
// Build the JWT payload that goes inside the QR image
// ─────────────────────────────────────────────────────────────────────────────
const buildQrPayload = (userId, qrToken) => {
  return jwt.sign(
    { sub: userId.toString(), qrToken },
    getJwtSecret()
    // Permanent QR code badge
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate QR code as a data URL (PNG base64)
// ─────────────────────────────────────────────────────────────────────────────
const generateQrDataUrl = async (payload) => {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    width: 400,
    margin: 2,
    color: { dark: '#08252b', light: '#ffffff' },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate a branded PDF containing QR code + login credentials
// Works identically for newly subscribed Company Admins & newly added Employees
// ─────────────────────────────────────────────────────────────────────────────
const generateQrPdf = (user, qrDataUrl, plainPassword, extraMeta = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const companyTitle = user.companyName || extraMeta.companyName || 'Employee Tracker Enterprise';
      const isCompanyAdmin = user.role === 'Admin';

      // ── Header ──────────────────────────────────────────────────────────
      doc
        .rect(0, 0, doc.page.width, 118)
        .fill('#08252b');

      doc
        .fontSize(26)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Employee Tracker Pro', 50, 32, { align: 'center' });

      doc
        .fontSize(11.5)
        .font('Helvetica')
        .fillColor('#5eead4')
        .text(
          isCompanyAdmin
            ? `${companyTitle} — Enterprise Admin Credential Card`
            : `${companyTitle} — Employee Login Credential Card`,
          50,
          68,
          { align: 'center' }
        );

      // ── Welcome Info ────────────────────────────────────────────────────
      const infoY = 142;

      doc
        .fontSize(17)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`Welcome, ${user.name}!`, 50, infoY);

      doc
        .fontSize(10.5)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(
          isCompanyAdmin
            ? 'Your corporate workspace is active. Keep these Administrator credentials and QR badge safe to access your organization dashboard.'
            : 'Your corporate employee account is ready. Use these credentials or scan the QR badge below to sign in instantaneously.',
          50,
          infoY + 26,
          { width: 495 }
        );

      // ── Build Rows dynamically ──────────────────────────────────────────
      const rows = [
        ['Organization:', companyTitle],
        ['Employee Code:', user.employeeCode || 'N/A'],
        ['Email Address:', user.email],
        ['Password:', plainPassword],
        [
          'Role / Designation:',
          `${user.role || 'Employee'}${user.designation ? ` (${user.designation})` : ''}`,
        ],
      ];

      if (extraMeta.planName) {
        rows.push(['Subscription Plan:', extraMeta.planName]);
      } else {
        rows.push(['Mediclaim ID:', user.mediclaimId || 'Assigned']);
        rows.push(['PF Account ID:', user.pfId || 'Assigned']);
      }

      const boxY = infoY + 66;
      const boxHeight = 24 + rows.length * 22;

      doc
        .roundedRect(50, boxY, 495, boxHeight, 8)
        .fillAndStroke('#f1f5f9', '#cbd5e1');

      const labelX = 70;
      const valueX = 225;
      let rowY = boxY + 14;

      rows.forEach(([label, value]) => {
        doc.fontSize(9.5).font('Helvetica').fillColor('#64748b').text(label, labelX, rowY);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(String(value), valueX, rowY, { width: 305 });
        rowY += 22;
      });

      // ── QR Code ─────────────────────────────────────────────────────────
      const qrY = boxY + boxHeight + 22;

      doc
        .fontSize(13.5)
        .font('Helvetica-Bold')
        .fillColor('#08252b')
        .text('Personal 1-Click QR Login Badge', 50, qrY, { align: 'center' });

      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(
          'Scan this QR code on the Sign In modal ("QR Badge" tab) to log in without typing credentials.',
          50,
          qrY + 20,
          { align: 'center', width: 495 }
        );

      const base64Data = qrDataUrl.split(',')[1];
      const qrImageBuffer = Buffer.from(base64Data, 'base64');

      const qrSize = 180;
      const qrX = (doc.page.width - qrSize) / 2;
      doc.image(qrImageBuffer, qrX, qrY + 46, { width: qrSize, height: qrSize });

      // ── Security Footer ─────────────────────────────────────────────────
      const footerY = qrY + 46 + qrSize + 18;

      doc
        .roundedRect(50, footerY, 495, 52, 6)
        .fill('#fef2f2');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#dc2626')
        .text('CONFIDENTIAL SECURITY NOTICE', 65, footerY + 10);

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#991b1b')
        .text(
          'This document contains private corporate credentials and your permanent QR authentication key. Do not share this PDF with unauthorized individuals.',
          65,
          footerY + 24,
          { width: 465 }
        );

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(
          `Generated on ${new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })} • ${companyTitle} • Employee Tracker Enterprise © ${new Date().getFullYear()}`,
          50,
          footerY + 66,
          { align: 'center', width: 495 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateQrToken,
  buildQrPayload,
  generateQrDataUrl,
  generateQrPdf,
};

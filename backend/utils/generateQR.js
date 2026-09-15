const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const QRCode  = require('qrcode');
const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────────────────────────────────────
// Generate a deterministic HMAC-SHA256 token for a given userId
// This token is stored in the DB and embedded (signed) in the QR code
// ─────────────────────────────────────────────────────────────────────────────
const generateQrToken = (userId) => {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(userId.toString())
    .digest('hex');
};

// ─────────────────────────────────────────────────────────────────────────────
// Build the JWT payload that goes inside the QR image
// ─────────────────────────────────────────────────────────────────────────────
const buildQrPayload = (userId, qrToken) => {
  return jwt.sign(
    { sub: userId.toString(), qrToken },
    process.env.JWT_SECRET
    // No expiry — QR code is permanent; session token has its own expiry
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
    color: { dark: '#1e1b4b', light: '#ffffff' },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate a branded PDF containing QR code + credentials
// Returns a Buffer
// ─────────────────────────────────────────────────────────────────────────────
const generateQrPdf = (user, qrDataUrl, plainPassword) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ── Header ──────────────────────────────────────────────────────────
      doc
        .rect(0, 0, doc.page.width, 120)
        .fill('#1e1b4b');

      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Employee Tracker', 50, 35, { align: 'center' });

      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#c7d2fe')
        .text('QR Code Login Credential Card', 50, 72, { align: 'center' });

      // ── Employee Info ───────────────────────────────────────────────────
      const infoY = 150;

      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1e1b4b')
        .text(`Welcome, ${user.name}!`, 50, infoY);

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Your account has been created. Below are your login credentials and your personal QR code for instant login.', 50, infoY + 30, { width: 495 });

      // ── Credentials Box ─────────────────────────────────────────────────
      const boxY = infoY + 75;
      doc
        .roundedRect(50, boxY, 495, 120, 8)
        .fillAndStroke('#f1f5f9', '#cbd5e1');

      const labelX  = 70;
      const valueX  = 220;
      let rowY = boxY + 18;

      const drawRow = (label, value) => {
        doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(label, labelX, rowY);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(value, valueX, rowY);
        rowY += 24;
      };

      drawRow('Employee Code:', user.employeeCode || 'N/A');
      drawRow('Email:', user.email);
      drawRow('Password:', plainPassword);
      drawRow('Role:', user.role || 'Employee');

      // ── QR Code ─────────────────────────────────────────────────────────
      const qrY = boxY + 150;

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1e1b4b')
        .text('Your Personal QR Code', 50, qrY, { align: 'center' });

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Scan this QR code on the login page to instantly access your dashboard — no password needed.', 50, qrY + 22, { align: 'center', width: 495 });

      // Convert data URL to buffer and embed
      const base64Data = qrDataUrl.split(',')[1];
      const qrImageBuffer = Buffer.from(base64Data, 'base64');

      const qrSize = 200;
      const qrX = (doc.page.width - qrSize) / 2;
      doc.image(qrImageBuffer, qrX, qrY + 55, { width: qrSize, height: qrSize });

      // ── Security Footer ─────────────────────────────────────────────────
      const footerY = qrY + 275;

      doc
        .rect(50, footerY, 495, 55)
        .fill('#fef2f2');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#dc2626')
        .text('⚠️  CONFIDENTIAL', 65, footerY + 10);

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#991b1b')
        .text('This document contains your personal login credentials. Do not share this PDF or your QR code with anyone. If compromised, contact your administrator immediately.', 65, footerY + 25, { width: 465 });

      // ── Footer ──────────────────────────────────────────────────────────
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(`Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} • Employee Tracker © ${new Date().getFullYear()}`, 50, footerY + 75, { align: 'center', width: 495 });

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

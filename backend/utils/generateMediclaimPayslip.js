const PDFDocument = require('pdfkit');

/**
 * Generate a professional Mediclaim Settlement Payslip / Voucher as a PDF Buffer
 * @param {Object} request - The withdrawal request document
 * @param {Object} employee - The employee User document
 * @param {Object} reviewer - The Admin/Finance user who approved the request
 * @returns {Promise<Buffer>}
 */
const generateMediclaimPayslip = (request, employee, reviewer = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const primaryColor = '#0f766e'; // Teal / Medical Enterprise
      const darkBg = '#042f2e';
      const textDark = '#0f172a';
      const textMuted = '#475569';
      const cardBg = '#f8fafc';
      const cardBorder = '#e2e8f0';

      // ── Header Banner ──────────────────────────────────────────────────
      doc.rect(0, 0, pageWidth, 110).fill(darkBg);

      // Medical Cross / Shield Icon Accent
      doc.rect(40, 28, 5, 54).fill('#14b8a6');

      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('EMPLOYEE TRACKER ENTERPRISE', 55, 30);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#5eead4')
        .text('MEDICLAIM REIMBURSEMENT & SETTLEMENT PAYSLIP', 55, 58);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#ccfbf1')
        .text('Official Health Fund Disbursement Voucher & Benefit Settlement Record', 55, 76);

      // Right-side voucher info
      const voucherDate = request.updatedAt ? new Date(request.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#99f6e4')
        .text(`Claim ID: ${request.claimId || ('CLM-MED-' + String(request._id).slice(-6).toUpperCase())}`, pageWidth - 220, 36, { align: 'right', width: 180 })
        .text(`Date of Settlement: ${voucherDate}`, pageWidth - 220, 52, { align: 'right', width: 180 })
        .text(`Status: SETTLED & APPROVED`, pageWidth - 220, 68, { align: 'right', width: 180 });

      // ── Employee & Claim Identity Section ──────────────────────────────
      let curY = 130;

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('EMPLOYEE & IDENTIFICATION DETAILS', 40, curY);

      curY += 20;

      // Two Column Information Box
      doc
        .roundedRect(40, curY, pageWidth - 80, 115, 6)
        .fillAndStroke(cardBg, cardBorder);

      const col1X = 55;
      const col2X = 320;
      let rowY = curY + 16;

      const drawInfoRow = (colX, label, value, isHighlight = false) => {
        doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(label, colX, rowY);
        doc
          .fontSize(10)
          .font(isHighlight ? 'Helvetica-Bold' : 'Helvetica-Bold')
          .fillColor(isHighlight ? '#0f766e' : textDark)
          .text(value || '—', colX + 115, rowY, { width: 140 });
      };

      // Row 1
      drawInfoRow(col1X, 'Employee Name:', employee.name);
      drawInfoRow(col2X, 'Mediclaim ID:', employee.mediclaimId || request.mediclaimId || 'Not Assigned', true);
      rowY += 22;

      // Row 2
      drawInfoRow(col1X, 'Employee Code:', employee.employeeCode);
      drawInfoRow(col2X, 'PF Account ID:', employee.pfId || request.pfId || 'Not Assigned', true);
      rowY += 22;

      // Row 3
      drawInfoRow(col1X, 'Department:', employee.department || 'General');
      drawInfoRow(col2X, 'Designation:', employee.designation || employee.role);
      rowY += 22;

      // Row 4
      drawInfoRow(col1X, 'Registered Email:', employee.email);
      drawInfoRow(col2X, 'Disbursement Mode:', 'Direct Bank Transfer / NEFT');

      curY += 135;

      // ── Claim & Medical Details ─────────────────────────────────────────
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('CLAIM MEDICAL PARTICULARS', 40, curY);

      curY += 20;

      doc
        .roundedRect(40, curY, pageWidth - 80, 75, 6)
        .fillAndStroke(cardBg, cardBorder);

      rowY = curY + 16;
      drawInfoRow(col1X, 'Illness / Reason:', request.reason || request.diseaseName || 'Medical Emergency Treatment');
      drawInfoRow(col2X, 'Category / Purpose:', request.purpose || 'Medical Reimbursement');
      rowY += 22;
      drawInfoRow(col1X, 'Request Submitted:', new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }));
      drawInfoRow(col2X, 'Prescription / Bill:', request.attachment ? 'Verified & On File' : 'Not Attached');

      curY += 95;

      // ── Settlement & Financial Breakdown Table ──────────────────────────
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('FINANCIAL SETTLEMENT BREAKDOWN', 40, curY);

      curY += 20;

      const tableX = 40;
      const tableWidth = pageWidth - 80;

      // Table Header
      doc.rect(tableX, curY, tableWidth, 26).fill('#134e4a');
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Component / Description', tableX + 15, curY + 8)
        .text('Amount (INR)', tableX + tableWidth - 140, curY + 8, { align: 'right', width: 125 });

      curY += 26;

      const previousBalance = (request.remainingBalance || 0) + (request.amount || 0);
      const approvedAmount = request.approvedAmount || request.amount || 0;
      const remainingBalance = request.remainingBalance !== undefined ? request.remainingBalance : Math.max(0, (employee.totalMediclaimAccumulated || 0));

      const tableRows = [
        { label: 'Total Accumulated Mediclaim Balance (Prior to Settlement)', amount: `INR ${previousBalance.toLocaleString('en-IN')}`, isDeduction: false },
        { label: 'Requested Medical Reimbursement Amount', amount: `INR ${(request.amount || 0).toLocaleString('en-IN')}`, isDeduction: false },
        { label: 'Approved & Disbursed Claim Amount (Deducted from Fund)', amount: `- INR ${approvedAmount.toLocaleString('en-IN')}`, isDeduction: true },
        { label: 'Net Remaining Accumulated Mediclaim Balance', amount: `INR ${remainingBalance.toLocaleString('en-IN')}`, isTotal: true },
      ];

      tableRows.forEach((row, i) => {
        const rowH = 26;
        const bg = row.isTotal ? '#f0fdfa' : (i % 2 === 0 ? '#ffffff' : '#f8fafc');
        doc.rect(tableX, curY, tableWidth, rowH).fillAndStroke(bg, cardBorder);

        doc
          .fontSize(9.5)
          .font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(row.isTotal ? '#0f766e' : (row.isDeduction ? '#e11d48' : textDark))
          .text(row.label, tableX + 15, curY + 8);

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(row.isTotal ? '#0f766e' : (row.isDeduction ? '#e11d48' : textDark))
          .text(row.amount, tableX + tableWidth - 140, curY + 8, { align: 'right', width: 125 });

        curY += rowH;
      });

      curY += 20;

      // ── Bank Account Verification Box ───────────────────────────────────
      const bank = employee.bankDetails || {};
      doc
        .roundedRect(40, curY, pageWidth - 80, 56, 6)
        .fillAndStroke('#f0fdf4', '#bbf7d0');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#166534')
        .text('BANK DISBURSEMENT DETAILS (CREDITED ACCOUNT)', 55, curY + 10);

      const bankAccMasked = bank.accountNumber ? ('\u2022\u2022\u2022\u2022\u2022\u2022' + bank.accountNumber.slice(-4)) : 'Registered Corporate Salary Account';
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#15803d')
        .text(`Bank: ${bank.bankName || 'Company Payroll Bank'}  |  A/C Holder: ${bank.accountHolderName || employee.name}  |  A/C No: ${bankAccMasked}  |  IFSC: ${bank.ifscCode || 'VERIFIED'}`, 55, curY + 28);

      curY += 75;

      // ── Approval Sign-Off & Seal ────────────────────────────────────────
      const reviewerName = reviewer.name || 'Authorized Finance Officer';
      const reviewerRole = reviewer.role || 'Finance & Accounts Department';

      doc
        .roundedRect(40, curY, 240, 68, 6)
        .fillAndStroke(cardBg, cardBorder);

      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text('Authorized By (Finance / Admin):', 55, curY + 10)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text(reviewerName, 55, curY + 24)
        .font('Helvetica')
        .fillColor(textMuted)
        .text(reviewerRole, 55, curY + 38)
        .text(`Settlement Timestamp: ${new Date().toLocaleString('en-IN')}`, 55, curY + 50);

      // Digital Verification Stamp
      doc
        .roundedRect(pageWidth - 250, curY, 210, 68, 6)
        .fillAndStroke('#f0fdfa', '#5eead4');

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#0f766e')
        .text('DIGITALLY VERIFIED', pageWidth - 235, curY + 12)
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#115e59')
        .text('Employee Tracker Payroll System', pageWidth - 235, curY + 28)
        .text(`Voucher ID: ${request.claimId || request._id}`, pageWidth - 235, curY + 40)
        .text('No physical signature required.', pageWidth - 235, curY + 52);

      // ── Footer ─────────────────────────────────────────────────────────
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('This is a computer-generated Mediclaim settlement payslip and official company record. Confidential & Proprietary.', 40, doc.page.height - 35, { align: 'center', width: pageWidth - 80 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateMediclaimPayslip };

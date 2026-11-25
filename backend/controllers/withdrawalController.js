const crypto = require('crypto');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const { generateMediclaimPayslip } = require('../utils/generateMediclaimPayslip');
const { getTenantId, belongsToTenant, getTenantAdmins } = require('../utils/tenantHelper');

// @desc    Submit a withdrawal request (Mediclaim or PF — tenant-isolated)
// @route   POST /api/withdrawals
// @access  Private
const submitRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { type, amount, reason, diseaseName, purpose, attachment, prescription } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ message: 'Type and amount are required.' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid amount greater than 0.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Ensure user has pfId and mediclaimId
    let userModified = false;
    if (!user.pfId) {
      user.pfId = `PF-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      userModified = true;
    }
    if (!user.mediclaimId) {
      user.mediclaimId = `MED-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      userModified = true;
    }
    if (userModified) {
      await user.save({ validateBeforeSave: false });
    }

    // Check available balance
    if (type === 'PF' && numericAmount > (user.totalPfAccumulated || 0)) {
      return res.status(400).json({
        message: `Requested amount (₹${numericAmount.toLocaleString()}) exceeds your available PF balance (₹${(user.totalPfAccumulated || 0).toLocaleString()}).`
      });
    }
    if (type === 'Mediclaim' && numericAmount > (user.totalMediclaimAccumulated || 0)) {
      return res.status(400).json({
        message: `Requested amount (₹${numericAmount.toLocaleString()}) exceeds your total Mediclaim fund (₹${(user.totalMediclaimAccumulated || 0).toLocaleString()}).`
      });
    }

    const prescriptionAttachment = prescription || attachment || '';

    const newRequest = await WithdrawalRequest.create({
      companyId: tenantId,
      employeeId: req.user._id,
      type,
      amount: numericAmount,
      reason: reason || diseaseName || '',
      diseaseName: diseaseName || reason || '',
      purpose: type === 'Mediclaim' ? (purpose || 'Medical Emergencies') : '',
      attachment: prescriptionAttachment,
      prescription: prescriptionAttachment,
      mediclaimId: user.mediclaimId || '',
      pfId: user.pfId || '',
      status: 'Pending',
    });

    // Notify Admins, HR & Finance team ONLY within this company tenant
    const financeAdmins = await getTenantAdmins(
      tenantId,
      {
        $or: [
          { role: { $in: ['Admin', 'HR', 'Finance', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'] } },
          { department: { $regex: /finance|accounts/i } },
        ],
      },
      '_id'
    );

    const notifDocs = financeAdmins.map((admin) => ({
      companyId: tenantId,
      userId: admin._id,
      type: 'withdrawal_request_submitted',
      title: `🏥 New ${type} Request [${type === 'Mediclaim' ? user.mediclaimId : user.pfId}]`,
      message: `${user.name} (${user.employeeCode}) submitted a ${type} request for ₹${numericAmount.toLocaleString()}. Reason: ${reason || diseaseName || 'Emergency'}.`,
      link: '/admin/withdrawals',
    }));

    if (notifDocs.length > 0) {
      await Notification.insertMany(notifDocs);
    }

    // Emit socket event to this company's finance and admin users
    const io = global.io || req.app.get('io');
    if (io) {
      financeAdmins.forEach((admin) => {
        io.to(`user-${admin._id}`).emit('new-notification', {
          type: 'withdrawal_request_submitted',
          title: `🏥 New ${type} Request [${type === 'Mediclaim' ? user.mediclaimId : user.pfId}]`,
          message: `${user.name} submitted a ${type} request for ₹${numericAmount.toLocaleString()}.`,
          metadata: { id: newRequest._id, claimId: newRequest.claimId }
        });
      });
    }

    res.status(201).json({
      message: `${type} request submitted successfully. It has been forwarded to Finance & Admin for verification.`,
      request: newRequest
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my withdrawal / mediclaim requests
// @route   GET /api/withdrawals/my-requests
// @access  Private
const getMyRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ employeeId: req.user._id })
      .populate('reviewedBy', 'name role designation')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all withdrawal / mediclaim requests (for Admin, HR, Finance — tenant-isolated)
// @route   GET /api/withdrawals/all
// @access  Private (Admin, HR, Finance)
const getAllRequests = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const requests = await WithdrawalRequest.find({ companyId: tenantId })
      .populate('employeeId', 'name email profilePicture designation department employeeCode role pfId mediclaimId totalPfAccumulated totalMediclaimAccumulated bankDetails phone')
      .populate('reviewedBy', 'name role designation employeeCode')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review request (Approve / Reject — tenant-isolated)
// @route   PUT /api/withdrawals/:id/review
// @access  Private (Admin, HR, Finance)
const reviewRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { status, reviewNotes } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    }

    const request = await WithdrawalRequest.findById(req.params.id).populate('employeeId');
    if (!request || !belongsToTenant(request, tenantId)) {
      return res.status(404).json({ message: 'Request record not found in your organization.' });
    }

    if (request.status === 'Approved' || request.status === 'Paid') {
      return res.status(400).json({ message: 'This request has already been approved and settled.' });
    }

    const employee = request.employeeId;
    if (!employee) {
      return res.status(404).json({ message: 'Associated employee not found.' });
    }

    // Ensure employee has Mediclaim and PF IDs
    if (!employee.mediclaimId) {
      employee.mediclaimId = `MED-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    }
    if (!employee.pfId) {
      employee.pfId = `PF-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    }

    if (status === 'Approved') {
      // 1. Balance check & Deduction
      if (request.type === 'Mediclaim') {
        if ((employee.totalMediclaimAccumulated || 0) < request.amount) {
          return res.status(400).json({
            message: `Cannot approve: Employee available Mediclaim balance (₹${(employee.totalMediclaimAccumulated || 0).toLocaleString()}) is less than requested amount (₹${request.amount.toLocaleString()}).`
          });
        }
        // Deduct from total Mediclaim
        employee.totalMediclaimAccumulated -= request.amount;
      } else {
        // PF Deduction
        if ((employee.totalPfAccumulated || 0) < request.amount) {
          return res.status(400).json({
            message: `Cannot approve: Employee available PF balance (₹${(employee.totalPfAccumulated || 0).toLocaleString()}) is less than requested amount (₹${request.amount.toLocaleString()}).`
          });
        }
        employee.totalPfAccumulated -= request.amount;
      }

      await employee.save({ validateBeforeSave: false });

      // 2. Update Request Status and Balances
      request.status = 'Approved';
      request.approvedAmount = request.amount;
      request.remainingBalance = request.type === 'Mediclaim'
        ? employee.totalMediclaimAccumulated
        : employee.totalPfAccumulated;
      request.reviewedBy = req.user._id;
      request.reviewNotes = reviewNotes || `Approved and processed by ${req.user.name} (${req.user.role})`;
      request.mediclaimId = employee.mediclaimId;
      request.pfId = employee.pfId;
      request.settlementSlipGenerated = true;

      // 3. Create Audit Payroll record
      const date = new Date();
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}-WD-${request.type}-${Date.now()}`;
      try {
        const payroll = await Payroll.create({
          companyId: tenantId,
          employeeId: employee._id,
          monthYear,
          type: 'Withdrawal',
          baseSalary: 0,
          bonus: request.amount,
          netSalary: request.amount,
          status: 'Paid',
        });
        request.payrollId = payroll._id;
      } catch (pErr) {
        console.warn('Payroll audit record warning:', pErr.message);
      }

      await request.save();

      // 4. Generate Settlement Payslip PDF and Email it to the Employee
      try {
        const pdfBuffer = await generateMediclaimPayslip(request, employee, req.user);

        const emailHtml = `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <div style="background:linear-gradient(135deg,#0f766e 0%,#042f2e 100%);padding:36px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Mediclaim Reimbursement Approved &amp; Settled</h1>
              <p style="margin:8px 0 0;color:#ccfbf1;font-size:14px;">Official Health Benefit Settlement Voucher Attached</p>
            </div>
            <div style="padding:32px 28px;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#f8fafc;">Hello ${employee.name},</h2>
              <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
                Great news! Your <strong>Mediclaim Reimbursement Claim</strong> (Reference: <code>${request.claimId}</code>) has been approved by the Finance Department. The approved amount has been deducted from your corporate Mediclaim fund and credited to your registered bank account.
              </p>
              <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;font-size:14px;border-collapse:collapse;color:#cbd5e1;">
                  <tr>
                    <td style="padding:6px 0;color:#64748b;">Mediclaim ID:</td>
                    <td style="padding:6px 0;font-weight:bold;color:#14b8a6;text-align:right;">${employee.mediclaimId}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;">PF Account ID:</td>
                    <td style="padding:6px 0;font-weight:bold;color:#f1f5f9;text-align:right;">${employee.pfId}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;">Claim Reason:</td>
                    <td style="padding:6px 0;color:#f1f5f9;text-align:right;">${request.reason || request.diseaseName || 'Medical Emergency'}</td>
                  </tr>
                  <tr style="border-top:1px solid #334155;">
                    <td style="padding:10px 0;font-size:15px;color:#f1f5f9;"><strong>Disbursed Amount:</strong></td>
                    <td style="padding:10px 0;font-size:16px;font-weight:bold;color:#34d399;text-align:right;">INR ${request.amount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;">Remaining Mediclaim Balance:</td>
                    <td style="padding:6px 0;font-weight:bold;color:#38bdf8;text-align:right;">INR ${employee.totalMediclaimAccumulated.toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 20px;">
                📎 <strong>Official Settlement Payslip PDF</strong> has been generated and attached to this email for your tax and insurance records. You can also view or download it anytime from your Employee Profile.
              </p>
              <div style="text-align:center;padding:12px;background:#042f2e;border:1px solid #134e4a;border-radius:8px;">
                <span style="color:#5eead4;font-size:13px;font-weight:600;">Status: Approved &amp; Settled by ${req.user.name} (${req.user.role})</span>
              </div>
            </div>
            <div style="background:#022c22;padding:16px;text-align:center;border-top:1px solid #134e4a;">
              <p style="margin:0;font-size:11px;color:#5eead4;">&copy; 2026 Employee Tracker Enterprise. All Rights Reserved.</p>
            </div>
          </div>
        `;

        sendEmail({
          to: employee.email,
          subject: `🏥 Mediclaim Approved & Settlement Payslip - ${request.claimId}`,
          html: emailHtml,
          attachments: [
            {
              filename: `Mediclaim_Settlement_${request.claimId || request._id}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        }).catch((e) => console.error('Mediclaim Email Send Error:', e));
      } catch (pdfErr) {
        console.error('Settlement PDF generation error:', pdfErr);
      }

      // 5. In-app Notification for Employee
      await Notification.create({
        companyId: tenantId,
        userId: employee._id,
        type: 'withdrawal_status_update',
        title: `✅ ${request.type} Approved & Settled`,
        message: `Your ${request.type} request of ₹${request.amount.toLocaleString()} was approved by Finance. ₹${request.amount.toLocaleString()} has been deducted from your ${request.type} fund. Settlement payslip sent to your email.`,
        link: '/employee/profile',
      });

      // Socket notification to Employee
      const io = global.io || req.app.get('io');
      if (io) {
        io.to(`user-${employee._id}`).emit('new-notification', {
          type: 'withdrawal_status_update',
          title: `✅ ${request.type} Approved & Settled`,
          message: `Your ${request.type} request of ₹${request.amount.toLocaleString()} was approved. Settlement slip emailed.`,
          metadata: { id: request._id, claimId: request.claimId }
        });
      }

      return res.json({
        message: `${request.type} request approved successfully. Amount deducted and settlement payslip emailed to employee.`,
        request
      });
    }

    // ── Rejected Flow ────────────────────────────────────────────────────────
    request.status = 'Rejected';
    request.reviewedBy = req.user._id;
    request.reviewNotes = reviewNotes || 'Rejected by Finance / Admin';
    await request.save();

    // In-app Notification for Employee
    await Notification.create({
      companyId: tenantId,
      userId: employee._id,
      type: 'withdrawal_status_update',
      title: `❌ ${request.type} Request Rejected`,
      message: `Your ${request.type} request of ₹${request.amount.toLocaleString()} was rejected. Reason: ${reviewNotes || 'Does not meet eligibility criteria.'}`,
      link: '/employee/profile',
    });

    // Rejection Email
    sendEmail({
      to: employee.email,
      subject: `❌ ${request.type} Request Status Update - ${request.claimId}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;padding:32px;">
          <h2 style="color:#f43f5e;margin-top:0;">${request.type} Request Rejected</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;">
            Hello ${employee.name}, your ${request.type} claim (ID: <strong>${request.claimId}</strong>) for ₹${request.amount.toLocaleString()} has been reviewed and rejected by the Finance team.
          </p>
          <div style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#fda4af;font-size:13px;"><strong>Reason / Notes:</strong> ${reviewNotes || 'Does not meet internal reimbursement criteria or document missing.'}</p>
          </div>
          <p style="color:#64748b;font-size:12px;">No deduction was made from your balance. For further questions, please contact the HR or Finance desk.</p>
        </div>
      `,
    }).catch(() => {});

    // Socket notification
    const io = global.io || req.app.get('io');
    if (io) {
      io.to(`user-${employee._id}`).emit('new-notification', {
        type: 'withdrawal_status_update',
        title: `❌ ${request.type} Request Rejected`,
        message: `Your ${request.type} request for ₹${request.amount.toLocaleString()} was rejected.`,
        metadata: { id: request._id, claimId: request.claimId }
      });
    }

    res.json({ message: `${request.type} request rejected.`, request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Download / Stream Mediclaim Settlement Payslip PDF
// @route   GET /api/withdrawals/:id/payslip
// @access  Private
const downloadSettlementPayslip = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const request = await WithdrawalRequest.findById(req.params.id)
      .populate('employeeId')
      .populate('reviewedBy', 'name role designation');

    if (!request || !belongsToTenant(request, tenantId)) {
      return res.status(404).json({ message: 'Withdrawal / Mediclaim request not found.' });
    }

    // Permission check: only the employee or authorized admin/finance can download
    const isOwner = request.employeeId?._id?.toString() === req.user._id?.toString();
    const isAuthorized = ['Admin', 'HR', 'Finance', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'].includes(req.user.role);

    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (request.status !== 'Approved' && request.status !== 'Paid') {
      return res.status(400).json({ message: 'Settlement payslip is only available for approved requests.' });
    }

    const employee = request.employeeId;
    const reviewer = request.reviewedBy || {};

    const pdfBuffer = await generateMediclaimPayslip(request, employee, reviewer);

    const filename = `Mediclaim_Settlement_${request.claimId || request._id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate settlement payslip', error: error.message });
  }
};

// @desc    Legacy fallback / Mark as Paid
// @route   POST /api/withdrawals/:id/pay
// @access  Private (Admin, HR, Finance)
const markAsPaid = async (req, res) => {
  return reviewRequest(req, res);
};

module.exports = {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
  markAsPaid,
  downloadSettlementPayslip,
};

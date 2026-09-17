const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

// @desc    Submit a withdrawal request
// @route   POST /api/withdrawals
// @access  Private
const submitRequest = async (req, res) => {
  try {
    const { type, amount, reason, diseaseName, purpose, attachment } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ message: 'Type and amount are required.' });
    }

    const user = await User.findById(req.user._id);
    
    // Check available balance
    if (type === 'PF' && amount > (user.totalPfAccumulated || 0)) {
      return res.status(400).json({ message: 'Requested amount exceeds available PF balance.' });
    }
    if (type === 'Mediclaim' && amount > (user.totalMediclaimAccumulated || 0)) {
      return res.status(400).json({ message: 'Requested amount exceeds available Mediclaim balance.' });
    }

    const newRequest = await WithdrawalRequest.create({
      employeeId: req.user._id,
      type,
      amount,
      reason: type === 'PF' ? reason : '',
      diseaseName: type === 'Mediclaim' ? diseaseName : '',
      purpose: type === 'Mediclaim' ? purpose : '',
      attachment: type === 'Mediclaim' ? attachment : '',
    });

    // Notify Admins
    const admins = await User.find({ role: { $in: ['Admin', 'HR', 'Finance'] } }, '_id');
    const notifDocs = admins.map((admin) => ({
      userId: admin._id,
      type: 'withdrawal_request_submitted',
      title: `New ${type} Withdrawal Request`,
      message: `${user.name} requested ${amount} for ${type}.`,
      link: '/admin/withdrawals',
    }));
    if (notifDocs.length > 0) {
      await Notification.insertMany(notifDocs);
    }
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      admins.forEach(admin => {
        io.to(admin._id.toString()).emit('new-notification', {
          type: 'withdrawal_request_submitted',
          title: `New ${type} Withdrawal Request`,
          message: `${user.name} requested ₹${amount} for ${type}.`
        });
      });
    }

    res.status(201).json({ message: 'Withdrawal request submitted successfully', request: newRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my withdrawal requests
// @route   GET /api/withdrawals/my-requests
// @access  Private
const getMyRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ employeeId: req.user._id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all withdrawal requests
// @route   GET /api/withdrawals/all
// @access  Private (Admin, HR, Finance)
const getAllRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({})
      .populate('employeeId', 'name profilePicture designation employeeCode totalPfAccumulated totalMediclaimAccumulated')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review request (Approve/Reject)
// @route   PUT /api/withdrawals/:id/review
// @access  Private
const reviewRequest = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await WithdrawalRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    request.status = status;
    request.reviewedBy = req.user._id;
    if (reviewNotes !== undefined) request.reviewNotes = reviewNotes;

    await request.save();

    // Notify the employee
    const notif = await Notification.create({
      userId: request.employeeId,
      type: 'withdrawal_status_update',
      title: `${request.type} Request ${status}`,
      message: `Your ${request.type} withdrawal request for ₹${request.amount} has been ${status.toLowerCase()}.`,
      link: '/employee/profile',
    });

    const io = req.app.get('io');
    if (io) {
      io.to(request.employeeId.toString()).emit('new-notification', {
        type: 'withdrawal_status_update',
        title: `${request.type} Request ${status}`,
        message: `Your ${request.type} withdrawal request for ₹${request.amount} has been ${status.toLowerCase()}.`,
        metadata: { id: request._id }
      });
    }

    res.json({ message: `Request ${status.toLowerCase()} successfully`, request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate payslip and Mark as Paid
// @route   POST /api/withdrawals/:id/pay
// @access  Private
const markAsPaid = async (req, res) => {
  try {
    const request = await WithdrawalRequest.findById(req.params.id).populate('employeeId');
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (request.status !== 'Approved') {
      return res.status(400).json({ message: 'Only approved requests can be paid.' });
    }

    const employee = request.employeeId;

    // Deduct from balance
    if (request.type === 'PF') {
      if (employee.totalPfAccumulated < request.amount) {
        return res.status(400).json({ message: 'Insufficient PF balance to disburse.' });
      }
      employee.totalPfAccumulated -= request.amount;
    } else {
      if (employee.totalMediclaimAccumulated < request.amount) {
        return res.status(400).json({ message: 'Insufficient Mediclaim balance to disburse.' });
      }
      employee.totalMediclaimAccumulated -= request.amount;
    }
    await employee.save({ validateBeforeSave: false });

    // Create Payroll record for audit trail
    const date = new Date();
    const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}-WD-${request.type}-${Date.now()}`;
    
    const payroll = await Payroll.create({
      employeeId: employee._id,
      monthYear: monthYear,
      type: 'Withdrawal',
      baseSalary: 0,
      bonus: request.amount,
      netSalary: request.amount,
      status: 'Paid',
    });

    request.payrollId = payroll._id;
    request.status = 'Paid';
    await request.save();

    // Send email (simulate payslip email)
    const emailHtml = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 32px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Disbursement Processed</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Your ${request.type} Withdrawal has been paid.</p>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#c7d2fe;">Hello ${employee.name},</h2>
          <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
            We have successfully processed your ${request.type} withdrawal request. The funds have been transferred to your registered bank account.
          </p>
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:20px;margin-bottom:28px;">
            <ul style="margin:0;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.8;">
              <li><strong>Type:</strong> ${request.type}</li>
              <li><strong>Amount:</strong> ₹${request.amount.toLocaleString()}</li>
              <li><strong>Status:</strong> Paid</li>
            </ul>
          </div>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Please check your bank account or Employee Tracker dashboard for more details.
          </p>
        </div>
      </div>
    `;

    sendEmail({
      to: employee.email,
      subject: `✅ ${request.type} Disbursement Processed: ₹${request.amount}`,
      html: emailHtml,
    });

    res.json({ message: 'Withdrawal marked as Paid successfully', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
  markAsPaid,
};

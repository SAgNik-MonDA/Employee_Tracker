const Leave = require('../models/Leave');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const ANNUAL_LIMITS = { Casual: 24, Emergency: 16 };
const CASUAL_MONTHLY_LIMIT = 2; // max casual days per month

// Helper: safe days value (backward compat for old records without days field)
const safeDays = (leave) =>
  leave.days ||
  Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;

// ─────────────────────────────────────────────
// Shared: compute leave balance for one employee
// ─────────────────────────────────────────────
const computeLeaveBalance = async (employeeId, year) => {
  const targetYear = year || new Date().getFullYear();
  const yearStart = new Date(targetYear, 0, 1);
  const yearEnd   = new Date(targetYear, 11, 31, 23, 59, 59);

  const leaves = await Leave.find({
    employeeId,
    leaveType: { $in: ['Casual', 'Emergency'] },
    status: { $ne: 'Rejected' },
    startDate: { $gte: yearStart, $lte: yearEnd },
  });

  const casualUsed    = leaves.filter((l) => l.leaveType === 'Casual').reduce((s, l) => s + safeDays(l), 0);
  const emergencyUsed = leaves.filter((l) => l.leaveType === 'Emergency').reduce((s, l) => s + safeDays(l), 0);

  return {
    year: targetYear,
    casual: {
      total: ANNUAL_LIMITS.Casual,
      used: casualUsed,
      remaining: Math.max(0, ANNUAL_LIMITS.Casual - casualUsed),
    },
    emergency: {
      total: ANNUAL_LIMITS.Emergency,
      used: emergencyUsed,
      remaining: Math.max(0, ANNUAL_LIMITS.Emergency - emergencyUsed),
    },
  };
};

// ─────────────────────────────────────────────
// @desc    Apply for leave
// @route   POST /api/leaves/apply
// @access  Private (Employee, HR)
// ─────────────────────────────────────────────
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    // Validate inputs
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'All fields (including reason) are required' });
    }

    if (!['Casual', 'Emergency'].includes(leaveType)) {
      return res.status(400).json({ message: 'Leave type must be Casual or Emergency' });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after or equal to start date' });
    }

    if (leaveType === 'Casual') {
      const today = new Date();
      // Calculate difference in whole days
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      const diffDays = Math.round((startDay - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 3) {
        return res.status(400).json({ message: 'Casual leave must be applied at least 3 days in advance.' });
      }
    }

    // Leaves must be within the same calendar month
    if (
      start.getMonth() !== end.getMonth() ||
      start.getFullYear() !== end.getFullYear()
    ) {
      return res.status(400).json({
        message: 'Leave dates must be within the same calendar month',
      });
    }

    const days  = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const year  = start.getFullYear();
    const month = start.getMonth(); // 0-indexed (0 = Jan)

    // ── Annual limit check ────────────────────
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

    const existingThisYear = await Leave.find({
      employeeId: req.user._id,
      leaveType,
      status: { $ne: 'Rejected' },
      startDate: { $gte: yearStart, $lte: yearEnd },
    });

    const annualUsed = existingThisYear.reduce((s, l) => s + safeDays(l), 0);

    if (annualUsed + days > ANNUAL_LIMITS[leaveType]) {
      return res.status(400).json({
        message: `Annual ${leaveType} leave limit exceeded. You have ${
          ANNUAL_LIMITS[leaveType] - annualUsed
        } day(s) remaining this year.`,
      });
    }

    // ── Overlap check ─────────────────────────
    const overlapping = await Leave.findOne({
      employeeId: req.user._id,
      status: { $ne: 'Rejected' },
      startDate: { $lte: end },
      endDate:   { $gte: start },
    });
    if (overlapping) {
      return res.status(400).json({
        message: 'You already have a leave request for overlapping dates',
      });
    }

    // ── Casual: monthly cap (max 2 days/month) ─
    if (leaveType === 'Casual') {
      const monthStart = new Date(year, month, 1);
      const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);

      const casualThisMonth = await Leave.find({
        employeeId: req.user._id,
        leaveType: 'Casual',
        status: { $ne: 'Rejected' },
        startDate: { $gte: monthStart, $lte: monthEnd },
      });

      const monthUsed = casualThisMonth.reduce((s, l) => s + safeDays(l), 0);

      if (monthUsed + days > CASUAL_MONTHLY_LIMIT) {
        return res.status(400).json({
          message: `Monthly Casual leave limit exceeded. You can take only ${
            CASUAL_MONTHLY_LIMIT - monthUsed
          } more Casual day(s) this month (max ${CASUAL_MONTHLY_LIMIT}/month).`,
        });
      }
    }

    // ── Emergency: distribution rule ──────────
    // Distribution: 9 months×1 + 2 months×2 + 1 month×3 = 16 days/year
    // Rules:
    //   - Max 3 emergency days in any one month (absolute)
    //   - At most 1 month can have ≥3 days
    //   - At most 3 months can have ≥2 days (the 2-day months + the 3-day month)
    if (leaveType === 'Emergency') {
      // Build per-month day map from existing leaves this year
      const monthMap = {}; // { monthIndex: totalDaysUsed }
      for (const l of existingThisYear) {
        const m = new Date(l.startDate).getMonth();
        monthMap[m] = (monthMap[m] || 0) + safeDays(l);
      }

      const existingInMonth = monthMap[month] || 0;
      const newTotalInMonth = existingInMonth + days;

      // Rule 1: Absolute max 3 per month
      if (newTotalInMonth > 3) {
        return res.status(400).json({
          message: `Cannot exceed 3 Emergency leave days in one month. You have ${
            3 - existingInMonth
          } day(s) remaining this month.`,
        });
      }

      // Other months' stats (excluding current month)
      const otherEntries = Object.entries(monthMap).filter(([m]) => parseInt(m) !== month);
      const monthsWith3Plus = otherEntries.filter(([, d]) => d >= 3).length;
      const monthsWith2Plus = otherEntries.filter(([, d]) => d >= 2).length;

      // Rule 2: Only 1 month can have ≥3 days
      if (newTotalInMonth >= 3 && monthsWith3Plus >= 1) {
        return res.status(400).json({
          message:
            'Only 1 month per year can have 3 Emergency leave days. That slot is already used.',
        });
      }

      // Rule 3: Only 3 months total can have ≥2 days
      // (= 2 months×2 + 1 month×3); so other months with ≥2 must be < 3
      if (newTotalInMonth >= 2 && monthsWith2Plus >= 3) {
        return res.status(400).json({
          message:
            'Only 3 months per year can have 2+ Emergency leave days. All slots are used.',
        });
      }
    }

    // ── Create the leave ──────────────────────
    const leave = await Leave.create({
      employeeId: req.user._id,
      leaveType,
      startDate: start,
      endDate:   end,
      days,
      reason,
    });

    // Notify all Admin and HR users about the new leave request
    const admins = await User.find({ role: { $in: ['Admin', 'HR'] } }, '_id');
    const notifDocs = admins.map((admin) => ({
      userId: admin._id,
      type: 'leave_applied',
      title: 'New Leave Request',
      message: `${req.user.name} has applied for ${days}-day ${leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
      link: '/admin/leaves',
    }));
    
    if (notifDocs.length > 0) {
      await Promise.all(notifDocs.map(doc => Notification.create(doc)));
    }

    res.status(201).json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get my leaves
// @route   GET /api/leaves/my-leaves
// @access  Private
// ─────────────────────────────────────────────
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.user._id }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get my leave balance for the current year
// @route   GET /api/leaves/my-balance
// @access  Private
// ─────────────────────────────────────────────
const getMyBalance = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const balance = await computeLeaveBalance(req.user._id, year);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all employees' leave balances (Admin / HR)
// @route   GET /api/leaves/all-balances
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getAllBalances = async (req, res) => {
  try {
    const year      = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

    // MongoDB aggregation: sum days per (employee × leaveType)
    const aggregation = await Leave.aggregate([
      {
        $match: {
          leaveType: { $in: ['Casual', 'Emergency'] },
          status:    { $ne: 'Rejected' },
          startDate: { $gte: yearStart, $lte: yearEnd },
        },
      },
      {
        $group: {
          _id: { employeeId: '$employeeId', leaveType: '$leaveType' },
          // Use $days if stored, fallback to date diff
          totalDays: {
            $sum: {
              $cond: [
                { $gt: ['$days', 0] },
                '$days',
                {
                  $add: [
                    {
                      $divide: [
                        { $subtract: ['$endDate', '$startDate'] },
                        1000 * 60 * 60 * 24,
                      ],
                    },
                    1,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    // Build { employeeId: { casualUsed, emergencyUsed } }
    const map = {};
    for (const row of aggregation) {
      const id = row._id.employeeId.toString();
      if (!map[id]) map[id] = { casualUsed: 0, emergencyUsed: 0 };
      if (row._id.leaveType === 'Casual')    map[id].casualUsed    = row.totalDays;
      if (row._id.leaveType === 'Emergency') map[id].emergencyUsed = row.totalDays;
    }

    // Add totals and remaining
    const result = {};
    for (const [id, data] of Object.entries(map)) {
      result[id] = {
        casualUsed:        data.casualUsed,
        casualTotal:       ANNUAL_LIMITS.Casual,
        casualRemaining:   Math.max(0, ANNUAL_LIMITS.Casual - data.casualUsed),
        emergencyUsed:     data.emergencyUsed,
        emergencyTotal:    ANNUAL_LIMITS.Emergency,
        emergencyRemaining: Math.max(0, ANNUAL_LIMITS.Emergency - data.emergencyUsed),
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all leave requests (Admin/HR)
// @route   GET /api/leaves/all-requests
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const leaves = await Leave.find(filter)
      .populate('employeeId', 'name email department designation')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Approve or reject a leave request (Admin ONLY)
// @route   PUT /api/leaves/status/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────
const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    }

    const leave = await Leave.findById(req.params.id).populate('employeeId', 'name email');
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'This leave request has already been processed' });
    }

    leave.status = status;
    await leave.save();

    // Notify the employee about the leave decision
    await Notification.create({
      userId: leave.employeeId._id,
      type:    status === 'Approved' ? 'leave_approved' : 'leave_rejected',
      title:   `Leave ${status}`,
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${status.toLowerCase()}.`,
      link:    '/employee/leaves#leave-history',
    });

    // Send email notification to employee (fire and forget so it doesn't block the API)
    if (leave.employeeId && leave.employeeId.email) {
      sendEmail({
        to:      leave.employeeId.email,
        subject: `Leave Request ${status}`,
        html: `
          <h2>Leave Request ${status}</h2>
          <p>Dear ${leave.employeeId.name},</p>
          <p>Your <strong>${leave.leaveType}</strong> leave request from 
          <strong>${new Date(leave.startDate).toLocaleDateString()}</strong> to 
          <strong>${new Date(leave.endDate).toLocaleDateString()}</strong> 
          has been <strong>${status.toLowerCase()}</strong>.</p>
          <p>Best regards,<br/>HR Team</p>
        `,
      }).catch(() => {}); // don't fail if email fails
    }

    res.json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getMyBalance,
  getAllBalances,
  getAllLeaveRequests,
  updateLeaveStatus,
};

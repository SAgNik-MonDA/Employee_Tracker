const Leave = require('../models/Leave');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const Notification = require('../models/Notification');
const LeaveConfig = require('../models/LeaveConfig');
const SystemSettings = require('../models/SystemSettings');
const { getTenantId, getTenantUserFilter, belongsToTenant, getTenantAdmins } = require('../utils/tenantHelper');

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const FALLBACK_LIMITS = { Casual: 24, Emergency: 16 };
const CASUAL_MONTHLY_LIMIT = 2; // max casual days per month

// Helper: safe days value (backward compat for old records without days field)
const safeDays = (leave) =>
  leave.days ||
  Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;

// Helper: get dynamic limits for an employee based on company tenant + designation + year
const getEmployeeLeaveLimits = async (employeeId, year) => {
  try {
    const user = await User.findById(employeeId);
    if (!user) return FALLBACK_LIMITS;

    const tenantId = getTenantId(user);
    const effectiveDesignation = user.designation && user.designation.trim() !== '' ? user.designation : user.role;
    const dept = user.department || '';

    // Priority 1: Exact Company + Effective Designation + Department
    let config = await LeaveConfig.findOne({ companyId: tenantId, designation: effectiveDesignation, department: dept, year });
    if (config) return { Casual: config.casualLeaves, Emergency: config.emergencyLeaves };

    // Priority 2: Company + Effective Designation + ANY Department
    config = await LeaveConfig.findOne({ companyId: tenantId, designation: effectiveDesignation, year });
    if (config) return { Casual: config.casualLeaves, Emergency: config.emergencyLeaves };

    return FALLBACK_LIMITS;
  } catch {
    return FALLBACK_LIMITS;
  }
};

// Helper: get active leave year for a company tenant
const getGlobalActiveYear = async (tenantId) => {
  try {
    if (tenantId) {
      const setting = await SystemSettings.findOne({ key: `ACTIVE_LEAVE_YEAR_${tenantId.toString()}` });
      if (setting) return parseInt(setting.value);
    }
    return new Date().getFullYear();
  } catch {
    return new Date().getFullYear();
  }
};

// ─────────────────────────────────────────────
// Shared: compute leave balance for one employee
// ─────────────────────────────────────────────
const computeLeaveBalance = async (employeeId, year, tenantId = null) => {
  let effectiveTenant = tenantId;
  if (!effectiveTenant) {
    const u = await User.findById(employeeId).select('companyId _id');
    effectiveTenant = u ? getTenantId(u) : null;
  }
  const targetYear = year || await getGlobalActiveYear(effectiveTenant);
  const yearStart = new Date(targetYear, 0, 1);
  const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

  const leaves = await Leave.find({
    employeeId,
    leaveType: { $in: ['Casual', 'Emergency'] },
    status: { $ne: 'Rejected' },
    startDate: { $gte: yearStart, $lte: yearEnd },
  });

  const casualUsed = leaves.filter((l) => l.leaveType === 'Casual').reduce((s, l) => s + safeDays(l), 0);
  const emergencyUsed = leaves.filter((l) => l.leaveType === 'Emergency').reduce((s, l) => s + safeDays(l), 0);

  const limits = await getEmployeeLeaveLimits(employeeId, targetYear);

  return {
    year: targetYear,
    casual: {
      total: limits.Casual,
      used: casualUsed,
      remaining: Math.max(0, limits.Casual - casualUsed),
    },
    emergency: {
      total: limits.Emergency,
      used: emergencyUsed,
      remaining: Math.max(0, limits.Emergency - emergencyUsed),
    },
  };
};

// ─────────────────────────────────────────────
// @desc    Apply for leave (tenant-isolated)
// @route   POST /api/leaves/apply
// @access  Private (Employee, HR)
// ─────────────────────────────────────────────
const applyLeave = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'All fields (including reason) are required' });
    }

    if (!['Casual', 'Emergency'].includes(leaveType)) {
      return res.status(400).json({ message: 'Leave type must be Casual or Emergency' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after or equal to start date' });
    }

    if (leaveType === 'Emergency') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (start > today) {
        return res.status(400).json({
          message: 'Emergency leave can only be applied after taking the leave (chuti neoyar por). Advance application is not permitted for Emergency leave.',
        });
      }
    } else if (leaveType === 'Casual') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      const diffDays = Math.round((startDay - today) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < 3) {
        return res.status(400).json({
          message: 'Future Casual leave must be applied at least 3 days in advance. For past absences, submit a post-absence leave request subject to attendance penalty rules.',
        });
      }
    }

    const todayForAbsence = new Date();
    todayForAbsence.setHours(23, 59, 59, 999);
    const appliedAfterAbsence = start <= todayForAbsence;

    if (start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
      return res.status(400).json({
        message: 'Leave dates must be within the same calendar month',
      });
    }

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const activeYear = await getGlobalActiveYear(tenantId);
    if (start.getFullYear() !== activeYear) {
      return res.status(400).json({
        message: `You can only apply for leaves in the active leave year: ${activeYear}`,
      });
    }

    const year = start.getFullYear();
    const month = start.getMonth();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const existingThisYear = await Leave.find({
      employeeId: req.user._id,
      leaveType,
      status: { $ne: 'Rejected' },
      startDate: { $gte: yearStart, $lte: yearEnd },
    });

    const annualUsed = existingThisYear.reduce((s, l) => s + safeDays(l), 0);
    const limits = await getEmployeeLeaveLimits(req.user._id, year);

    if (annualUsed + days > limits[leaveType]) {
      return res.status(400).json({
        message: `Annual ${leaveType} leave limit exceeded. You have ${limits[leaveType] - annualUsed} day(s) remaining this year.`,
      });
    }

    const overlapping = await Leave.findOne({
      employeeId: req.user._id,
      status: { $ne: 'Rejected' },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (overlapping) {
      return res.status(400).json({
        message: 'You already have a leave request for overlapping dates',
      });
    }

    if (leaveType === 'Casual') {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      const casualThisMonth = await Leave.find({
        employeeId: req.user._id,
        leaveType: 'Casual',
        status: { $ne: 'Rejected' },
        startDate: { $gte: monthStart, $lte: monthEnd },
      });

      const monthUsed = casualThisMonth.reduce((s, l) => s + safeDays(l), 0);

      if (monthUsed + days > CASUAL_MONTHLY_LIMIT) {
        return res.status(400).json({
          message: `Monthly Casual leave limit exceeded. You can take only ${CASUAL_MONTHLY_LIMIT - monthUsed} more Casual day(s) this month (max ${CASUAL_MONTHLY_LIMIT}/month).`,
        });
      }
    }

    if (leaveType === 'Emergency') {
      const monthMap = {};
      for (const l of existingThisYear) {
        const m = new Date(l.startDate).getMonth();
        monthMap[m] = (monthMap[m] || 0) + safeDays(l);
      }

      const existingInMonth = monthMap[month] || 0;
      const newTotalInMonth = existingInMonth + days;

      if (newTotalInMonth > 3) {
        return res.status(400).json({
          message: `Cannot exceed 3 Emergency leave days in one month. You have ${3 - existingInMonth} day(s) remaining this month.`,
        });
      }

      const otherEntries = Object.entries(monthMap).filter(([m]) => parseInt(m) !== month);
      const monthsWith3Plus = otherEntries.filter(([, d]) => d >= 3).length;
      const monthsWith2Plus = otherEntries.filter(([, d]) => d >= 2).length;

      if (newTotalInMonth >= 3 && monthsWith3Plus >= 1) {
        return res.status(400).json({
          message: 'Only 1 month per year can have 3 Emergency leave days. That slot is already used.',
        });
      }

      if (newTotalInMonth >= 2 && monthsWith2Plus >= 3) {
        return res.status(400).json({
          message: 'Only 3 months per year can have 2+ Emergency leave days. All slots are used.',
        });
      }
    }

    const leave = await Leave.create({
      companyId: tenantId,
      employeeId: req.user._id,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      reason,
      appliedAfterAbsence,
    });

    // Notify ONLY this company's Admin and HR users
    const admins = await getTenantAdmins(tenantId);
    const notifDocs = admins.map((admin) => ({
      companyId: tenantId,
      userId: admin._id,
      type: 'leave_applied',
      title: 'New Leave Request',
      message: `${req.user.name} has applied for ${days}-day ${leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
      link: '/admin/leaves',
    }));

    if (notifDocs.length > 0) {
      await Notification.insertMany(notifDocs).catch(() => {});
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
// @desc    Get my leave balance for the active year
// @route   GET /api/leaves/my-balance
// @access  Private
// ─────────────────────────────────────────────
const getMyBalance = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const activeYear = await getGlobalActiveYear(tenantId);
    const year = parseInt(req.query.year) || activeYear;

    const balance = await computeLeaveBalance(req.user._id, year, tenantId);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all employees' leave balances (Admin / HR — tenant-isolated)
// @route   GET /api/leaves/all-balances
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getAllBalances = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const activeYear = await getGlobalActiveYear(tenantId);
    const year = parseInt(req.query.year) || activeYear;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const users = await User.find(getTenantUserFilter(tenantId)).select('_id designation role department');

    const aggregation = await Leave.aggregate([
      {
        $match: {
          companyId: tenantId,
          leaveType: { $in: ['Casual', 'Emergency'] },
          status: { $ne: 'Rejected' },
          startDate: { $gte: yearStart, $lte: yearEnd },
        },
      },
      {
        $group: {
          _id: { employeeId: '$employeeId', leaveType: '$leaveType' },
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

    const map = {};
    for (const row of aggregation) {
      const id = row._id.employeeId.toString();
      if (!map[id]) map[id] = { casualUsed: 0, emergencyUsed: 0 };
      if (row._id.leaveType === 'Casual') map[id].casualUsed = row.totalDays;
      if (row._id.leaveType === 'Emergency') map[id].emergencyUsed = row.totalDays;
    }

    const configs = await LeaveConfig.find({ companyId: tenantId, year });
    const configMap = {};
    configs.forEach((c) => {
      configMap[`${c.designation}_${c.department}`] = { Casual: c.casualLeaves, Emergency: c.emergencyLeaves };
    });

    const result = {};
    for (const user of users) {
      const id = user._id.toString();
      const usedData = map[id] || { casualUsed: 0, emergencyUsed: 0 };

      const effectiveDesignation = user.designation && user.designation.trim() !== '' ? user.designation : user.role;
      const dept = user.department || '';

      let limits = configMap[`${effectiveDesignation}_${dept}`];
      if (!limits) {
        const fallbackKey = Object.keys(configMap).find((k) => k.startsWith(`${effectiveDesignation}_`));
        limits = fallbackKey ? configMap[fallbackKey] : FALLBACK_LIMITS;
      }

      result[id] = {
        casualUsed: usedData.casualUsed,
        casualTotal: limits.Casual,
        casualRemaining: Math.max(0, limits.Casual - usedData.casualUsed),
        emergencyUsed: usedData.emergencyUsed,
        emergencyTotal: limits.Emergency,
        emergencyRemaining: Math.max(0, limits.Emergency - usedData.emergencyUsed),
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get all leave requests (Admin/HR — tenant-isolated)
// @route   GET /api/leaves/all-requests
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getAllLeaveRequests = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { status } = req.query;
    const filter = { companyId: tenantId };
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
// @desc    Approve or reject a leave request (Admin ONLY — tenant-isolated)
// @route   PUT /api/leaves/status/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────
const updateLeaveStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    }

    const leave = await Leave.findById(req.params.id).populate('employeeId', 'name email companyId');
    if (!leave || !belongsToTenant(leave, tenantId)) {
      return res.status(404).json({ message: 'Leave request not found in your organization' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'This leave request has already been processed' });
    }

    leave.status = status;
    await leave.save();

    await Notification.create({
      companyId: tenantId,
      userId: leave.employeeId._id,
      type: status === 'Approved' ? 'leave_approved' : 'leave_rejected',
      title: `Leave ${status}`,
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${status.toLowerCase()}.`,
      link: '/employee/leaves#leave-history',
    });

    if (leave.employeeId && leave.employeeId.email) {
      sendEmail({
        to: leave.employeeId.email,
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
      }).catch(() => {});
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

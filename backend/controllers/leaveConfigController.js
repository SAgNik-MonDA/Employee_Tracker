const LeaveConfig = require('../models/LeaveConfig');
const SystemSettings = require('../models/SystemSettings');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getTenantId, getTenantUserFilter } = require('../utils/tenantHelper');

const leaveYearKey = (tenantId) => `ACTIVE_LEAVE_YEAR_${tenantId.toString()}`;

// ─────────────────────────────────────────────
// @desc    Get leave configurations for a specific year (tenant-isolated)
// @route   GET /api/leave-configs?year=2026
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getConfigsByYear = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const configs = await LeaveConfig.find({ companyId: tenantId, year }).sort({ designation: 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Upsert a leave configuration for a designation and year (tenant-isolated)
// @route   PUT /api/leave-configs
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const upsertConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { designation, department, year, casualLeaves, emergencyLeaves } = req.body;

    if (!designation || !department || !year) {
      return res.status(400).json({ message: 'Designation, Department, and Year are required' });
    }

    const config = await LeaveConfig.findOneAndUpdate(
      { companyId: tenantId, designation, department, year: parseInt(year) },
      {
        $set: {
          companyId: tenantId,
          casualLeaves: parseInt(casualLeaves) || 0,
          emergencyLeaves: parseInt(emergencyLeaves) || 0,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Notify matching users ONLY within this company
    const users = await User.find({
      ...getTenantUserFilter(tenantId),
      $and: [
        {
          $or: [
            { designation },
            { designation: { $in: [null, ''] }, role: designation },
          ],
        },
      ],
      department,
    }).select('_id');

    if (users.length > 0) {
      const notifications = users.map((user) => ({
        companyId: tenantId,
        userId: user._id,
        type: 'leave_quota_assigned',
        title: 'Leave Quota Assigned',
        message: `Your leave quota for ${year} has been updated. Click to view breakdown.`,
        metadata: {
          casualLeaves: config.casualLeaves,
          emergencyLeaves: config.emergencyLeaves,
          year: config.year,
        },
      }));
      await Notification.insertMany(notifications);
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get Company Settings (Active Leave Year)
// @route   GET /api/settings/leave-year
// @access  Private
// ─────────────────────────────────────────────
const getActiveLeaveYear = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const setting = tenantId
      ? await SystemSettings.findOne({ key: leaveYearKey(tenantId) })
      : null;

    if (setting) {
      return res.json({ activeYear: setting.value });
    }
    return res.json({ activeYear: new Date().getFullYear() });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Set Company Settings (Active Leave Year)
// @route   PUT /api/settings/leave-year
// @access  Private (Admin)
// ─────────────────────────────────────────────
const setActiveLeaveYear = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { year } = req.body;
    if (!year) {
      return res.status(400).json({ message: 'Year is required' });
    }

    const parsedYear = parseInt(year);
    const setting = await SystemSettings.findOneAndUpdate(
      { key: leaveYearKey(tenantId) },
      { $set: { value: parsedYear } },
      { new: true, upsert: true }
    );

    // Emit update scoped only to this company's connected users
    if (global.io) {
      const companyUsers = await User.find(getTenantUserFilter(tenantId)).select('_id').lean();
      companyUsers.forEach((u) => {
        global.io.to(`user-${u._id.toString()}`).emit('settings-updated', {
          type: 'LEAVE_YEAR_UPDATED',
          year: parsedYear,
        });
      });
    }

    res.json({ activeYear: setting.value });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getConfigsByYear,
  upsertConfig,
  getActiveLeaveYear,
  setActiveLeaveYear,
};

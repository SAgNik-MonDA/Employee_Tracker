const ShiftSchedule = require('../models/ShiftSchedule');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Team = require('../models/Team');
const { getTenantId, belongsToTenant } = require('../utils/tenantHelper');

// @desc    Assign a shift (daily or weekly) for an employee (tenant-isolated)
// @route   POST /api/shifts/assign
// @access  Private (Admin, HR, PM, etc.)
const assignShift = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { employeeId, shiftType, dates } = req.body;

    if (!employeeId || !shiftType || !dates || !Array.isArray(dates)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const emp = await User.findById(employeeId).select('companyId _id');
    if (!emp || !belongsToTenant(emp, tenantId)) {
      return res.status(403).json({ message: 'Employee does not belong to your organization' });
    }

    const empTeam = await Team.findOne({ companyId: tenantId, members: employeeId });
    const teamIdToSet = empTeam ? empTeam.teamId : '';

    const updates = dates.map(async (dateStr) => {
      const start = new Date(dateStr + 'T00:00:00.000Z');
      const end = new Date(dateStr + 'T23:59:59.999Z');
      const existing = await ShiftSchedule.findOne({ employeeId, date: { $gte: start, $lte: end } });

      if (existing) {
        if (!existing.companyId) existing.companyId = tenantId;
        if (!existing.isLocked) {
          existing.shiftType = shiftType;
          existing.scheduledBy = req.user._id;
          if (teamIdToSet && !existing.teamId) existing.teamId = teamIdToSet;
          return existing.save();
        }
        if (teamIdToSet && !existing.teamId) {
          existing.teamId = teamIdToSet;
          await existing.save();
        }
        return existing;
      } else {
        return ShiftSchedule.create({
          companyId: tenantId,
          employeeId,
          shiftType,
          date: start,
          scheduledBy: req.user._id,
          teamId: teamIdToSet,
        });
      }
    });

    await Promise.all(updates);

    if (dates.length > 0) {
      const sortedDates = [...dates].sort();
      const firstDate = new Date(sortedDates[0]).toLocaleDateString('en-GB');
      const lastDate = new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString('en-GB');

      await Notification.create({
        companyId: tenantId,
        userId: employeeId,
        type: 'shift_assigned',
        title: 'New Shift Assigned',
        message: `You have been assigned a ${shiftType} shift from ${firstDate} to ${lastDate}.`,
        link: '/employee/shifts',
      });
    }

    res.status(200).json({ message: 'Shift(s) assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Lock a shift schedule (tenant-isolated)
// @route   PUT /api/shifts/lock
// @access  Private (Admin, HR, PM)
const lockShifts = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { employeeId, dates, shiftType = 'General' } = req.body;
    if (!employeeId || !dates || !Array.isArray(dates)) {
      return res.status(400).json({ message: 'Missing employeeId or dates' });
    }

    const emp = await User.findById(employeeId).select('companyId _id');
    if (!emp || !belongsToTenant(emp, tenantId)) {
      return res.status(403).json({ message: 'Employee does not belong to your organization' });
    }

    let modifiedCount = 0;

    for (const d of dates) {
      const start = new Date(d + 'T00:00:00.000Z');
      const end = new Date(d + 'T23:59:59.999Z');

      const existing = await ShiftSchedule.findOne({ employeeId, date: { $gte: start, $lte: end } });
      if (existing) {
        if (!existing.companyId) existing.companyId = tenantId;
        existing.isLocked = true;
        await existing.save();
        modifiedCount++;
      } else {
        await ShiftSchedule.create({
          companyId: tenantId,
          employeeId,
          shiftType,
          date: start,
          isLocked: true,
          scheduledBy: req.user._id,
        });
        modifiedCount++;
      }
    }

    const teams = await Team.find({ companyId: tenantId, members: employeeId });
    for (const t of teams) {
      let changed = false;
      for (const s of (t.shifts || [])) {
        const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
        const sDateStr = new Date(s.date).toISOString().split('T')[0];
        if (sEmp === employeeId.toString() && dates.includes(sDateStr)) {
          s.isLocked = true;
          changed = true;
        }
      }
      if (changed) await t.save();
    }

    res.json({ message: 'Shifts locked successfully', count: modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Unlock a shift schedule (tenant-isolated)
// @route   PUT /api/shifts/unlock
// @access  Private (Admin, HR, PM)
const unlockShifts = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { employeeId, dates } = req.body;
    if (!employeeId || !dates || !Array.isArray(dates)) {
      return res.status(400).json({ message: 'Missing employeeId or dates' });
    }

    const emp = await User.findById(employeeId).select('companyId _id');
    if (!emp || !belongsToTenant(emp, tenantId)) {
      return res.status(403).json({ message: 'Employee does not belong to your organization' });
    }

    let modifiedCount = 0;

    for (const d of dates) {
      const start = new Date(d + 'T00:00:00.000Z');
      const end = new Date(d + 'T23:59:59.999Z');

      const existing = await ShiftSchedule.findOne({ employeeId, date: { $gte: start, $lte: end } });
      if (existing) {
        existing.isLocked = false;
        await existing.save();
        modifiedCount++;
      }
    }

    const teams = await Team.find({ companyId: tenantId, members: employeeId });
    for (const t of teams) {
      let changed = false;
      for (const s of (t.shifts || [])) {
        const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
        const sDateStr = new Date(s.date).toISOString().split('T')[0];
        if (sEmp === employeeId.toString() && dates.includes(sDateStr)) {
          s.isLocked = false;
          changed = true;
        }
      }
      if (changed) await t.save();
    }

    res.json({ message: 'Shifts unlocked successfully', count: modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get shift schedules for an employee within a date range (tenant-isolated)
// @route   GET /api/shifts/:employeeId
// @access  Private
const getShifts = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const emp = await User.findById(req.params.employeeId).select('companyId _id');
    if (!emp || !belongsToTenant(emp, tenantId)) {
      return res.status(403).json({ message: 'Access denied: employee belongs to another organization' });
    }

    const { startDate, endDate } = req.query;
    const query = { employeeId: req.params.employeeId };

    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');
      query.date = { $gte: start, $lte: end };
    }

    const shifts = await ShiftSchedule.find(query).sort({ date: 1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = shifts.map((s) => {
      const obj = s.toObject();
      const shiftDate = new Date(s.date);
      shiftDate.setHours(0, 0, 0, 0);
      const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);
      const isAutoLocked = today >= lockThreshold;
      obj.isLocked = obj.isLocked || isAutoLocked;
      obj.isAutoLocked = !s.isLocked && isAutoLocked;
      return obj;
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all assigned shifts for History view (tenant-isolated)
// @route   GET /api/shifts/all
// @access  Private (Admin, HR, PM)
const getAllShifts = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { month, year, employeeId } = req.query;
    const query = { companyId: tenantId };

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(y, m, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const shifts = await ShiftSchedule.find(query)
      .sort({ date: 1 })
      .populate('employeeId', 'name employeeCode designation department role profilePicture')
      .populate('scheduledBy', 'name');

    const teams = await Team.find({ companyId: tenantId }).lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = shifts.map((s) => {
      const obj = s.toObject();
      const shiftDate = new Date(s.date);
      shiftDate.setHours(0, 0, 0, 0);
      const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);
      const isAutoLocked = today >= lockThreshold;
      obj.isLocked = obj.isLocked || isAutoLocked;
      obj.isAutoLocked = !s.isLocked && isAutoLocked;

      if (!obj.teamId && obj.employeeId) {
        const empIdStr = (obj.employeeId._id || obj.employeeId).toString();
        const foundTeam = teams.find((t) => t.members && t.members.some((m) => m.toString() === empIdStr));
        if (foundTeam) {
          obj.teamId = foundTeam.teamId;
        }
      }
      return obj;
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a shift schedule (tenant-isolated)
// @route   DELETE /api/shifts/:id
// @access  Private (Admin, HR, PM)
const deleteShift = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const shift = await ShiftSchedule.findById(req.params.id);
    if (!shift || !belongsToTenant(shift, tenantId)) {
      return res.status(404).json({ message: 'Shift not found in your organization' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);
    const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);

    if (shift.isLocked || today >= lockThreshold) {
      return res.status(400).json({
        message: 'Cannot delete shift less than 1 day before it occurs, after it has passed, or when locked.',
      });
    }

    const start = new Date(shift.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(shift.date);
    end.setHours(23, 59, 59, 999);

    await Team.updateMany(
      { companyId: tenantId, 'shifts.employeeId': shift.employeeId, 'shifts.date': { $gte: start, $lte: end } },
      { $pull: { shifts: { employeeId: shift.employeeId, date: { $gte: start, $lte: end } } } }
    );

    await ShiftSchedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shift deleted successfully', shiftId: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get upcoming shift summary (tenant-isolated)
// @route   GET /api/shifts/summary
// @access  Private (Admin, HR, PM)
const getShiftSummary = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(today.getDate() + 7);

    const schedules = await ShiftSchedule.find({
      companyId: tenantId,
      date: { $gte: today, $lte: upcomingLimit },
    }).populate('employeeId', 'name employeeCode designation role');

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  assignShift,
  lockShifts,
  unlockShifts,
  getShifts,
  getAllShifts,
  deleteShift,
  getShiftSummary,
};

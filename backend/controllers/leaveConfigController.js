const LeaveConfig = require('../models/LeaveConfig');
const SystemSettings = require('../models/SystemSettings');

// ─────────────────────────────────────────────
// @desc    Get leave configurations for a specific year
// @route   GET /api/leave-configs?year=2026
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const getConfigsByYear = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const configs = await LeaveConfig.find({ year }).sort({ designation: 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Upsert a leave configuration for a designation and year
// @route   PUT /api/leave-configs
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────
const upsertConfig = async (req, res) => {
  try {
    const { designation, year, casualLeaves, emergencyLeaves } = req.body;

    if (!designation || !year) {
      return res.status(400).json({ message: 'Designation and Year are required' });
    }

    const config = await LeaveConfig.findOneAndUpdate(
      { designation, year: parseInt(year) },
      { 
        $set: { 
          casualLeaves: parseInt(casualLeaves) || 0, 
          emergencyLeaves: parseInt(emergencyLeaves) || 0 
        } 
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Get Global Settings (Active Leave Year)
// @route   GET /api/settings/leave-year
// @access  Private
// ─────────────────────────────────────────────
const getActiveLeaveYear = async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: 'ACTIVE_LEAVE_YEAR' });
    if (setting) {
      return res.json({ activeYear: setting.value });
    } else {
      // Fallback
      return res.json({ activeYear: new Date().getFullYear() });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Set Global Settings (Active Leave Year)
// @route   PUT /api/settings/leave-year
// @access  Private (Admin)
// ─────────────────────────────────────────────
const setActiveLeaveYear = async (req, res) => {
  try {
    const { year } = req.body;
    if (!year) {
      return res.status(400).json({ message: 'Year is required' });
    }

    const setting = await SystemSettings.findOneAndUpdate(
      { key: 'ACTIVE_LEAVE_YEAR' },
      { $set: { value: parseInt(year) } },
      { new: true, upsert: true }
    );

    // Emit real-time update to all connected clients
    if (global.io) {
      global.io.emit('settings-updated', { type: 'LEAVE_YEAR_UPDATED', year: parseInt(year) });
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

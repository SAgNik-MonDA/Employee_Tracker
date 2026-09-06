const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Team       = require('../models/Team');
const User       = require('../models/User');

const euclideanDistance = (desc1, desc2) => {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
};

// @desc    Check in for today
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
  try {
    const { liveFaceDescriptor } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(403).json({ message: 'Face Authentication not set up. Please set it up in your profile.' });
    }
    
    if (!liveFaceDescriptor || !Array.isArray(liveFaceDescriptor) || liveFaceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Live face descriptor required for check-in.' });
    }

    const distance = euclideanDistance(user.faceDescriptor, liveFaceDescriptor);
    if (distance > 0.6) {
      return res.status(403).json({ message: 'Face verification failed.' });
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // YYYY-MM-DD IST
    const now = new Date();

    // Check if already checked in today
    const existing = await Attendance.findOne({
      employeeId: req.user._id,
      date: today,
    });

    if (existing) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    // Determine shift timings
    const todayStart = new Date(today + 'T00:00:00+05:30');
    const todayEnd = new Date(today + 'T23:59:59+05:30');
    
    let shiftType = 'General';
    
    // Check ShiftSchedule first
    const ShiftSchedule = require('../models/ShiftSchedule');
    const schedule = await ShiftSchedule.findOne({ 
      employeeId: req.user._id, 
      date: { $gte: todayStart, $lte: todayEnd } 
    });
    if (schedule) {
      shiftType = schedule.shiftType;
    } else {
      const team = await Team.findOne({ 
        'shifts.employeeId': req.user._id, 
        'shifts.date': { $gte: todayStart, $lt: todayEnd }
      });
      if (team) {
        const shift = team.shifts.find(s => s.employeeId.toString() === req.user._id.toString() && new Date(s.date).toISOString().split('T')[0] === today);
        if (shift) shiftType = shift.shiftType;
      }
    }

    // Determine status: Late if > 30 minutes after shift start
    // Morning (6 AM), General (10 AM), Evening (2 PM), Night (10 PM)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    let shiftStartMinutes = 10 * 60; // General
    if (shiftType === 'Morning') shiftStartMinutes = 6 * 60;
    if (shiftType === 'Evening') shiftStartMinutes = 14 * 60;
    if (shiftType === 'Night') shiftStartMinutes = 22 * 60;

    // Reject check-ins before shift start (with a 30-min early buffer)
    if (timeInMinutes < shiftStartMinutes - 30) {
      return res.status(400).json({ message: `Cannot check in yet. Your ${shiftType} shift starts at ${Math.floor(shiftStartMinutes/60)}:${String(shiftStartMinutes%60).padStart(2,'0')}.` });
    }

    let isLate = false;
    let lateDuration = 0;
    if (timeInMinutes > shiftStartMinutes + 30) {
      isLate = true;
      lateDuration = timeInMinutes - shiftStartMinutes;
    }

    const status = isLate ? 'Late' : 'Present';

    const attendance = await Attendance.create({
      employeeId: req.user._id,
      date: today,
      checkIn: now,
      status,
      shiftAssigned: shiftType,
      lateDuration
    });

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check out for today
// @route   PUT /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
  try {
    const { liveFaceDescriptor } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(403).json({ message: 'Face Authentication not set up.' });
    }
    if (!liveFaceDescriptor || !Array.isArray(liveFaceDescriptor) || liveFaceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Live face descriptor required for check-out.' });
    }

    const distance = euclideanDistance(user.faceDescriptor, liveFaceDescriptor);
    if (distance > 0.6) {
      return res.status(403).json({ message: 'Face verification failed.' });
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const now = new Date();

    const attendance = await Attendance.findOne({
      employeeId: req.user._id,
      date: today,
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in found for today. Please check in first.' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    const shiftType = attendance.shiftAssigned || 'General';

    // shift end time logic
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let shiftEndMin = 18 * 60; // 6:00 PM General
    if (shiftType === 'Morning') shiftEndMin = 14 * 60; // 2:00 PM
    if (shiftType === 'Evening') shiftEndMin = 22 * 60; // 10:00 PM
    if (shiftType === 'Night') shiftEndMin = 6 * 60 + 24 * 60; // 6:00 AM next day

    // Handle night shift crossing midnight:
    let checkMin = currentMin;
    if (shiftType === 'Night' && currentMin < 12 * 60) checkMin += 24 * 60; 

    // Early checkout check
    if (attendance.earlyCheckoutStatus !== 'Approved') {
      if (checkMin < shiftEndMin - 1) {
        return res.status(403).json({ message: 'Cannot check out early unless emergency check-out is approved.' });
      }
    }

    let earlyCheckoutDuration = 0;
    if (checkMin < shiftEndMin) {
      earlyCheckoutDuration = shiftEndMin - checkMin;
    }

    attendance.checkOut = now;
    attendance.earlyCheckoutDuration = earlyCheckoutDuration;
    await attendance.save();

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my attendance history
// @route   GET /api/attendance/my-history
// @access  Private
const getMyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { employeeId: req.user._id };

    // Filter by month/year if provided
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      filter.date = { $regex: `^${year}-${monthStr}` };
    }

    const attendance = await Attendance.find(filter).sort({ date: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── Helper: enrich an attendance record with team + leave info ───────────────
const _enrichRecord = async (record, employeeId, approvedLeaves, today, empHolidays = []) => {
  const dateStr = record.date; // YYYY-MM-DD
  const dateObj = new Date(dateStr);

  // Team info — live query so reassignments are reflected instantly
  const team = await Team.findOne({ members: employeeId, status: 'Active' })
    .select('teamId projectName')
    .lean();

  // Leave on this date?
  const leaveOnDate = approvedLeaves.find((l) => {
    const start = new Date(l.startDate);
    const end   = new Date(l.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return dateObj >= start && dateObj <= end;
  });

  // Online/Offline: Online only if today's record has checkIn but no checkOut
  const isToday    = dateStr === today;
  const isOnline   = isToday && record.checkIn && !record.checkOut;

  // Holiday check: is this date's weekday in the employee's weekly holidays?
  const dayOfWeek  = dateObj.getDay(); // 0=Sun … 6=Sat
  const isHoliday  = empHolidays.includes(dayOfWeek);

  // attendanceStatus: Holiday > Present/Late > Absent
  let attendanceStatus;
  if (isHoliday) {
    attendanceStatus = 'Holiday';
  } else if (record.status === 'Present' || record.status === 'Late') {
    attendanceStatus = record.status;
  } else {
    attendanceStatus = 'Absent';
  }

  return {
    _id:              record._id,
    date:             record.date,
    checkIn:          record.checkIn,
    checkOut:         record.checkOut,
    status:           record.status,
    teamId:           team?.teamId       || '—',
    projectName:      team?.projectName  || '—',
    onlineStatus:     isOnline ? 'Online' : 'Offline',
    isHoliday,
    attendanceStatus,
    leaveOnDate:  leaveOnDate
      ? {
          active:    true,
          leaveType: leaveOnDate.leaveType,
          startDate: leaveOnDate.startDate,
          endDate:   leaveOnDate.endDate,
        }
      : { active: false },
  };
};

// @desc    Get my attendance history — enriched with team + leave info
// @route   GET /api/attendance/my-history-enriched
// @access  Private
const getMyAttendanceEnriched = async (req, res) => {
  try {
    const { month, year } = req.query;
    const employeeId = req.user._id;
    const today      = new Date().toISOString().split('T')[0];

    const filter = { employeeId };
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      filter.date = { $regex: `^${year}-${monthStr}` };
    }

    const [records, approvedLeaves, empUser] = await Promise.all([
      Attendance.find(filter).sort({ date: -1 }).lean(),
      Leave.find({ employeeId, status: 'Approved' }).lean(),
      User.findById(employeeId).select('weeklyHolidays').lean(),
    ]);

    const empHolidays = empUser?.weeklyHolidays || [];

    const enriched = await Promise.all(
      records.map((r) => _enrichRecord(r, employeeId, approvedLeaves, today, empHolidays))
    );

    // Summary counters — holidays excluded from Absent count
    const totalPresent  = enriched.filter((r) => r.attendanceStatus === 'Present' || r.attendanceStatus === 'Late').length;
    const totalAbsent   = enriched.filter((r) => r.attendanceStatus === 'Absent').length;
    const totalOffline  = enriched.filter((r) => r.checkOut).length;
    const totalLeaves   = approvedLeaves.length;

    res.json({ records: enriched, summary: { totalPresent, totalAbsent, totalOffline, totalLeaves } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all-time attendance stats per employee (Admin/HR) — for ManageEmployees table
// @route   GET /api/attendance/employee-stats
// @access  Private (Admin, HR)
const getEmployeeAttendanceStats = async (req, res) => {
  try {
    // Aggregate attendance counts per employee
    const attStats = await Attendance.aggregate([
      {
        $group: {
          _id:           '$employeeId',
          totalPresent:  { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          totalAbsent:   { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
          totalOffline:  { $sum: { $cond: [{ $ifNull: ['$checkOut', false] }, 1, 0] } },
        },
      },
    ]);

    // Aggregate approved leave counts per employee
    const leaveStats = await Leave.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: '$employeeId', totalLeaves: { $sum: 1 } } },
    ]);

    // Build maps keyed by employeeId string
    const attMap   = {};
    attStats.forEach((s)   => { attMap[s._id.toString()]   = s; });
    const leaveMap = {};
    leaveStats.forEach((s) => { leaveMap[s._id.toString()] = s; });

    // Merge maps — return a flat object keyed by employeeId
    const allIds = new Set([...Object.keys(attMap), ...Object.keys(leaveMap)]);
    const result = {};
    allIds.forEach((id) => {
      result[id] = {
        totalPresent: attMap[id]?.totalPresent  || 0,
        totalAbsent:  attMap[id]?.totalAbsent   || 0,
        totalOffline: attMap[id]?.totalOffline  || 0,
        totalLeaves:  leaveMap[id]?.totalLeaves || 0,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @access  Private (Admin, HR)
const getAllAttendance = async (req, res) => {
  try {
    const { date, month, year } = req.query;
    const filter = {};

    if (date) {
      filter.date = date;
    } else if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      filter.date = { $regex: `^${year}-${monthStr}` };
    }

    const attendance = await Attendance.find(filter)
      .populate('employeeId', 'name email department designation')
      .sort({ date: -1 });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all employees' attendance — enriched with team + leave info (Admin/HR)
// @route   GET /api/attendance/all-enriched
// @access  Private (Admin, HR)
const getAllAttendanceEnriched = async (req, res) => {
  try {
    const { date, month, year } = req.query;
    const today  = new Date().toISOString().split('T')[0];
    const filter = {};

    if (date) {
      filter.date = date;
    } else if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      filter.date = { $regex: `^${year}-${monthStr}` };
    }

    const rawRecords = await Attendance.find(filter)
      .populate('employeeId', 'name email department designation employeeCode')
      .sort({ date: -1 })
      .lean();

    // Bulk-fetch all approved leaves for all unique employee IDs in result
    const empIds = [...new Set(rawRecords.map((r) => r.employeeId?._id?.toString()).filter(Boolean))];

    const [allLeaves, allActiveTeams, empUsers] = await Promise.all([
      Leave.find({ employeeId: { $in: empIds }, status: 'Approved' }).lean(),
      Team.find({ status: 'Active', members: { $in: empIds } }).select('teamId projectName members').lean(),
      User.find({ _id: { $in: empIds } }).select('weeklyHolidays').lean(),
    ]);

    // Group leaves by employeeId
    const leaveMap = {};
    allLeaves.forEach((l) => {
      const key = l.employeeId.toString();
      if (!leaveMap[key]) leaveMap[key] = [];
      leaveMap[key].push(l);
    });

    // Build teamMap: employeeId -> team
    const teamMap = {};
    allActiveTeams.forEach((team) => {
      team.members.forEach((memberId) => {
        const key = memberId.toString();
        if (!teamMap[key]) teamMap[key] = team;
      });
    });

    // Build holidayMap: employeeId -> weeklyHolidays[]
    const holidayMap = {};
    empUsers.forEach((u) => { holidayMap[u._id.toString()] = u.weeklyHolidays || []; });

    const enriched = rawRecords.map((record) => {
      const empId    = record.employeeId?._id?.toString();
      const dateStr  = record.date;
      const dateObj  = new Date(dateStr);
      const team     = empId ? teamMap[empId] : null;
      const leaves   = empId ? (leaveMap[empId]  || []) : [];
      const holidays = empId ? (holidayMap[empId] || []) : [];

      const leaveOnDate = leaves.find((l) => {
        const start = new Date(l.startDate);
        const end   = new Date(l.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return dateObj >= start && dateObj <= end;
      });

      const isToday    = dateStr === today;
      const isOnline   = isToday && record.checkIn && !record.checkOut;
      const dayOfWeek  = dateObj.getDay();
      const isHoliday  = holidays.includes(dayOfWeek);

      let attendanceStatus;
      if (isHoliday) {
        attendanceStatus = 'Holiday';
      } else if (record.status === 'Present' || record.status === 'Late') {
        attendanceStatus = record.status;
      } else {
        attendanceStatus = 'Absent';
      }

      return {
        _id:              record._id,
        date:             record.date,
        checkIn:          record.checkIn,
        checkOut:         record.checkOut,
        status:           record.status,
        employeeId:       record.employeeId,
        teamId:           team?.teamId      || '—',
        projectName:      team?.projectName || '—',
        onlineStatus:     isOnline ? 'Online' : 'Offline',
        isHoliday,
        attendanceStatus,
        leaveOnDate:  leaveOnDate
          ? { active: true, leaveType: leaveOnDate.leaveType, startDate: leaveOnDate.startDate, endDate: leaveOnDate.endDate }
          : { active: false },
      };
    });

    // Summary — holidays excluded from absent
    const totalPresent = enriched.filter((r) => r.attendanceStatus === 'Present' || r.attendanceStatus === 'Late').length;
    const totalAbsent  = enriched.filter((r) => r.attendanceStatus === 'Absent').length;
    const totalOffline = enriched.filter((r) => r.checkOut).length;
    const totalOnLeave = enriched.filter((r) => r.leaveOnDate?.active).length;

    res.json({ records: enriched, summary: { totalPresent, totalAbsent, totalOffline, totalOnLeave } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




// @desc    Get today's attendance for the logged in user
// @route   GET /api/attendance/today
// @access  Private
const getTodayStatus = async (req, res) => {
  try {
    let today = req.query.clientDate;
    if (!today) {
      // Fallback to local timezone formatted date if clientDate not provided
      today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    }

    const attendance = await Attendance.findOne({
      employeeId: req.user._id,
      date: today,
    });

    // Also determine their expected shift for today
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    let shiftType = 'General';
    const ShiftSchedule = require('../models/ShiftSchedule');
    const schedule = await ShiftSchedule.findOne({ 
      employeeId: req.user._id, 
      date: { $gte: todayStart, $lt: todayEnd } 
    });
    if (schedule) {
      shiftType = schedule.shiftType;
    } else {
      const team = await Team.findOne({ 
        'shifts.employeeId': req.user._id, 
        'shifts.date': { $gte: todayStart, $lt: todayEnd }
      });
      if (team) {
        const shift = team.shifts.find(s => s.employeeId.toString() === req.user._id.toString() && new Date(s.date).toISOString().split('T')[0] === today);
        if (shift) shiftType = shift.shiftType;
      }
    }

    if (attendance) {
      // Inject expectedShift into response
      const responseData = attendance.toObject();
      responseData.expectedShift = shiftType;
      return res.json(responseData);
    }

    res.json({ expectedShift: shiftType });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Request early check-out
// @route   POST /api/attendance/early-checkout
// @access  Private
const requestEarlyCheckout = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Reason is required for early check-out.' });

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const attendance = await Attendance.findOne({ employeeId: req.user._id, date: today });

    if (!attendance) return res.status(404).json({ message: 'No check-in found for today.' });
    if (attendance.checkOut) return res.status(400).json({ message: 'Already checked out.' });

    const Team = require('../models/Team');
    const team = await Team.findOne({ members: req.user._id, status: 'Active' });

    attendance.earlyCheckoutStatus = team ? 'Pending_TL' : 'Pending_PM';
    attendance.earlyCheckoutReason = reason;
    await attendance.save();

    res.json({ message: 'Early checkout request submitted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Approve/Reject early check-out
// @route   PUT /api/attendance/early-checkout/:id
// @access  Private (TL, PM, Admin, HR)
const reviewEarlyCheckout = async (req, res) => {
  try {
    const { status } = req.body; 
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) return res.status(404).json({ message: 'Attendance record not found.' });

    attendance.earlyCheckoutStatus = status;
    await attendance.save();

    res.json({ message: `Early checkout request updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get pending early check-out requests
// @route   GET /api/attendance/early-checkout/pending
// @access  Private (TL, PM, Admin, HR)
const getPendingEarlyCheckouts = async (req, res) => {
  try {
    const statuses = ['Pending_TL', 'Pending_PM'];
    const requests = await Attendance.find({ earlyCheckoutStatus: { $in: statuses } }).populate('employeeId', 'name profilePicture designation');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all early check-out requests (history)
// @route   GET /api/attendance/early-checkout/all
// @access  Private (TL, PM, Admin, HR)
const getAllEarlyCheckouts = async (req, res) => {
  try {
    const statuses = ['Pending_TL', 'Pending_PM', 'Approved', 'Rejected'];
    const requests = await Attendance.find({ earlyCheckoutStatus: { $in: statuses } }).populate('employeeId', 'name profilePicture designation');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getMyAttendanceEnriched,
  getAllAttendance,
  getAllAttendanceEnriched,
  getEmployeeAttendanceStats,
  getTodayStatus,
  requestEarlyCheckout,
  reviewEarlyCheckout,
  getPendingEarlyCheckouts,
  getAllEarlyCheckouts,
};

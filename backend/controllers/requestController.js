const EmployeeRequest = require('../models/EmployeeRequest');
const ShiftSchedule = require('../models/ShiftSchedule');
const Team = require('../models/Team');

// @desc    Submit a generic employee request
// @route   POST /api/requests
// @access  Private
const submitRequest = async (req, res) => {
  try {
    const { requestType, reason, dateRequestedFor, shiftDate, currentShift, desiredShift } = req.body;

    const targetDate = shiftDate || dateRequestedFor;

    if (!requestType || !reason || !targetDate) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (requestType === 'Shift Change' && (!desiredShift || !currentShift)) {
      return res.status(400).json({ message: 'Please select both current shift and desired shift.' });
    }

    const newRequest = await EmployeeRequest.create({
      employeeId: req.user._id,
      requestType,
      reason,
      dateRequestedFor: targetDate,
      shiftDate: requestType === 'Shift Change' ? targetDate : null,
      currentShift: requestType === 'Shift Change' ? currentShift : '',
      desiredShift: requestType === 'Shift Change' ? desiredShift : '',
    });

    res.status(201).json({ message: 'Request submitted successfully', request: newRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my generic requests
// @route   GET /api/requests/my-requests
// @access  Private
const getMyRequests = async (req, res) => {
  try {
    const requests = await EmployeeRequest.find({ employeeId: req.user._id })
                                          .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all employee requests (for Admin/HR/PM)
// @route   GET /api/requests/all
// @access  Private (Admin, HR, PM, etc.)
const getAllRequests = async (req, res) => {
  try {
    const requests = await EmployeeRequest.find({})
      .populate('employeeId', 'name profilePicture designation employeeCode')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review (Approve/Reject) a request
// @route   PUT /api/requests/:id/review
// @access  Private (Admin, HR, PM, etc.)
const reviewRequest = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body; // status: 'Approved', 'Rejected'
    
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await EmployeeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    request.status = status;
    request.reviewedBy = req.user._id;
    if (reviewNotes !== undefined) request.reviewNotes = reviewNotes;

    await request.save();

    // End-to-End: If Shift Change request is approved, update employee's shift schedule
    if (status === 'Approved' && request.requestType === 'Shift Change' && request.desiredShift) {
      const sDate = request.shiftDate || request.dateRequestedFor;
      if (sDate) {
        const sDateObj = new Date(sDate);
        const dateStr = sDateObj.toISOString().split('T')[0];
        const start = new Date(dateStr + 'T00:00:00.000Z');
        const end = new Date(dateStr + 'T23:59:59.999Z');

        const existingGlobal = await ShiftSchedule.findOne({ employeeId: request.employeeId, date: { $gte: start, $lte: end } });
        if (existingGlobal) {
          existingGlobal.shiftType = request.desiredShift;
          existingGlobal.scheduledBy = req.user._id;
          await existingGlobal.save();
        } else {
          await ShiftSchedule.create({
            employeeId: request.employeeId,
            shiftType: request.desiredShift,
            date: start,
            scheduledBy: req.user._id,
          });
        }

        // Sync to Team shifts
        const teams = await Team.find({ members: request.employeeId });
        for (const t of teams) {
          let changed = false;
          for (const s of (t.shifts || [])) {
            const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
            const sDateStr = new Date(s.date).toISOString().split('T')[0];
            if (sEmp === request.employeeId.toString() && sDateStr === dateStr) {
              s.shiftType = request.desiredShift;
              changed = true;
            }
          }
          if (changed) await t.save();
        }
      }
    }

    res.json({ message: `Request has been ${status.toLowerCase()}` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest
};
